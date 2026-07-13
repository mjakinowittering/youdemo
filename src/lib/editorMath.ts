/**
 * Pure timeline / edit-math for the Editor, extracted so it can be unit-tested
 * without a browser (no DOM, no video element). The Editor shell and its
 * sub-components consume these from `$derived`; the browser-bound orchestration
 * (video element, thumbnail generation, seeking) stays in the components.
 */
import type { DeletedRange } from './types.js';

/** Frame-strip layout constants — shared by the Editor shell and FrameStrip. */
export const FRAME_RATE = 30;
export const SAMPLE_INTERVAL = 0.2;
export const CELL_WIDTH = 80;
export const CELL_HEIGHT = 64;
export const CELL_GAP = 3;
export const CELL_STRIDE = CELL_WIDTH + CELL_GAP;

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

/** Total kept duration = raw duration minus the sum of deleted spans. */
export function computeEffectiveDuration(
    videoDuration: number,
    deletedRanges: DeletedRange[]
): number {
    return Math.max(
        0,
        videoDuration -
            deletedRanges.reduce((sum, r) => sum + Math.max(0, r.endTime - r.startTime), 0)
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
        if (remaining <= keptDuration) {
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

/** Virtualization window (rendered positions) for the current scroll offset. */
export function computeVirtualWindow(
    scrollLeft: number,
    containerWidth: number,
    visibleCount: number,
    cellStride = CELL_STRIDE
): { posStart: number; posEnd: number } {
    const posStart = Math.max(0, Math.floor(scrollLeft / cellStride) - 5);
    const posEnd = Math.min(
        visibleCount - 1,
        Math.ceil((scrollLeft + containerWidth) / cellStride) + 5
    );
    return { posStart, posEnd };
}

/** Timestamp labels spaced ~8 across the visible strip. */
export function computeTimestampLabels(
    visibleCells: number[],
    sampleInterval = SAMPLE_INTERVAL
): { visibleIndex: number; label: string }[] {
    const interval = Math.max(1, Math.round(visibleCells.length / 8));
    return visibleCells
        .map((_, visibleIndex) => ({ visibleIndex }))
        .filter(({ visibleIndex }) => visibleIndex % interval === 0)
        .map(({ visibleIndex }) => ({
            visibleIndex,
            label: formatTime(visibleIndex * sampleInterval)
        }));
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
