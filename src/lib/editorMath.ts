/**
 * Pure timeline / edit-math for the Editor, extracted so it can be unit-tested
 * without a browser (no DOM, no video element). The Editor shell and its
 * sub-components consume these from `$derived`; the browser-bound orchestration
 * (video element, thumbnail generation, seeking) stays in the components.
 */
import type { DeletedRange } from './types.js';

/** One thing in the frame strip: a frame, or the marker where a cut was made. */
export type StripItem =
    | {
          kind: 'frame';
          /** The 0.2 s cell it starts at, which keys its thumbnail. */
          cell: number;
          /** Not generated yet: drawn as a skeleton. */
          thumb: string | null;
          current: boolean;
          /** Selected for removal while trimming. */
          marked: boolean;
      }
    | { kind: 'cut'; cut: number; seconds: number };

/** Frame-strip layout constants — shared by the Editor shell and FrameStrip. */
export const FRAME_RATE = 30;
export const SAMPLE_INTERVAL = 0.2;
export const CELL_WIDTH = 80;
export const CELL_HEIGHT = 64;
export const CELL_GAP = 3;
export const CELL_STRIDE = CELL_WIDTH + CELL_GAP;
/** A cut marker: 3px wide, 4px margins, then the strip's gap. */
export const CUT_STRIDE = 3 + 4 + 4 + CELL_GAP;

/** `mm:ss` clock formatting. */
export function formatTime(s: number): string {
    const m = Math.floor(s / 60)
        .toString()
        .padStart(2, '0');
    const sec = Math.floor(s % 60)
        .toString()
        .padStart(2, '0');
    return `${m}:${sec}`;
}

/**
 * Total kept duration = raw duration minus the sum of deleted spans, each counted
 * only within the recording (a cut of the last frame can run past its end).
 */
export function computeEffectiveDuration(
    videoDuration: number,
    deletedRanges: DeletedRange[]
): number {
    return Math.max(
        0,
        videoDuration -
            deletedRanges.reduce(
                (sum, r) =>
                    sum +
                    Math.max(0, Math.min(r.endTime, videoDuration) - Math.max(0, r.startTime)),
                0
            )
    );
}

/** Raw playhead time mapped into the kept timeline (deleted spans before it removed). */
export function computeEffectiveCurrentTime(
    currentTime: number,
    deletedRanges: DeletedRange[]
): number {
    const deletedBefore = deletedRanges
        .filter((r) => r.endTime <= currentTime)
        .reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
    return Math.max(0, currentTime - deletedBefore);
}

/** Inverse of {@link computeEffectiveCurrentTime}: kept-timeline time → raw time. */
export function effectiveToRawTime(
    effectiveTime: number,
    deletedRanges: DeletedRange[],
    duration: number
): number {
    let remaining = effectiveTime;
    const sorted = [...deletedRanges].sort((a, b) => a.startTime - b.startTime);
    let cursor = 0;
    for (const del of sorted) {
        const keptDuration = del.startTime - cursor;
        // Strictly less: a time landing on a cut's start belongs to the kept
        // frame after the cut, not to the cut itself.
        if (remaining < keptDuration) {
            return cursor + remaining;
        }
        remaining -= keptDuration;
        cursor = del.endTime;
    }
    return Math.min(cursor + remaining, duration);
}

/**
 * If `targetTime` lands inside a deleted span, snap it forward to the span's end
 * (the kept frame that follows). Pure — the caller performs the DOM seek.
 */
export function resolveSeekTarget(targetTime: number, deletedRanges: DeletedRange[]): number {
    for (const range of deletedRanges) {
        if (targetTime >= range.startTime && targetTime < range.endTime) {
            return range.endTime;
        }
    }
    return targetTime;
}

/** Number of sample cells for a clip of the given duration. */
export function computeCellCount(videoDuration: number, sampleInterval = SAMPLE_INTERVAL): number {
    return Number.isFinite(videoDuration) && videoDuration > 0
        ? Math.round(videoDuration / sampleInterval)
        : 0;
}

