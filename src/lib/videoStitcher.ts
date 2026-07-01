import fixWebmDuration from 'fix-webm-duration';
import type { VideoEncodingQuality } from './types/quality';
import { VIDEO_BPS_OPTIONS, AUDIO_BPS_OPTIONS } from './constants/VIDEO_BPS_OPTIONS';


function pickMimeType(): string {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
}

function mediaEvent(el: HTMLMediaElement, name: string): Promise<void> {
    return new Promise((resolve) => el.addEventListener(name, () => resolve(), { once: true }));
}

/**
 * Join recorded WebM segments into ONE valid WebM by replaying them through a
 * canvas + MediaRecorder — i.e. the browser's native encoder.
 *
 * Why not ffmpeg.wasm: Chrome records the canvas as VP9 with an alpha plane
 * (`alpha_mode: 1`), and ffmpeg.wasm crashes ("memory access out of bounds")
 * trying to re-encode that. Re-recording through the same native pipeline that
 * already produces the segments sidesteps the whole problem. It runs in real
 * time (about as long as the combined recording).
 */
export async function stitchSegments(
    blobs: Blob[],
    quality: VideoEncodingQuality,
    onProgress?: (fraction: number) => void
): Promise<Blob> {
    if (blobs.length <= 1) return blobs[0];

    // Probe the first segment for the output frame size.
    const probe = document.createElement('video');
    probe.src = URL.createObjectURL(blobs[0]);
    probe.muted = true;
    await mediaEvent(probe, 'loadedmetadata');
    const width = probe.videoWidth || 1280;
    const height = probe.videoHeight || 720;
    URL.revokeObjectURL(probe.src);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // alpha: false → opaque output (the source segments fully cover the frame).
    const ctx = canvas.getContext('2d', { alpha: false })!;

    const audioCtx = new AudioContext();
    await audioCtx.resume().catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();

    const stream = canvas.captureStream(0);
    const frameTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    //! Note(Kiran): As this is the first parse we don't want to compress (so high quality). 
    // * Currently doing 2 parses eventually we should try to reduce to a single parse: complexity n(2) => n(1)
    const recorder = new MediaRecorder(stream, {
        mimeType: pickMimeType(),
        videoBitsPerSecond: VIDEO_BPS_OPTIONS['high'], 
        audioBitsPerSecond: AUDIO_BPS_OPTIONS['high'],
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const startMs = Date.now();
    recorder.start(500);

    for (let i = 0; i < blobs.length; i++) {
        await playSegment(blobs[i], ctx, width, height, frameTrack, audioCtx, dest, (f) =>
            onProgress?.((i + f) / blobs.length)
        );
    }

    await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
    });
    const durationMs = Date.now() - startMs;
    audioCtx.close();
    frameTrack.stop();

    const raw = new Blob(chunks, { type: 'video/webm' });
    return fixWebmDuration(raw, durationMs);
}

async function playSegment(
    blob: Blob,
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frameTrack: CanvasCaptureMediaStreamTrack,
    audioCtx: AudioContext,
    dest: MediaStreamAudioDestinationNode,
    onProgress: (fraction: number) => void
): Promise<void> {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(blob);
    video.playsInline = true;
    await mediaEvent(video, 'loadedmetadata');

    // Route the segment's audio into the shared destination. createMediaElementSource
    // reroutes the element's audio entirely into the graph (and we never connect it
    // to the speakers), so nothing is audible while stitching runs.
    let srcNode: MediaElementAudioSourceNode | null = null;
    try {
        srcNode = audioCtx.createMediaElementSource(video);
        srcNode.connect(dest);
    } catch {
        /* segment has no audio track */
    }

    await video.play();

    await new Promise<void>((resolve) => {
        const id = setInterval(() => {
            if (video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, width, height);
                frameTrack.requestFrame();
                if (video.duration) onProgress(Math.min(1, video.currentTime / video.duration));
            }
        }, 1000 / 30);
        video.onended = () => {
            clearInterval(id);
            resolve();
        };
    });

    srcNode?.disconnect();
    video.pause();
    URL.revokeObjectURL(video.src);
}

interface Range {
    startTime: number;
    endTime: number;
}

