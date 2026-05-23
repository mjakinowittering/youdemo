import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ExportOptions, CutRegion } from './recorder.js';

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/';

let _ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
    if (_ffmpeg?.loaded) return _ffmpeg;
    console.log('[FFmpegConverter] 5. Loading FFmpeg core from', CORE_BASE);
    _ffmpeg = new FFmpeg();
    await _ffmpeg.load({
        coreURL: `${CORE_BASE}ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}ffmpeg-core.wasm`
    });
    console.log('[FFmpegConverter] 6. FFmpeg core loaded');
    return _ffmpeg;
}

function buildFilterComplex(
    n: number,
    trimStart: number,
    trimEnd: number,
    duration: number,
    cuts: CutRegion[]
): { filterComplex: string; vout: string; aout: string } {
    const parts: string[] = [];
    let vLabel = '0:v';
    let aLabel = '0:a';

    // Concat multiple segments
    if (n > 1) {
        const vInputs = Array.from({ length: n }, (_, i) => `[${i}:v]`).join('');
        const aInputs = Array.from({ length: n }, (_, i) => `[${i}:a]`).join('');
        parts.push(`${vInputs}${aInputs}concat=n=${n}:v=1:a=1[cv][ca]`);
        vLabel = 'cv';
        aLabel = 'ca';
    }

    // Trim
    const needsTrim = trimStart > 0 || (trimEnd > 0 && trimEnd < duration);
    if (needsTrim) {
        const end = trimEnd > 0 && trimEnd < duration ? trimEnd : duration;
        parts.push(`[${vLabel}]trim=start=${trimStart}:end=${end},setpts=PTS-STARTPTS[tv]`);
        parts.push(`[${aLabel}]atrim=start=${trimStart}:end=${end},asetpts=PTS-STARTPTS[ta]`);
        vLabel = 'tv';
        aLabel = 'ta';
    }

    // Cut regions
    if (cuts.length > 0) {
        const between = cuts.map((c) => `between(t,${c.start},${c.end})`).join('+');
        parts.push(`[${vLabel}]select=not(${between}),setpts=N/FRAME_RATE/TB[kv]`);
        parts.push(`[${aLabel}]aselect=not(${between}),asetpts=N/SR/TB[ka]`);
        vLabel = 'kv';
        aLabel = 'ka';
    }

    // If nothing was added, create passthrough labels
    if (parts.length === 0) {
        parts.push(`[0:v]null[vout]`);
        parts.push(`[0:a]anull[aout]`);
        return { filterComplex: parts.join(';'), vout: 'vout', aout: 'aout' };
    }

    // Rename final labels to vout/aout
    parts.push(`[${vLabel}]null[vout]`);
    parts.push(`[${aLabel}]anull[aout]`);

    return { filterComplex: parts.join(';'), vout: 'vout', aout: 'aout' };
}

export async function convert(
    options: ExportOptions,
    onProgress?: (percent: number) => void
): Promise<Blob> {
    const { segments, trimStart, trimEnd, cuts } = options;
    const ffmpeg = await getFFmpeg();

    const progressHandler = ({ progress }: { progress: number }) => {
        onProgress?.(Math.round(Math.min(progress, 1) * 100));
    };
    ffmpeg.on('progress', progressHandler);

    const inputFiles: string[] = [];
    try {
        // Write all segment blobs to virtual FS
        for (let i = 0; i < segments.length; i++) {
            const name = `seg${i}.webm`;
            console.log('[FFmpegConverter] 7. Writing segment', i, '— size:', segments[i].size, 'bytes');
            await ffmpeg.writeFile(name, await fetchFile(segments[i]));
            inputFiles.push(name);
        }
        console.log('[FFmpegConverter] 8. All segments written to virtual FS');

        // Estimate total duration for trim calculations
        // trimEnd = 0 means "no trim end" — treat as infinity placeholder
        const estimatedDuration = trimEnd > 0 ? trimEnd + 60 : 86400;

        const { filterComplex, vout, aout } = buildFilterComplex(
            segments.length,
            trimStart,
            trimEnd,
            estimatedDuration,
            cuts
        );

        const inputArgs = inputFiles.flatMap((f) => ['-i', f]);
        const ffmpegArgs = [
            ...inputArgs,
            '-filter_complex',
            filterComplex,
            '-map',
            `[${vout}]`,
            '-map',
            `[${aout}]`,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-movflags',
            '+faststart',
            'output.mp4'
        ];
        console.log('[FFmpegConverter] 9. FFmpeg command:', ffmpegArgs.join(' '));
        await ffmpeg.exec(ffmpegArgs);
        console.log('[FFmpegConverter] 10. FFmpeg command complete');

        const data = (await ffmpeg.readFile('output.mp4')) as unknown as Uint8Array<ArrayBuffer>;
        console.log('[FFmpegConverter] 11. Output read — size:', data?.length, 'bytes');
        return new Blob([data], { type: 'video/mp4' });
    } finally {
        ffmpeg.off('progress', progressHandler);
        // Clean up virtual FS
        for (const f of inputFiles) {
            try {
                await ffmpeg.deleteFile(f);
            } catch {
                /* ignore */
            }
        }
        try {
            await ffmpeg.deleteFile('output.mp4');
        } catch {
            /* ignore */
        }
    }
}