/** Set of original cell indices that fall inside a deleted span. */
export function computeDeletedCells(
    cellCount: number,
    deletedRanges: DeletedRange[],
    sampleInterval = SAMPLE_INTERVAL
): Set<number> {
    return new Set(
        Array.from({ length: cellCount }, (_, i) => i).filter((i) => {
            const t = i * sampleInterval;
            return deletedRanges.some((r) => t >= r.startTime && t < r.endTime);
        })
    );
}

/** Original cell indices that survive (in order) after deletions. */
export function computeVisibleCells(cellCount: number, deletedCells: Set<number>): number[] {
    return Array.from({ length: cellCount }, (_, i) => i).filter((i) => !deletedCells.has(i));
}

/**
 * Convert a set of selected cell indices into the deleted time range they cover.
 * Spans from the first selected cell's start to just past the last cell.
 */
export function selectionToRange(
    selectedCells: Set<number>,
    sampleInterval = SAMPLE_INTERVAL
): DeletedRange {
    const indices = Array.from(selectedCells).sort((a, b) => a - b);
    const startTime = indices[0] * sampleInterval;
    const endTime = (indices[indices.length - 1] + 1) * sampleInterval;
    return { startTime, endTime };
}

// ── zoom ─────────────────────────────────────────────────────────────────────

/** Seconds a frame of the strip stands for, most detailed first. */
export const ZOOM_LEVELS = [0.2, 1, 5] as const;

/** "0.2 s a frame" */
export function zoomLabel(interval: number): string {
    return `${interval} s a frame`;
}

// ── cut history ──────────────────────────────────────────────────────────────

/**
 * Every state the cuts have been in, and which is current: cutting and
 * restoring push a state, Undo and Redo move between them. `edits` counts every
 * change, so unlike `index` a position in the history is never returned to.
 */
export interface CutHistory {
    stack: DeletedRange[][];
    index: number;
    edits: number;
}

export function emptyHistory(): CutHistory {
    return { stack: [[]], index: 0, edits: 0 };
}

export function currentCuts(history: CutHistory): DeletedRange[] {
    return history.stack[history.index];
}

export function canUndo(history: CutHistory): boolean {
    return history.index > 0;
}

export function canRedo(history: CutHistory): boolean {
    return history.index < history.stack.length - 1;
}

export function undo(history: CutHistory): CutHistory {
    return canUndo(history)
        ? { ...history, index: history.index - 1, edits: history.edits + 1 }
        : history;
}

export function redo(history: CutHistory): CutHistory {
    return canRedo(history)
        ? { ...history, index: history.index + 1, edits: history.edits + 1 }
        : history;
}

/** A new state of the cuts; anything that could have been redone is dropped. */
function push(history: CutHistory, cuts: DeletedRange[]): CutHistory {
    return {
        stack: [...history.stack.slice(0, history.index + 1), cuts],
        index: history.index + 1,
        edits: history.edits + 1
    };
}

/**
 * Cuts `range`, merged with any cut it overlaps or touches, so the cuts never
 * double-count a span.
 */
export function addCut(history: CutHistory, range: DeletedRange): CutHistory {
    let merged = { ...range };
    const others: DeletedRange[] = [];
    for (const cut of currentCuts(history)) {
        if (cut.startTime <= merged.endTime && cut.endTime >= merged.startTime) {
            merged = {
                startTime: Math.min(cut.startTime, merged.startTime),
                endTime: Math.max(cut.endTime, merged.endTime)
            };
        } else {
            others.push(cut);
        }
    }
    return push(
        history,
        [...others, merged].sort((a, b) => a.startTime - b.startTime)
    );
}

/** Puts the frames of the `index`th cut back. Undoable like a cut. */
export function restoreCut(history: CutHistory, index: number): CutHistory {
    return push(
        history,
        currentCuts(history).filter((_, i) => i !== index)
    );
}

/** The file just exported, and the history's `edits` when it was. */
export interface ExportedFile {
    name: string;
    edits: number;
}