/** Invert deleted ranges into the kept ranges of a [0, duration] timeline. */
function keptRanges(duration: number, deleted: Range[]): { start: number; end: number }[] {
    const sorted = [...deleted].sort((a, b) => a.startTime - b.startTime);
    const kept: { start: number; end: number }[] = [];
    let cursor = 0;
    for (const d of sorted) {
        if (cursor < d.startTime) kept.push({ start: cursor, end: d.startTime });
        cursor = Math.max(cursor, d.endTime);
    }
    if (cursor < duration) kept.push({ start: cursor, end: duration });
    return kept;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
        if (Math.abs(video.currentTime - time) < 0.05) {
            resolve();
            return;
        }
        const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = time;
    });
}

/**
 * Render an edited timeline (source minus deletedRanges) into ONE WebM by
 * replaying only the kept ranges through a canvas + MediaRecorder — the same
 * native pipeline as stitchSegments. Avoids ffmpeg entirely: the previous
 * ffmpeg `-c copy` trim+concat dropped all but the first kept range. Real-time
 * (plays the kept duration); cut precision is per-frame, better than `-c copy`.
 */

export async function renderExportedVideo(
    source: Blob,
    quality: VideoEncodingQuality,
    deletedRanges: Range[],
    onProgress?: (fraction: number) => void
): Promise<Blob> {

    const video = document.createElement('video');
    video.src = URL.createObjectURL(source);
    video.playsInline = true;
    await mediaEvent(video, 'loadedmetadata');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
   
    const ranges = keptRanges(duration, deletedRanges);
    if (ranges.length === 0) {
        URL.revokeObjectURL(video.src);
        return source; // everything deleted — fall back rather than emit empty
    }
    const totalKept = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);

    //todo(Kiran): Investigate, do we have a memory leak here? 
    // * Are we creating canvas objects and not disposing of them?
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    const audioCtx = new AudioContext();
    await audioCtx.resume().catch(() => {});
    const dest = audioCtx.createMediaStreamDestination();
    let srcNode: MediaElementAudioSourceNode | null = null;
    try {
        srcNode = audioCtx.createMediaElementSource(video);
        srcNode.connect(dest);
    } catch {
        /* no audio track */
    }

    const stream = canvas.captureStream(0);
    const frameTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    console.info(`Exporting video ${quality} quality (${VIDEO_BPS_OPTIONS[quality]}BPS)`)
    const videoBitsPerSecond = VIDEO_BPS_OPTIONS[quality];
    const audioBitsPerSecond = AUDIO_BPS_OPTIONS[quality];

    // ! Note(Kiran): This is the final step so we apply AV quality here.
    const recorder = new MediaRecorder(stream, {
        mimeType: pickMimeType(),
      videoBitsPerSecond,
      audioBitsPerSecond
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const startMs = Date.now();
    recorder.start(500);

    let renderedKept = 0;
    for (const range of ranges) {
        await playRange(video, range, ctx, width, height, frameTrack, (played) =>
            onProgress?.(Math.min(1, (renderedKept + played) / totalKept))
        );
        renderedKept += range.end - range.start;
    }

    await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
    });
    const durationMs = Date.now() - startMs;
    srcNode?.disconnect();
    audioCtx.close();
    frameTrack.stop();
    URL.revokeObjectURL(video.src);

    return fixWebmDuration(new Blob(chunks, { type: 'video/webm' }), durationMs);
}

async function playRange(
    video: HTMLVideoElement,
    range: { start: number; end: number },
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frameTrack: CanvasCaptureMediaStreamTrack,
    onProgress: (playedInRange: number) => void
): Promise<void> {
    await seekTo(video, range.start);
    await video.play();
    await new Promise<void>((resolve) => {
        const id = setInterval(() => {
            if (video.currentTime >= range.end || video.ended) {
                clearInterval(id);
                video.pause();
                resolve();
                return;
            }
            if (video.readyState >= 2) {
                ctx.drawImage(video, 0, 0, width, height);
                frameTrack.requestFrame();
                onProgress(Math.max(0, video.currentTime - range.start));
            }
        }, 1000 / 30);
    });
}
