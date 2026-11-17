/**
 * A track's frames one by one (MediaStreamTrackProcessor) and a track made of
 * frames written to it (MediaStreamTrackGenerator). Chromium only, and not in
 * TypeScript's DOM typings, so both are narrowed from `unknown` here.
 */

interface TrackProcessor {
    readable: ReadableStream<VideoFrame>;
}
type TrackProcessorConstructor = new (init: { track: MediaStreamTrack }) => TrackProcessor;

interface TrackGenerator extends MediaStreamTrack {
    writable: WritableStream<VideoFrame>;
}
type TrackGeneratorConstructor = new (init: { kind: 'video' }) => TrackGenerator;

function globalConstructor(name: string): unknown {
    const found: unknown = (globalThis as unknown as Record<string, unknown>)[name];
    return typeof found === 'function' ? found : null;
}

/** The frames `track` delivers, as they arrive; null where the browser can't hand them over. */
export function trackFrames(track: MediaStreamTrack): ReadableStream<VideoFrame> | null {
    const Processor = globalConstructor('MediaStreamTrackProcessor');
    return Processor ? new (Processor as TrackProcessorConstructor)({ track }).readable : null;
}

/** A video track showing whatever frames are written to it; null where unsupported. */
export function frameTrack(): {
    track: MediaStreamTrack;
    writable: WritableStream<VideoFrame>;
} | null {
    const Generator = globalConstructor('MediaStreamTrackGenerator');
    if (!Generator) return null;
    const track = new (Generator as TrackGeneratorConstructor)({ kind: 'video' });
    return { track, writable: track.writable };
}

/** Whether frames can be read from a track, drawn in a Worker and written to another. */
export function canProcessInWorker(): boolean {
    return (
        typeof Worker === 'function' &&
        typeof OffscreenCanvas === 'function' &&
        globalConstructor('MediaStreamTrackProcessor') !== null &&
        globalConstructor('MediaStreamTrackGenerator') !== null
    );
}

/** What a dedicated Worker's global scope offers, as far as the workers here use it. */
export interface WorkerScope<In> {
    onmessage: ((event: MessageEvent<In>) => void) | null;
    postMessage(message: unknown): void;
}
