import { effectiveToRawTime, resolveSeekTarget } from '../../src/lib/editorMath';
import type { DeletedRange } from '../../src/lib/types';

import type { Inspection } from './inspect';

/** Largest step between consecutive frames. Throttled or stalled exports show up here. */
export function maxFrameGap(file: Inspection): number {
    const ts = file.frames.map((f) => f.ts).sort((a, b) => a - b);
    let gap = 0;
    for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
    return gap;
}

/** Longest run of consecutive frames showing the same barcode, in seconds: a frozen picture. */
export function longestFreeze(file: Inspection): number {
    let longest = 0;
    let runStart = 0;
    for (let i = 1; i <= file.frames.length; i++) {
        const same =
            i < file.frames.length &&
            file.frames[i].code !== -1 &&
            file.frames[i].code === file.frames[runStart].code;
        if (!same) {
            const end = i < file.frames.length ? file.frames[i].ts : file.frames[i - 1].ts;
            longest = Math.max(longest, end - file.frames[runStart].ts);
            runStart = i;
        }
    }
    return longest;
}

/** Share of the export's video packets found byte-for-byte in the takes. 1 = lossless. */
export function losslessShare(file: Inspection, takes: Inspection[]): number {
    const source = new Set(takes.flatMap((t) => t.packets.map((p) => p.hash)));
    const hits = file.packets.filter((p) => source.has(p.hash)).length;
    return file.packets.length ? hits / file.packets.length : 0;
}

/**
 * Where each take's frames sit on the joined timeline the editor shows: takes
 * back to back, each starting where the previous one's duration ends.
 */
function joinedFrames(takes: Inspection[]): { code: number; joined: number }[] {
    const out: { code: number; joined: number }[] = [];
    let offset = 0;
    for (const take of takes) {
        const first = take.frames[0]?.ts ?? 0;
        for (const f of take.frames) {
            if (f.code !== -1) out.push({ code: f.code, joined: offset + f.ts - first });
        }
        offset += take.duration;
    }
    return out;
}

export interface ContentReport {
    /** Frames whose barcode couldn't be read or matched to a take frame. */
    unmatched: number;
    /** Largest |actual − expected| joined-timeline time over matched frames, seconds. */
    maxError: number;
    /** Frames showing footage from inside a deleted range (beyond `edge` of its ends). */
    deletedShown: number;
}

/**
 * Decode each exported frame's barcode, find the moment of the recording it
 * shows, and compare with where the edit says it should be.
 */
export function checkContent(
    file: Inspection,
    takes: Inspection[],
    deleted: DeletedRange[],
    edge = 0.1
): ContentReport {
    const source = joinedFrames(takes);
    const joinedDuration = takes.reduce((sum, t) => sum + t.duration, 0);
    const first = file.frames[0]?.ts ?? 0;
    let unmatched = 0;
    let maxError = 0;
    let deletedShown = 0;
    for (const f of file.frames) {
        // Barcodes tick every 10 ms; allow a few ticks for the recorder sampling
        // the screen between its paints.
        let best: { code: number; joined: number } | null = null;
        for (const s of source) {
            if (
                Math.abs(s.code - f.code) <= 3 &&
                (!best || Math.abs(s.code - f.code) < Math.abs(best.code - f.code))
            ) {
                best = s;
            }
        }
        if (f.code === -1 || !best) {
            unmatched++;
            continue;
        }
        // effectiveToRawTime maps a kept-range boundary onto the start of the
        // deleted span before it; the editor snaps past it the same way.
        const expected = resolveSeekTarget(
            effectiveToRawTime(f.ts - first, deleted, joinedDuration),
            deleted
        );
        maxError = Math.max(maxError, Math.abs(best.joined - expected));
        if (
            deleted.some((d) => best.joined > d.startTime + edge && best.joined < d.endTime - edge)
        ) {
            deletedShown++;
        }
    }
    return { unmatched, maxError, deletedShown };
}
