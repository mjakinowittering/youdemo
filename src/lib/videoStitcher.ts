import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacketSink,
    EncodedVideoPacketSource,
    Input,
    Output,
    VideoSample,
    VideoSampleSink,
    VideoSampleSource,
    WebMOutputFormat,
    type EncodedPacket,
    type InputAudioTrack,
    type InputVideoTrack
} from 'mediabunny';

import { SAMPLE_INTERVAL } from '$lib/editorMath.js';
import { VIDEO_BITS_PER_SECOND } from '$lib/recorder.js';
import {
    cutPlan,
    joinPlan,
    needsNormalising,
    type PacketMeta,
    type Placement,
    type RemuxPlan,
    type TrackPackets
} from '$lib/remuxPlan.js';
import { stagedProgress } from '$lib/stagedProgress.js';
import type { DeletedRange, ExportStep } from '$lib/types.js';

/*
 * Export by copying packets. Joins and cuts copy the recorded video and audio
 * packets byte for byte into a new WebM (Mediabunny demux/mux, pure
 * TypeScript) — no decoding, no re-encoding and no real-time replay, so nothing
 * can drop frames or lose quality, and the output gets a real duration and a
 * seek index. The recorder keys every editor cell, which is what makes cuts
 * copyable. Takes that can't be copied are re-encoded once, first, through the
 * browser's own WebCodecs encoder (see `normalise`). History and the ffmpeg
 * rule: the `video-export` skill.
 */

/** The whole job's 0–1 fraction, and the step it is on. */
export type ExportProgress = (fraction: number, step: ExportStep) => void;
type Report = (fraction: number) => void;

// Each step's share of the bar. Differing encoder settings, seen before the
// scan, mean a re-encode, and that dwarfs the copy. Tune from real timings.
const COPY_STEPS: [ExportStep, number][] = [
    ['reading', 0.3],
    ['writing', 0.6],
    ['saving', 0.1]
];
const REENCODE_STEPS: [ExportStep, number][] = [
    ['reading', 0.09],
    ['reencoding', 0.7],
    ['writing', 0.18],
    ['saving', 0.03]
];

/** Packets between breaks for the page to repaint, in the scan and the copy. */
const YIELD_PACKETS = 200;
/** Frames between breaks while re-encoding, each far slower than a packet. */
const YIELD_FRAMES = 30;

/**
 * A macrotask break, so the progress bar repaints mid-job. An awaited resolved
 * promise is only a microtask, which never lets the page paint.
 */
function yieldToBrowser(): Promise<void> {
    const { scheduler } = globalThis as { scheduler?: { yield?: () => Promise<void> } };
    if (scheduler?.yield) return scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A recording's tracks, read without touching its packets. */
interface Tracks {
    video: InputVideoTrack;
    audio: InputAudioTrack | null;
    /** Equal for two sources exactly when their packets can share one file. */
    config: string;
    /** Seconds, from the file's metadata; 0 when it has none. */
    duration: number;
    size: number;
}

interface Source extends Tracks {
    packets: TrackPackets;
}

async function tracks(blob: Blob): Promise<Tracks> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('Recording has no video track');
    const audio = await input.getPrimaryAudioTrack();
    const v = await video.getDecoderConfig();
    const a = audio ? await audio.getDecoderConfig() : null;
    return {
        video,
        audio,
        config: JSON.stringify([
            v?.codec,
            v?.codedWidth,
            v?.codedHeight,
            a?.codec,
            a?.sampleRate,
            a?.numberOfChannels
        ]),
        duration: (await input.getDurationFromMetadata()) ?? 0,
        size: blob.size
    };
}

/** Every packet's timing, reported by timestamp against the duration. */
async function metadata(
    track: InputVideoTrack | InputAudioTrack,
    duration: number,
    report: Report
): Promise<PacketMeta[]> {
    const out: PacketMeta[] = [];
    const sink = new EncodedPacketSink(track);
    for await (const p of sink.packets(undefined, undefined, { metadataOnly: true })) {
        out.push({ ts: p.timestamp, dur: p.duration, key: p.type === 'key' });
        if (duration > 0) report(p.timestamp / duration);
        if (out.length % YIELD_PACKETS === 0) await yieldToBrowser();
    }
    report(1);
    return out;
}

