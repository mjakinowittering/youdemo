/**
 * Replaces getDisplayMedia with a deterministic canvas "screen". Every frame
 * carries a barcode of its capture time, so a test can decode any exported
 * frame and say exactly which moment of the recording it shows.
 *
 * Runs in the page via addInitScript, so it must be self-contained.
 */

export interface FakeDisplayOptions {
    /** Reject getDisplayMedia as if the user cancelled the picker. */
    cancel?: boolean;
    /**
     * No audio anywhere: audio getUserMedia calls reject, as on a machine with no
     * microphone, and the screen shares no audio. The case behind e6990f1.
     */
    noMic?: boolean;
    /** Screen size per getDisplayMedia call, cycling; defaults to WIDTH × HEIGHT. */
    sizes?: [number, number][];
}

export const WIDTH = 1280;
export const HEIGHT = 720;
/** Barcode layout, as fractions of the frame, shared with the reader in inspect.ts. */
export const BARCODE = { bits: 16, x0: 0.02, width: 0.64, y: 0.88 } as const;
/** One barcode unit = 10 ms of capture time; 16 bits wrap after ~11 minutes. */
export const CODE_MS = 10;

export interface FakeDisplayHandle {
    /** End the screen track the way the browser's "Stop sharing" bar does. */
    stopSharing(): void;
}

declare global {
    interface Window {
        __e2eDisplay?: FakeDisplayHandle;
    }
}

export function installFakeDisplay(
    opts: FakeDisplayOptions & {
        width: number;
        height: number;
        barcode: typeof BARCODE;
        codeMs: number;
    }
): void {
    const { barcode, codeMs } = opts;
    let calls = 0;
    const origin = performance.now();
    const tracks: MediaStreamTrack[] = [];

    window.__e2eDisplay = {
        stopSharing() {
            for (const t of tracks) {
                t.stop();
                // stop() alone never fires 'ended'; the browser's bar does.
                t.dispatchEvent(new Event('ended'));
            }
        }
    };

    function paint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const ms = performance.now() - origin;
        const code = Math.floor(ms / codeMs) & 0xffff;
        ctx.fillStyle = '#404040';
        ctx.fillRect(0, 0, width, height);
        // A sweeping bar, so motion is obvious to a human looking at a failure.
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(((ms / 4) % (width * 0.6)) | 0, height * 0.3, 40, height * 0.3);
        const block = (barcode.width * width) / barcode.bits;
        const top = barcode.y * height - block / 2;
        for (let i = 0; i < barcode.bits; i++) {
            const on = (code >> (barcode.bits - 1 - i)) & 1;
            ctx.fillStyle = on ? '#ffffff' : '#000000';
            ctx.fillRect(barcode.x0 * width + i * block, top, block, block);
        }
    }

    const md = navigator.mediaDevices;
    const realGetUserMedia = md.getUserMedia.bind(md);

    md.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
        if (opts.cancel) throw new DOMException('Permission denied', 'NotAllowedError');
        const canvas = document.createElement('canvas');
        const [width, height] = opts.sizes?.[calls++ % opts.sizes.length] ?? [
            opts.width,
            opts.height
        ];
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false })!;
        paint(ctx, width, height);
        const stream = canvas.captureStream(30);
        const id = setInterval(() => paint(ctx, width, height), 1000 / 30);
        const video = stream.getVideoTracks()[0];
        video.addEventListener('ended', () => clearInterval(id));
        tracks.length = 0;
        tracks.push(video);
        if (constraints?.audio && !opts.noMic) {
            const audio = new AudioContext();
            const osc = audio.createOscillator();
            const dest = audio.createMediaStreamDestination();
            osc.connect(dest);
            osc.start();
            const track = dest.stream.getAudioTracks()[0];
            stream.addTrack(track);
            tracks.push(track);
        }
        return stream;
    };

    md.getUserMedia = async (constraints?: MediaStreamConstraints) => {
        if (opts.noMic && constraints?.audio) {
            throw new DOMException('Requested device not found', 'NotFoundError');
        }
        return realGetUserMedia(constraints);
    };
}
