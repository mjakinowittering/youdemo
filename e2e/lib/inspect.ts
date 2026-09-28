import { BARCODE } from '../fixtures/fakeDisplay';
import type { Page } from '@playwright/test';
import type * as MB from 'mediabunny';

/** Everything the checks need to know about one WebM, gathered in the browser. */
export interface Inspection {
    /** `<video>` duration after metadata; NaN if it never loaded. */
    duration: number;
    /** MediaError message if a `<video>` refused the file, else null. */
    playError: string | null;
    /** The file carries a Cues (seek index) element. */
    hasCues: boolean;
    width: number;
    height: number;
    /** Video packets in decode order. */
    packets: { ts: number; key: boolean; hash: string }[];
    audio: { packets: number; start: number; end: number } | null;
    /** Every decoded frame, presentation order, with its barcode (-1 if unreadable). */
    frames: { ts: number; code: number }[];
    /** A `<video>` seek to mid-file: target time and the barcode it landed on. */
    seek: { target: number; code: number } | null;
}

declare const Mediabunny: typeof MB;

// Serialised into the page by page.evaluate, so it must be self-contained.
async function inspectInPage(args: { url: string; barcode: typeof BARCODE }): Promise<Inspection> {
    const { url, barcode } = args;
    const blob = await (await fetch(url)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());

    function readCode(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): number {
        const block = (barcode.width * w) / barcode.bits;
        const y = Math.round(barcode.y * h);
        let code = 0;
        for (let i = 0; i < barcode.bits; i++) {
            const x = Math.round(barcode.x0 * w + (i + 0.5) * block);
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            const lum = (r + g + b) / 3;
            // Anything mid-grey means the block is smeared: unreadable.
            if (lum > 64 && lum < 192) return -1;
            code = (code << 1) | (lum >= 128 ? 1 : 0);
        }
        return code;
    }

    async function sha(data: Uint8Array): Promise<string> {
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
        return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    // EBML ID of the Cues element.
    const cuesId = [0x1c, 0x53, 0xbb, 0x6b];
    let hasCues = false;
    for (let i = 0; i < bytes.length - 3 && !hasCues; i++) {
        hasCues = cuesId.every((b, j) => bytes[i + j] === b);
    }

    const input = new Mediabunny.Input({
        source: new Mediabunny.BlobSource(blob),
        formats: Mediabunny.ALL_FORMATS
    });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('no video track');
    const width = videoTrack.displayWidth;
    const height = videoTrack.displayHeight;

    const packets: Inspection['packets'] = [];
    for await (const p of new Mediabunny.EncodedPacketSink(videoTrack).packets()) {
        packets.push({ ts: p.timestamp, key: p.type === 'key', hash: await sha(p.data) });
    }

    let audio: Inspection['audio'] = null;
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack) {
        let n = 0;
        let start = Infinity;
        let end = -Infinity;
        for await (const p of new Mediabunny.EncodedPacketSink(audioTrack).packets()) {
            n++;
            start = Math.min(start, p.timestamp);
            end = Math.max(end, p.timestamp + p.duration);
        }
        audio = { packets: n, start, end };
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const frames: Inspection['frames'] = [];
    for await (const sample of new Mediabunny.VideoSampleSink(videoTrack).samples()) {
        sample.draw(ctx, 0, 0, width, height);
        frames.push({ ts: sample.timestamp, code: readCode(ctx, width, height) });
        sample.close();
    }

    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(blob);
    const loaded = await new Promise<boolean>((resolve) => {
        video.onloadeddata = () => resolve(true);
        video.onerror = () => resolve(false);
    });
    let seek: Inspection['seek'] = null;
    if (loaded && Number.isFinite(video.duration)) {
        const target = video.duration / 2;
        video.currentTime = target;
        await new Promise((resolve) => (video.onseeked = resolve));
        ctx.drawImage(video, 0, 0, width, height);
        seek = { target, code: readCode(ctx, width, height) };
    }
    const result: Inspection = {
        duration: loaded ? video.duration : NaN,
        playError: video.error ? video.error.message || `code ${video.error.code}` : null,
        hasCues,
        width,
        height,
        packets,
        audio,
        frames,
        seek
    };
    URL.revokeObjectURL(video.src);
    return result;
}

/**
 * A bare page in the app's origin with Mediabunny loaded, used to inspect
 * files. Separate from the app page so the app itself carries no test code.
 */
export class Inspector {
    private files = new Map<string, Buffer>();
    private next = 0;

    private constructor(private page: Page) {}

    static async open(page: Page): Promise<Inspector> {
        const inspector = new Inspector(page);
        await page.route('**/__e2e__/**', (route) => {
            const name = new URL(route.request().url()).pathname.split('/').pop()!;
            const body = inspector.files.get(name);
            if (name === 'inspect') {
                return route.fulfill({ contentType: 'text/html', body: '<!doctype html>' });
            }
            if (!body) return route.fulfill({ status: 404 });
            return route.fulfill({ contentType: 'video/webm', body });
        });
        await page.goto('__e2e__/inspect');
        await page.addScriptTag({ path: 'node_modules/mediabunny/dist/bundles/mediabunny.cjs' });
        return inspector;
    }

    async inspect(file: Buffer): Promise<Inspection> {
        const name = `file-${this.next++}.webm`;
        this.files.set(name, file);
        try {
            return await this.page.evaluate(inspectInPage, {
                url: `./${name}`,
                barcode: BARCODE
            });
        } finally {
            this.files.delete(name);
        }
    }
}