async function scan(t: Tracks, report: Report): Promise<Source> {
    const part = stagedProgress<'video' | 'audio'>(
        t.audio
            ? [
                  ['video', 1],
                  ['audio', 1]
              ]
            : [['video', 1]],
        report
    );
    const video = await metadata(t.video, t.duration, part.video);
    const audio = t.audio ? await metadata(t.audio, t.duration, part.audio) : [];
    return { ...t, packets: { video, audio } };
}

/** Scan each recording in turn, sharing `report` by file size. */
async function scanAll(all: Tracks[], report: Report): Promise<Source[]> {
    const per = stagedProgress(
        all.map((t, i): [string, number] => [String(i), t.size]),
        report
    );
    const out: Source[] = [];
    for (const [i, t] of all.entries()) out.push(await scan(t, per[String(i)]));
    return out;
}

async function open(blob: Blob, report: Report): Promise<Source> {
    return scan(await tracks(blob), report);
}

/**
 * Re-encode one take at `width` × `height` (letterboxed), keying every cell,
 * with its audio copied. Decodes every frame, redraws it on an opaque canvas
 * and encodes it through the browser's own WebCodecs encoder — as fast as the
 * machine allows, not in real time. (Mediabunny's `Conversion` would be
 * shorter, but it drops one frame in six of the recorder's output.)
 */
async function reencode(
    source: Source,
    width: number,
    height: number,
    report: Report
): Promise<Blob> {
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const videoOut = new VideoSampleSource({
        codec: 'vp9',
        bitrate: VIDEO_BITS_PER_SECOND,
        keyFrameInterval: SAMPLE_INTERVAL
    });
    output.addVideoTrack(videoOut);
    const audioOut = source.audio ? new EncodedAudioPacketSource(source.audio.codec!) : null;
    if (audioOut) output.addAudioTrack(audioOut);
    await output.start();

    // Audio first: it is small, so the muxer buffers it while video catches up.
    if (source.audio && audioOut) {
        let meta: EncodedAudioChunkMetadata | undefined = {
            decoderConfig: (await source.audio.getDecoderConfig()) ?? undefined
        };
        for await (const packet of new EncodedPacketSink(source.audio).packets()) {
            await audioOut.add(packet, meta);
            meta = undefined;
        }
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const scale = Math.min(width / source.video.displayWidth, height / source.video.displayHeight);
    const w = source.video.displayWidth * scale;
    const h = source.video.displayHeight * scale;
    // The scan counted the frames exactly
    const frames = Math.max(1, source.packets.video.length);
    let done = 0;
    for await (const sample of new VideoSampleSink(source.video).samples()) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        sample.draw(ctx, (width - w) / 2, (height - h) / 2, w, h);
        const frame = new VideoSample(canvas, {
            timestamp: sample.timestamp,
            duration: sample.duration
        });
        await videoOut.add(frame);
        frame.close();
        sample.close();
        report(++done / frames);
        if (done % YIELD_FRAMES === 0) await yieldToBrowser();
    }
    await output.finalize();
    return new Blob([target.buffer!], { type: 'video/webm' });
}

/**
 * Re-encode every source once so they share the first one's size and key
 * every cell — for takes of different screen sizes, or takes recorded before
 * the recorder keyed every cell. Costs a generation of quality; can't drop
 * frames. Each take is re-encoded, then scanned again.
 */
async function normalise(sources: Source[], report: Report): Promise<Source[]> {
    const { displayWidth, displayHeight } = sources[0].video;
    const per = stagedProgress(
        sources.map((s, i): [string, number] => [String(i), s.packets.video.length + 1]),
        report
    );
    const out: Source[] = [];
    for (const [i, source] of sources.entries()) {
        const take = stagedProgress(
            [
                ['encode', 0.9],
                ['read', 0.1]
            ],
            per[String(i)]
        );
        const blob = await reencode(source, displayWidth, displayHeight, take.encode);
        out.push(await open(blob, take.read));
    }
    return out;
}

/**
 * Read the recordings, re-encoding them first if they can't be copied as they
 * are. Returns them with the reporters for the steps still to come.
 */
async function prepare(
    blobs: Blob[],
    onProgress: ExportProgress = () => {}
): Promise<{ sources: Source[]; steps: Record<ExportStep, Report> }> {
    const all = await Promise.all(blobs.map(tracks));
    const differ = new Set(all.map((t) => t.config)).size > 1;
    let done = 0;
    let steps = stagedProgress(differ ? REENCODE_STEPS : COPY_STEPS, (f, step) => {
        done = f;
        onProgress(f, step);
    });
    let sources = await scanAll(all, steps.reading);
    if (needsNormalising(sources.map((s) => ({ ...s.packets, config: s.config })))) {
        if (!differ) {
            // Too few keyframes only shows in the scan: lay out the rest again
            const from = done;
            steps = stagedProgress(REENCODE_STEPS.slice(1), (f, step) =>
                onProgress(from + (1 - from) * f, step)
            );
        }
        sources = await normalise(sources, steps.reencoding);
    }
    return { sources, steps };
}

