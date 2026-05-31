import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface DeletedRange {
    startTime: number;
    endTime: number;
}

interface ExportOptions {
    segments: Blob[];
    deletedRanges: DeletedRange[];
    totalDuration: number;
}

function getKeptRanges(
    duration: number,
    deletedRanges: DeletedRange[]
): { start: number; end: number }[] {
    const sorted = [...deletedRanges].sort((a, b) => a.startTime - b.startTime);
    const kept: { start: number; end: number }[] = [];
    let cursor = 0;

    for (const del of sorted) {
        if (cursor < del.startTime) {
            kept.push({ start: cursor, end: del.startTime });
        }
        cursor = del.endTime;
    }

    if (cursor < duration) {
        kept.push({ start: cursor, end: duration });
    }

    return kept;
}

async function loadFFmpeg(): Promise<FFmpeg> {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
    console.log('[FFmpegConverter] FFmpeg core loaded');
    return ffmpeg;
}

export async function convertVideo(options: ExportOptions): Promise<Blob> {
    const { segments, deletedRanges, totalDuration } = options;
    const hasCuts = deletedRanges && deletedRanges.length > 0;
    const multipleSegments = segments.length > 1;

    // ── Tier 1: Single segment, no cuts — return raw blob instantly ──
    if (!hasCuts && !multipleSegments) {
        console.log('[FFmpegConverter] Tier 1: No edits — returning raw blob instantly');
        return segments[0];
    }

    const ffmpeg = await loadFFmpeg();

    // Write all segment blobs to virtual FS
    for (let i = 0; i < segments.length; i++) {
        await ffmpeg.writeFile(`seg${i}.webm`, await fetchFile(segments[i]));
        console.log(`[FFmpegConverter] Segment ${i} written — ${segments[i].size} bytes`);
    }

    // ── Tier 2: Multiple segments, no cuts — concat with stream copy ──
    if (!hasCuts && multipleSegments) {
        console.log('[FFmpegConverter] Tier 2: Multi-segment concat — stream copy');

        const concatList = segments.map((_, i) => `file 'seg${i}.webm'`).join('\n');
        const encoder = new TextEncoder();
        await ffmpeg.writeFile('concat.txt', encoder.encode(concatList));

        await ffmpeg.exec([
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'concat.txt',
            '-c',
            'copy',
            'output.webm'
        ]);

        const data = (await ffmpeg.readFile('output.webm')) as unknown as Uint8Array<ArrayBuffer>;
        console.log('[FFmpegConverter] Tier 2 complete — output size:', data.length);
        return new Blob([data], { type: 'video/webm' });
    }

    // ── Tier 3: Cuts present ──
    console.log('[FFmpegConverter] Tier 3: Cuts present — stream copy trim');

    const keptRanges = getKeptRanges(totalDuration, deletedRanges);
    console.log('[FFmpegConverter] Kept ranges:', JSON.stringify(keptRanges));

    if (keptRanges.length === 0) {
        throw new Error('All content deleted — nothing to export');
    }

    // Step 1: If multiple segments, concat them first
    let sourceFile = 'seg0.webm';
    if (multipleSegments) {
        const concatList = segments.map((_, i) => `file 'seg${i}.webm'`).join('\n');
        const encoder = new TextEncoder();
        await ffmpeg.writeFile('concat.txt', encoder.encode(concatList));

        await ffmpeg.exec([
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'concat.txt',
            '-c',
            'copy',
            'combined.webm'
        ]);
        sourceFile = 'combined.webm';
        console.log('[FFmpegConverter] Segments concatenated into combined.webm');
    }

    // Step 2: Extract each kept range as a separate file using stream copy
    const keptFiles: string[] = [];
    for (let i = 0; i < keptRanges.length; i++) {
        const range = keptRanges[i];
        const outFile = `kept${i}.webm`;
        const duration = range.end - range.start;
        console.log(
            `[FFmpegConverter] Extracting range ${i}: start=${range.start}s duration=${duration}s → ${outFile}`
        );

        await ffmpeg.exec([
            '-i',
            sourceFile,
            '-ss',
            String(range.start),
            '-t',
            String(duration),
            '-c',
            'copy',
            '-avoid_negative_ts',
            'make_zero',
            outFile
        ]);

        keptFiles.push(outFile);
    }

    // Step 3: If only one kept range, that's our output
    if (keptFiles.length === 1) {
        const data = (await ffmpeg.readFile(keptFiles[0])) as unknown as Uint8Array<ArrayBuffer>;
        console.log('[FFmpegConverter] Single range — output size:', data.length);
        return new Blob([data], { type: 'video/webm' });
    }

    // Step 4: Concat all kept ranges into final output
    const finalConcatList = keptFiles.map((f) => `file '${f}'`).join('\n');
    const encoder = new TextEncoder();
    await ffmpeg.writeFile('finalconcat.txt', encoder.encode(finalConcatList));

    await ffmpeg.exec([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        'finalconcat.txt',
        '-c',
        'copy',
        'output.webm'
    ]);

    const data = (await ffmpeg.readFile('output.webm')) as unknown as Uint8Array<ArrayBuffer>;
    console.log('[FFmpegConverter] Tier 3 complete — output size:', data.length);
    return new Blob([data], { type: 'video/webm' });
}
