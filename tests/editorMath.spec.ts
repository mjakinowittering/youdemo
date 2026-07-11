import { describe, expect, it } from 'vitest';

import {
    CELL_STRIDE,
    computeCellCount,
    computeDeletedCells,
    computeEffectiveCurrentTime,
    computeEffectiveDuration,
    computeTimestampLabels,
    computeVirtualWindow,
    computeVisibleCells,
    effectiveToRawTime,
    formatTime,
    resolveSeekTarget,
    SAMPLE_INTERVAL,
    selectionToRange
} from '$lib/editorMath.js';
import type { DeletedRange } from '$lib/types.js';

describe('formatTime', () => {
    it('formats sub-minute values with padding', () => {
        expect(formatTime(0)).toBe('00:00');
        expect(formatTime(5)).toBe('00:05');
        expect(formatTime(42)).toBe('00:42');
    });

    it('formats minutes and floors fractional seconds', () => {
        expect(formatTime(65)).toBe('01:05');
        expect(formatTime(125.9)).toBe('02:05');
    });
});

describe('computeEffectiveDuration', () => {
    it('returns the full duration when nothing is deleted', () => {
        expect(computeEffectiveDuration(10, [])).toBe(10);
    });

    it('subtracts the summed deleted spans', () => {
        const ranges: DeletedRange[] = [
            { startTime: 1, endTime: 3 },
            { startTime: 5, endTime: 6 }
        ];
        expect(computeEffectiveDuration(10, ranges)).toBe(7);
    });

    it('never goes below zero and ignores negative spans', () => {
        expect(computeEffectiveDuration(2, [{ startTime: 0, endTime: 5 }])).toBe(0);
        expect(computeEffectiveDuration(5, [{ startTime: 3, endTime: 2 }])).toBe(5);
    });
});

describe('computeEffectiveCurrentTime', () => {
    it('is identity when nothing is deleted', () => {
        expect(computeEffectiveCurrentTime(4, [])).toBe(4);
    });

    it('subtracts only spans that end at or before the playhead', () => {
        const ranges: DeletedRange[] = [{ startTime: 1, endTime: 3 }];
        // playhead after the deleted span -> shifted back by 2
        expect(computeEffectiveCurrentTime(5, ranges)).toBe(3);
        // playhead before the span ends -> not shifted
        expect(computeEffectiveCurrentTime(2, ranges)).toBe(2);
    });
});

describe('effectiveToRawTime', () => {
    it('is identity when nothing is deleted', () => {
        expect(effectiveToRawTime(4, [], 10)).toBe(4);
    });

    it('inverts computeEffectiveCurrentTime across a cut', () => {
        const ranges: DeletedRange[] = [{ startTime: 1, endTime: 3 }];
        // 2s of kept time before the cut, then the cut, then more kept time
        expect(effectiveToRawTime(0.5, ranges, 10)).toBe(0.5);
        expect(effectiveToRawTime(1.5, ranges, 10)).toBeCloseTo(3.5);
    });

    it('clamps to the duration', () => {
        expect(effectiveToRawTime(100, [], 10)).toBe(10);
    });
});

describe('resolveSeekTarget', () => {
    it('leaves a target outside every deleted span untouched', () => {
        expect(resolveSeekTarget(4, [{ startTime: 1, endTime: 3 }])).toBe(4);
    });

    it('snaps a target inside a deleted span to that span end', () => {
        expect(resolveSeekTarget(2, [{ startTime: 1, endTime: 3 }])).toBe(3);
    });

    it('treats the span end as exclusive', () => {
        expect(resolveSeekTarget(3, [{ startTime: 1, endTime: 3 }])).toBe(3);
    });
});

describe('computeCellCount', () => {
    it('rounds duration / sample interval', () => {
        expect(computeCellCount(1)).toBe(Math.round(1 / SAMPLE_INTERVAL));
        expect(computeCellCount(2)).toBe(10);
    });

    it('returns 0 for non-finite or non-positive durations', () => {
        expect(computeCellCount(0)).toBe(0);
        expect(computeCellCount(NaN)).toBe(0);
        expect(computeCellCount(Infinity)).toBe(0);
    });
});

describe('computeDeletedCells / computeVisibleCells', () => {
    it('marks cells whose sample time falls inside a deleted span', () => {
        const cellCount = computeCellCount(2); // 10 cells at 0,0.2,...,1.8
        const ranges: DeletedRange[] = [{ startTime: 0.4, endTime: 0.8 }];
        const deleted = computeDeletedCells(cellCount, ranges);
        // cells at t=0.4 (idx 2) and t=0.6 (idx 3); t=0.8 (idx 4) is exclusive
        expect(deleted).toEqual(new Set([2, 3]));
    });

    it('visible cells are the complement, in order', () => {
        const deleted = new Set([2, 3]);
        expect(computeVisibleCells(5, deleted)).toEqual([0, 1, 4]);
    });

    it('has no deleted cells when there are no ranges', () => {
        expect(computeDeletedCells(5, [])).toEqual(new Set());
        expect(computeVisibleCells(3, new Set())).toEqual([0, 1, 2]);
    });
});

describe('computeVirtualWindow', () => {
    it('clamps to the available range with a 5-cell overscan', () => {
        const { posStart, posEnd } = computeVirtualWindow(0, 400, 100);
        expect(posStart).toBe(0);
        expect(posEnd).toBe(Math.min(99, Math.ceil(400 / CELL_STRIDE) + 5));
    });

    it('offsets the window when scrolled', () => {
        const scrollLeft = 20 * CELL_STRIDE;
        const { posStart } = computeVirtualWindow(scrollLeft, 400, 100);
        expect(posStart).toBe(15); // floor(20) - 5
    });
});

describe('computeTimestampLabels', () => {
    it('produces roughly 8 evenly spaced labels', () => {
        const visible = Array.from({ length: 80 }, (_, i) => i);
        const labels = computeTimestampLabels(visible);
        expect(labels.length).toBeGreaterThan(0);
        expect(labels[0]).toEqual({ visibleIndex: 0, label: '00:00' });
        // spacing is a constant stride
        const stride = labels[1].visibleIndex - labels[0].visibleIndex;
        expect(stride).toBe(Math.max(1, Math.round(visible.length / 8)));
    });

    it('handles an empty strip', () => {
        expect(computeTimestampLabels([])).toEqual([]);
    });
});

describe('selectionToRange', () => {
    it('spans from the first cell start to just past the last cell', () => {
        const range = selectionToRange(new Set([3, 4, 5]));
        expect(range.startTime).toBeCloseTo(3 * SAMPLE_INTERVAL);
        expect(range.endTime).toBeCloseTo(6 * SAMPLE_INTERVAL);
    });

    it('handles an out-of-order single-gap selection', () => {
        const range = selectionToRange(new Set([5, 3, 4]));
        expect(range.startTime).toBeCloseTo(0.6);
        expect(range.endTime).toBeCloseTo(1.2);
    });
});