/** Packets of one source's track that the plan keeps, restamped, in decode order. */
async function* placed(
    track: InputVideoTrack | InputAudioTrack,
    placements: Placement[]
): AsyncGenerator<EncodedPacket> {
    const at = new Map(placements.map((p) => [p.index, p.ts]));
    const last = placements.at(-1)?.index ?? -1;
    let index = 0;
    for await (const packet of new EncodedPacketSink(track).packets()) {
        const ts = at.get(index);
        if (ts !== undefined) yield packet.clone({ timestamp: ts });
        if (++index > last) return;
    }
}

/** Write the plan into one WebM, interleaving video and audio by time. */
async function write(
    sources: Source[],
    plan: RemuxPlan,
    steps: Record<'writing' | 'saving', Report>
): Promise<Blob> {
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const first = sources[0];
    const videoOut = new EncodedVideoPacketSource(first.video.codec!);
    output.addVideoTrack(videoOut);
    const audioOut =
        first.audio && plan.audio.length ? new EncodedAudioPacketSource(first.audio.codec!) : null;
    if (audioOut) output.addAudioTrack(audioOut);
    await output.start();

    const videoConfig = (await first.video.getDecoderConfig()) ?? undefined;
    const audioConfig = (await first.audio?.getDecoderConfig()) ?? undefined;
    const total = plan.video.length + plan.audio.length;
    let written = 0;
    let videoMeta = videoConfig && { decoderConfig: videoConfig };
    let audioMeta = audioConfig && { decoderConfig: audioConfig };

    for (let t = 0; t < sources.length; t++) {
        const v = placed(
            sources[t].video,
            plan.video.filter((p) => p.take === t)
        );
        const audioTrack = sources[t].audio;
        const a =
            audioOut && audioTrack
                ? placed(
                      audioTrack,
                      plan.audio.filter((p) => p.take === t)
                  )
                : null;
        let nextV = await v.next();
        let nextA = a ? await a.next() : null;
        for (;;) {
            const video = nextV.done ? null : nextV.value;
            const audio = nextA && !nextA.done ? nextA.value : null;
            if (!video && !audio) break;
            if (audio && (!video || audio.timestamp < video.timestamp)) {
                await audioOut!.add(audio, audioMeta);
                audioMeta = undefined;
                nextA = await a!.next();
            } else if (video) {
                await videoOut.add(video, videoMeta);
                videoMeta = undefined;
                nextV = await v.next();
            }
            steps.writing(++written / total);
            if (written % YIELD_PACKETS === 0) await yieldToBrowser();
        }
    }
    steps.saving(0);
    await output.finalize();
    const blob = new Blob([target.buffer!], { type: 'video/webm' });
    steps.saving(1);
    return blob;
}

/** Join recorded takes into one WebM, back to back. One take is returned as is. */
export async function stitchSegments(blobs: Blob[], onProgress?: ExportProgress): Promise<Blob> {
    if (blobs.length <= 1) return blobs[0];
    const { sources, steps } = await prepare(blobs, onProgress);
    return write(sources, joinPlan(sources.map((s) => s.packets)), steps);
}

/**
 * Drop `deletedRanges` from `source`, closing the gaps. Each kept stretch
 * starts on the keyframe nearest its start — within ~0.1 s of the cut, as the
 * recorder keys every 0.2 s cell. No cuts, or everything deleted → `source`
 * unchanged.
 */
export async function renderEditedVideo(
    source: Blob,
    deletedRanges: DeletedRange[],
    onProgress?: ExportProgress
): Promise<Blob> {
    if (!deletedRanges || deletedRanges.length === 0) return source;
    const {
        sources: [opened],
        steps
    } = await prepare([source], onProgress);
    const plan = cutPlan(opened.packets, deletedRanges);
    if (plan.video.length === 0) return source;
    return write([opened], plan, steps);
}

/** A take's length in seconds, read from its WebM (crash recovery has no clock). */
export async function takeDuration(blob: Blob): Promise<number> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
        return await input.computeDuration();
    } finally {
        input.dispose();
    }
}
