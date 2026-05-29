import { convert } from './ffmpegConverter.js';
import type { ExportOptions } from './recorder.js';

self.onmessage = async (e: MessageEvent<ExportOptions>) => {
    try {
        console.log('[FFmpegWorker] 1. Worker received message');
        console.log(
            '[FFmpegWorker] 2. Segments:',
            e.data.segments?.length,
            'sizes:',
            e.data.segments?.map((s: Blob) => s.size)
        );
        console.log('[FFmpegWorker] 3. DeletedRanges:', e.data.deletedRanges);
        console.log('[FFmpegWorker] 4. TotalDuration:', e.data.totalDuration);

        const blob = await convert(e.data, (percent) => {
            self.postMessage({ type: 'progress', percent });
        });
        self.postMessage({ type: 'complete', blob });
    } catch (err) {
        console.error('[FFmpegWorker] FAILED:', err);
        self.postMessage({ type: 'error', message: String(err) });
    }
};
