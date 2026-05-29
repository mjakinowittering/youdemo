import type { DeletedRange, ExportOptions } from './recorder.js';

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/';

let _ffmpeg: import('@ffmpeg/ffmpeg').FFmpeg | null = null;

async function getFFmpeg(): Promise<import('@ffmpeg/ffmpeg').FFmpeg> {
    if (_ffmpeg?.loaded) return _ffmpeg;
    console.log('[FFmpegConverter] Loading FFmpeg core from', CORE_BASE);
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    _ffmpeg = new FFmpeg();
    await _ffmpeg.load({
        coreURL: `${CORE_BASE}ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}ffmpeg-core.wasm`
    });
    console.log('[FFmpegConverter] FFmpeg core loaded');
    return _ffmpeg;
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
        cursor = Math.max(cursor, del.endTime);
    }

    if (cursor < duration) {
        kept.push({ start: cursor, end: duration });
    }

    return kept;
}

export async function convert(
    options: ExportOptions,
    onProgress?: (percent: number) => void
): Promise<Blob> {
    const { segments, deletedRanges, totalDuration } = options;
    const hasCuts = deletedRanges && deletedRanges.length > 0;
    const multipleSegments = segments.length > 1;

    // Tier 1: No cuts, single segment — return raw blob instantly
    if (!hasCuts && !multipleSegments) {
        console.log('[FFmpegConverter] Tier 1: No edits — returning raw blob');
        onProgress?.(100);
        return segments[0];
    }

    const ffmpeg = await getFFmpeg();
    onProgress?.(10);

    const progressHandler = ({ progress }: { progress: number }) => {
        // Map FFmpeg progress (0–1) into 20–100 range
        onProgress?.(Math.round(20 + Math.min(progress, 1) * 80));
    };
    ffmpeg.on('progress', progressHandler);

    const { fetchFile } = await import('@ffmpeg/util');
    const inputFiles: string[] = [];

    try {
        for (let i = 0; i < segments.length; i++) {
            const name = `seg${i}.webm`;
            console.log('[FFmpegConverter] Writing segment', i, '— size:', segments[i].size, 'bytes');
            await ffmpeg.writeFile(name, await fetchFile(segments[i]));
            inputFiles.push(name);
        }
        onProgress?.(20);

        // Tier 2: Multiple segments, no cuts — concat with scale to 1280x720
        if (!hasCuts && multipleSegments) {
            console.log('[FFmpegConverter] Tier 2: Multi-segment concat — scale to 1280x720 VP9');
            const concatList = segments.map((_, i) => `file 'seg${i}.webm'`).join('\n');
            await ffmpeg.writeFile('concat.txt', concatList);
            console.log('[FFmpegConverter] Output: 1280x720 VP9 WebM');

            await ffmpeg.exec([
                '-f', 'concat',
                '-safe', '0',
                '-i', 'concat.txt',
                '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                '-c:v', 'libvpx',
                '-b:v', '2M',
                '-deadline', 'realtime',
                '-cpu-used', '8',
                '-threads', '1',
                '-c:a', 'libopus',
                '-b:a', '128k',
                'output.webm'
            ]);
        }

        // Tier 3: Cuts present
        if (hasCuts) {
            let inputFile = 'seg0.webm';

            // If multiple segments, concat them first with stream copy
            if (multipleSegments) {
                console.log('[FFmpegConverter] Tier 3: Multi-segment with cuts — concat then cut');
                const concatList = segments.map((_, i) => `file 'seg${i}.webm'`).join('\n');
                await ffmpeg.writeFile('concat.txt', concatList);

                await ffmpeg.exec([
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', 'concat.txt',
                    '-c', 'copy',
                    'combined.webm'
                ]);
                inputFile = 'combined.webm';
                inputFiles.push('combined.webm');
            } else {
                console.log('[FFmpegConverter] Tier 3: Single segment with cuts');
            }

            const keptRanges = getKeptRanges(totalDuration, deletedRanges);
            console.log('[FFmpegConverter] Kept ranges:', keptRanges);

            if (keptRanges.length === 0) {
                throw new Error('All content deleted — nothing to export');
            }

            // Single kept range with no split needed
            if (keptRanges.length === 1) {
                const r = keptRanges[0];
                const isFullRange = r.start === 0 && r.end >= totalDuration;

                if (isFullRange) {
                    // No actual cutting needed — stream copy
                    await ffmpeg.exec(['-i', inputFile, '-c', 'copy', 'output.webm']);
                } else {
                    const filterComplex = [
                        `[0:v]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[vout]`,
                        `[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[aout]`
                    ].join(';');
                    console.log('[FFmpegConverter] filter_complex:', filterComplex);
                    console.log('[FFmpegConverter] Output: 1280x720 VP9 WebM');

                    await ffmpeg.exec([
                        '-i', inputFile,
                        '-filter_complex', filterComplex,
                        '-map', '[vout]',
                        '-map', '[aout]',
                        '-c:v', 'libvpx-vp9',
                        '-b:v', '2M',
                        '-deadline', 'realtime',
                        '-cpu-used', '8',
                        '-c:a', 'libopus',
                        '-b:a', '128k',
                        'output.webm'
                    ]);
                }
            } else {
                // Multiple kept ranges — split, trim each, concat
                const parts: string[] = [];
                parts.push(`[0:v]split=${keptRanges.length}${keptRanges.map((_, i) => `[vs${i}]`).join('')}`);
                parts.push(`[0:a]asplit=${keptRanges.length}${keptRanges.map((_, i) => `[as${i}]`).join('')}`);

                for (let i = 0; i < keptRanges.length; i++) {
                    const r = keptRanges[i];
                    parts.push(`[vs${i}]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS[v${i}]`);
                    parts.push(`[as${i}]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[a${i}]`);
                }

                const concatInputs = keptRanges.map((_, i) => `[v${i}][a${i}]`).join('');
                parts.push(`${concatInputs}concat=n=${keptRanges.length}:v=1:a=1[cv][ca]`);
                parts.push(`[cv]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[vout]`);
                parts.push(`[ca]anull[aout]`);

                const filterComplex = parts.join(';');
                console.log('[FFmpegConverter] filter_complex:', filterComplex);
                console.log('[FFmpegConverter] Output: 1280x720 VP9 WebM');

                await ffmpeg.exec([
                    '-i', inputFile,
                    '-filter_complex', filterComplex,
                    '-map', '[vout]',
                    '-map', '[aout]',
                    '-c:v', 'libvpx-vp9',
                    '-b:v', '2M',
                    '-deadline', 'realtime',
                    '-cpu-used', '8',
                    '-c:a', 'libopus',
                    '-b:a', '128k',
                    'output.webm'
                ]);
            }
        }

        console.log('[FFmpegConverter] Reading output.webm from virtual FS');
        const data = (await ffmpeg.readFile('output.webm')) as unknown as Uint8Array<ArrayBuffer>;
        console.log('[FFmpegConverter] Output size:', data?.length, 'bytes');
        return new Blob([data], { type: 'video/webm' });
    } finally {
        ffmpeg.off('progress', progressHandler);
        for (const f of [...inputFiles, 'concat.txt', 'output.webm']) {
            try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
        }
    }
}