/**
 * The file the Exported notice names, while the edit on screen is still the
 * one exported; null once a cut, restore, Undo or Redo has changed it.
 */
export function exportedFileShown(
    exported: ExportedFile | null,
    history: CutHistory
): string | null {
    return exported && exported.edits === history.edits ? exported.name : null;
}

// ── the frame strip ──────────────────────────────────────────────────────────

/** Where each frame and cut marker sits in the strip, in px from its start. */
export type StripEntry =
    | { kind: 'frame'; cell: number; base: number; time: number; x: number }
    | { kind: 'cut'; cut: number; seconds: number; x: number };

/**
 * Lays out the strip at a zoom level: one frame per `interval` of the
 * recording, the frames inside a cut left out, and a marker where each cut
 * was made. `cell` counts frames at this interval; `base` counts 0.2 s cells,
 * which key the thumbnails at every zoom.
 */
export function stripLayout(
    duration: number,
    cuts: DeletedRange[],
    interval: number
): { entries: StripEntry[]; width: number } {
    const entries: StripEntry[] = [];
    const sorted = [...cuts].sort((a, b) => a.startTime - b.startTime);
    const deleted = computeDeletedCells(computeCellCount(duration, interval), sorted, interval);
    let next = 0;
    let x = 0;
    const markCutsBefore = (time: number) => {
        while (next < sorted.length && sorted[next].endTime <= time + 1e-9) {
            const cut = sorted[next];
            entries.push({
                kind: 'cut',
                cut: cuts.indexOf(cut),
                seconds: Math.round((cut.endTime - cut.startTime) * 10) / 10,
                x
            });
            x += CUT_STRIDE;
            next++;
        }
    };
    const count = computeCellCount(duration, interval);
    for (let cell = 0; cell < count; cell++) {
        if (deleted.has(cell)) continue;
        const time = cell * interval;
        markCutsBefore(time);
        entries.push({
            kind: 'frame',
            cell,
            base: Math.round(time / SAMPLE_INTERVAL),
            time,
            x
        });
        x += CELL_STRIDE;
    }
    markCutsBefore(Infinity);
    return { entries, width: Math.max(0, x - CELL_GAP) };
}

/** The entries overlapping `[offset, offset + width]`, give or take `slack` px. */
export function entriesInView(
    entries: StripEntry[],
    offset: number,
    width: number,
    slack = 2 * CELL_STRIDE
): StripEntry[] {
    return entries.filter(
        (e) =>
            e.x + (e.kind === 'frame' ? CELL_WIDTH : CUT_STRIDE) >= offset - slack &&
            e.x <= offset + width + slack
    );
}

/** The frame showing at raw time `time`: the last one starting at or before it. */
export function frameAt(entries: StripEntry[], time: number): StripEntry | undefined {
    let found: StripEntry | undefined;
    for (const e of entries) {
        if (e.kind !== 'frame') continue;
        if (e.time > time + 1e-9) break;
        found = e;
    }
    return found;
}

/**
 * The overview bar, in % of the kept timeline: the window the strip shows
 * (by px), each cut where it was made, and the playhead.
 */
export function overviewGeometry(
    stripWidth: number,
    offset: number,
    viewWidth: number,
    cuts: DeletedRange[],
    duration: number,
    currentTime: number
): { windowStart: number; windowWidth: number; cuts: number[]; playhead: number } {
    const kept = computeEffectiveDuration(duration, cuts);
    const pct = (t: number) => (kept > 0 ? (100 * t) / kept : 0);
    const windowWidth = stripWidth > 0 ? Math.min(100, (100 * viewWidth) / stripWidth) : 100;
    return {
        windowStart: stripWidth > 0 ? Math.min(100 - windowWidth, (100 * offset) / stripWidth) : 0,
        windowWidth,
        cuts: cuts.map((c) => pct(computeEffectiveCurrentTime(c.startTime, cuts))),
        playhead: pct(computeEffectiveCurrentTime(currentTime, cuts))
    };
}
