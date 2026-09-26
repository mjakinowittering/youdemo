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
import type { DeletedRange } from '$lib/types.js';

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

interface Source {
    video: InputVideoTrack;
    audio: InputAudioTrack | null;
    packets: TrackPackets;
    /** Equal for two sources exactly when their packets can share one file. */
    config: string;
}

async function metadata(track: InputVideoTrack | InputAudioTrack): Promise<PacketMeta[]> {
    const out: PacketMeta[] = [];
    const sink = new EncodedPacketSink(track);
    for await (const p of sink.packets(undefined, undefined, { metadataOnly: true })) {
        out.push({ ts: p.timestamp, dur: p.duration, key: p.type === 'key' });
    }
    return out;
}

async function open(blob: Blob): Promise<Source> {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('Recording has no video track');
    const audio = await input.getPrimaryAudioTrack();
    const v = await video.getDecoderConfig();
    const a = audio ? await audio.getDecoderConfig() : null;
    return {
        video,
        audio,
        packets: { video: await metadata(video), audio: audio ? await metadata(audio) : [] },
        config: JSON.stringify([
            v?.codec,
            v?.codedWidth,
            v?.codedHeight,
            a?.codec,
            a?.sampleRate,
            a?.numberOfChannels
        ])
    };
}

/**
 * Re-encode one take at `width` × `height` (letterboxed), keying every cell,
 * with its audio copied. Decodes every frame, redraws it on an opaque canvas
 * and encodes it through the browser's own WebCodecs encoder — as fast as the
 * machine allows, not in real time. (Mediabunny's `Conversion` would be
 * shorter, but it drops one frame in six of the recorder's output.)
 */
async function reencode(source: Source, width: number, height: number): Promise<Blob> {
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
    }
    await output.finalize();
    return new Blob([target.buffer!], { type: 'video/webm' });
}

/**
 * Re-encode every source once so they share the first one's size and key
 * every cell — for takes of different screen sizes, or takes recorded before
 * the recorder keyed every cell. Costs a generation of quality; can't drop
 * frames.
 */
async function normalise(sources: Source[]): Promise<Source[]> {
    const { displayWidth, displayHeight } = sources[0].video;
    const out: Source[] = [];
    for (const source of sources)
        out.push(await open(await reencode(source, displayWidth, displayHeight)));
    return out;
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
    onProgress?: (fraction: number) => void
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
            onProgress?.(++written / total);
        }
    }
    await output.finalize();
    return new Blob([target.buffer!], { type: 'video/webm' });
}

/** Join recorded takes into one WebM, back to back. One take is returned as is. */
export async function stitchSegments(
    blobs: Blob[],
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    if (blobs.length <= 1) return blobs[0];
    let sources = await Promise.all(blobs.map(open));
    if (needsNormalising(sources.map((s) => ({ ...s.packets, config: s.config })))) {
        sources = await normalise(sources);
    }
    return write(sources, joinPlan(sources.map((s) => s.packets)), onProgress);
}

/**
 * Drop `deletedRanges` from `source`, closing the gaps. Each kept stretch
 * starts on the keyframe nearest its start — within ~0.1 s of the cut, as the
 * recorder keys every 0.2 s cell. Everything deleted → `source` unchanged.
 */
export async function renderEditedVideo(
    source: Blob,
    deletedRanges: DeletedRange[],
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    if (!deletedRanges || deletedRanges.length === 0) return source;
    let opened = await open(source);
    if (needsNormalising([{ ...opened.packets, config: opened.config }])) {
        [opened] = await normalise([opened]);
    }
    const plan = cutPlan(opened.packets, deletedRanges);
    if (plan.video.length === 0) return source;
    return write([opened], plan, onProgress);
}
