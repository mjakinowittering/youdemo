import { convert } from './ffmpegConverter.js';
import type { ExportOptions } from './recorder.js';

self.onmessage = async (e: MessageEvent<ExportOptions>) => {
    try {
        console.log('[FFmpegWorker] 1. Worker received message');
        console.log('[FFmpegWorker] 2. Segments:', e.data.segments?.length, 'sizes:', e.data.segments?.map((s: Blob) => s.size));
        console.log('[FFmpegWorker] 3. Trim:', e.data.trimStart, e.data.trimEnd);
        console.log('[FFmpegWorker] 4. Cuts:', e.data.cuts);

        const blob = await convert(e.data, (percent) => {
            self.postMessage({ type: 'progress', percent });
        });
        self.postMessage({ type: 'complete', blob });
    } catch (err) {
        console.error('[FFmpegWorker] FAILED:', err);
        self.postMessage({ type: 'error', message: String(err) });
    }
};
