import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface DeletedRange {
    startTime: number;
    endTime: number;
}

export interface ExportOptions {
    segments: Blob[];
    deletedRanges: DeletedRange[];
    totalDuration: number;
    /** Same-origin base URL for the locally-vendored FFmpeg core (no CDN). */
    coreBaseURL: string;
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

// Canonical export frame. Independently-recorded segments can differ in size
// (e.g. a resumed capture of a different tab), so everything is normalised to a
// common frame before concatenation. Kept at 720p to keep the per-segment VP8
// re-encode within ffmpeg.wasm's heap — 1080p overruns it ("memory access out of
// bounds"). Only multi-segment exports re-encode; single-segment stays native.
const TARGET_W = 1280;
const TARGET_H = 720;

async function loadFFmpeg(coreBaseURL: string): Promise<FFmpeg> {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
        coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
    return ffmpeg;
}

/**
 * Concatenate `count` segments (seg0.webm…) into `outFile`.
 *
 * Stream-copy concat of the raw MediaRecorder blobs silently drops all but the
 * first segment (differing resolution/codec params, independent timestamps). The
 * fix is to re-encode, but doing it in one multi-input `filter_complex` decodes
 * every segment at once and, with VP9, overruns ffmpeg.wasm's heap
 * ("memory access out of bounds"). So instead:
 *   1. Normalise each segment ONE AT A TIME to a common frame using VP8 (libvpx)
 *      — only one decoder/encoder is alive at a time, and VP8 is far lighter than
 *      VP9 in WASM.
 *   2. Stream-copy concat the now-uniform files — reliable because they share
 *      identical codec params and timebase.
 */
/** Runs an ffmpeg command and throws (with the ffmpeg log tail) on non-zero exit. */
type Runner = (args: string[], step: string) => Promise<void>;

async function concatSegments(
    ffmpeg: FFmpeg,
    run: Runner,
    count: number,
    outFile: string
): Promise<void> {
    const normalized: string[] = [];
    for (let i = 0; i < count; i++) {
        const out = `norm${i}.webm`;
        // Force identical video AND audio params (resolution, fps, SAR, 48k stereo)
        // so the stream-copy concat below can't mismatch — independently-recorded
        // tabs can otherwise differ in audio channels/sample rate.
        await run(
            [
                '-i',
                `seg${i}.webm`,
                '-vf',
                `fps=30,scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,` +
                    `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,
                '-c:v',
                'libvpx',
                '-b:v',
                '5M',
                '-deadline',
                'realtime',
                '-cpu-used',
                '8',
                '-g',
                '30',
                '-c:a',
                'libopus',
                '-b:a',
                '128k',
                '-ar',
                '48000',
                '-ac',
                '2',
                out
            ],
            `normalise segment ${i}`
        );
        normalized.push(out);
    }

    const list = normalized.map((f) => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(list));
    await run(
        ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', outFile],
        'concat segments'
    );
}

export async function convertVideo(options: ExportOptions): Promise<Blob> {
    const { segments, deletedRanges, totalDuration, coreBaseURL } = options;
    const hasCuts = deletedRanges && deletedRanges.length > 0;
    const multipleSegments = segments.length > 1;

    // ── Tier 1: Single segment, no cuts — return raw blob instantly ──
    if (!hasCuts && !multipleSegments) {
        return segments[0];
    }

    const ffmpeg = await loadFFmpeg(coreBaseURL);

    // Capture the ffmpeg log tail so a failed step reports the real reason, not
    // just a generic exit code.
    const logTail: string[] = [];
    ffmpeg.on('log', ({ message }) => {
        logTail.push(message);
        if (logTail.length > 60) logTail.shift();
    });
    const run: Runner = async (args, step) => {
        let code: number;
        try {
            code = await ffmpeg.exec(args);
        } catch (err) {
            // A WASM heap overrun rejects exec (e.g. "memory access out of bounds")
            // rather than returning a non-zero code — surface which step and the log.
            throw new Error(
                `FFmpeg step "${step}" crashed: ${err}\n${logTail.slice(-25).join('\n')}`,
                { cause: err }
            );
        }
        if (code !== 0) {
            throw new Error(
                `FFmpeg step "${step}" failed (exit ${code}).\n${logTail.slice(-25).join('\n')}`
            );
        }
    };

    // Write all segment blobs to virtual FS
    for (let i = 0; i < segments.length; i++) {
        await ffmpeg.writeFile(`seg${i}.webm`, await fetchFile(segments[i]));
    }

    // ── Tier 2: Multiple segments, no cuts — re-encode concat ──
    if (!hasCuts && multipleSegments) {
        await concatSegments(ffmpeg, run, segments.length, 'output.webm');
        const data = (await ffmpeg.readFile('output.webm')) as unknown as Uint8Array<ArrayBuffer>;
        return new Blob([data], { type: 'video/webm' });
    }

    // ── Tier 3: Cuts present ──
    const keptRanges = getKeptRanges(totalDuration, deletedRanges);

    if (keptRanges.length === 0) {
        throw new Error('All content deleted — nothing to export');
    }

    // Step 1: If multiple segments, join them into one normalised source first
    let sourceFile = 'seg0.webm';
    if (multipleSegments) {
        await concatSegments(ffmpeg, run, segments.length, 'combined.webm');
        sourceFile = 'combined.webm';
    }

    // Step 2: Extract each kept range as a separate file using stream copy
    const keptFiles: string[] = [];
    for (let i = 0; i < keptRanges.length; i++) {
        const range = keptRanges[i];
        const outFile = `kept${i}.webm`;
        const duration = range.end - range.start;

        await run(
            [
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
            ],
            `trim kept range ${i}`
        );

        keptFiles.push(outFile);
    }

    // Step 3: If only one kept range, that's our output
    if (keptFiles.length === 1) {
        const data = (await ffmpeg.readFile(keptFiles[0])) as unknown as Uint8Array<ArrayBuffer>;
        return new Blob([data], { type: 'video/webm' });
    }

    // Step 4: Concat all kept ranges into final output
    const finalConcatList = keptFiles.map((f) => `file '${f}'`).join('\n');
    const encoder = new TextEncoder();
    await ffmpeg.writeFile('finalconcat.txt', encoder.encode(finalConcatList));

    await run(
        ['-f', 'concat', '-safe', '0', '-i', 'finalconcat.txt', '-c', 'copy', 'output.webm'],
        'concat kept ranges'
    );

    const data = (await ffmpeg.readFile('output.webm')) as unknown as Uint8Array<ArrayBuffer>;
    return new Blob([data], { type: 'video/webm' });
}
