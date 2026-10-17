import { describe, expect, it } from 'vitest';

import {
    addCut,
    canRedo,
    canUndo,
    CELL_STRIDE,
    computeCellCount,
    computeDeletedCells,
    computeEffectiveCurrentTime,
    computeEffectiveDuration,
    computeVisibleCells,
    currentCuts,
    CUT_STRIDE,
    effectiveToRawTime,
    emptyHistory,
    entriesInView,
    exportedFileShown,
    formatTime,
    frameAt,
    overviewGeometry,
    redo,
    resolveSeekTarget,
    restoreCut,
    SAMPLE_INTERVAL,
    selectionToRange,
    stripLayout,
    undo,
    ZOOM_LEVELS,
    zoomLabel
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
    it('counts a cut only within the recording', () => {
        // The last frame's cell ends at 3.2 s in a 3.115 s recording
        expect(computeEffectiveDuration(3.115, [{ startTime: 2.2, endTime: 3.2 }])).toBeCloseTo(
            2.2
        );
    });

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

    it('maps a time on a cut start to the kept frame after the cut', () => {
        // The opening two seconds cut: effective 0 is raw 2, not inside the cut
        expect(effectiveToRawTime(0, [{ startTime: 0, endTime: 2 }], 10)).toBe(2);
        // Exactly where a mid cut starts: the frame after it
        expect(effectiveToRawTime(1, [{ startTime: 1, endTime: 3 }], 10)).toBe(3);
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

describe('zoom', () => {
    it('has three levels, most detailed first', () => {
        expect(ZOOM_LEVELS).toEqual([0.2, 1, 5]);
    });

    it('names a level as seconds a frame', () => {
        expect(zoomLabel(0.2)).toBe('0.2 s a frame');
        expect(zoomLabel(5)).toBe('5 s a frame');
    });
});

describe('cut history', () => {
    const a = { startTime: 1, endTime: 2 };
    const b = { startTime: 5, endTime: 6 };

    it('starts with no cuts and nothing to undo or redo', () => {
        const h = emptyHistory();
        expect(currentCuts(h)).toEqual([]);
        expect(canUndo(h)).toBe(false);
        expect(canRedo(h)).toBe(false);
    });

    it('undoes and redoes cuts in order', () => {
        const h = addCut(addCut(emptyHistory(), b), a);
        expect(currentCuts(h)).toEqual([a, b]);
        const back = undo(h);
        expect(currentCuts(back)).toEqual([b]);
        expect(canRedo(back)).toBe(true);
        expect(currentCuts(redo(back))).toEqual([a, b]);
    });

    it('drops what could be redone once a new cut is made', () => {
        const h = addCut(undo(addCut(emptyHistory(), a)), b);
        expect(currentCuts(h)).toEqual([b]);
        expect(canRedo(h)).toBe(false);
    });

    it('stays put when there is nothing to step to', () => {
        const h = emptyHistory();
        expect(undo(h)).toBe(h);
        expect(redo(h)).toBe(h);
    });

    it('merges a cut with any it overlaps or touches', () => {
        const h = addCut(addCut(emptyHistory(), a), { startTime: 2, endTime: 3 });
        expect(currentCuts(h)).toEqual([{ startTime: 1, endTime: 3 }]);
    });

    it('restores a cut as an undoable step', () => {
        const cut = addCut(addCut(emptyHistory(), a), b);
        const restored = restoreCut(cut, 0);
        expect(currentCuts(restored)).toEqual([b]);
        expect(currentCuts(undo(restored))).toEqual([a, b]);
    });
});

describe('exportedFileShown', () => {
    const a = { startTime: 1, endTime: 2 };
    const b = { startTime: 5, endTime: 6 };
    const name = 'youdemo-2026-10-17-215000.webm';
    const exportedAt = (h: ReturnType<typeof emptyHistory>) => ({ name, edits: h.edits });

    it('names the file while the edit is the one exported', () => {
        const h = addCut(emptyHistory(), a);
        expect(exportedFileShown(exportedAt(h), h)).toBe(name);
    });

    it('closes once dismissed', () => {
        expect(exportedFileShown(null, emptyHistory())).toBeNull();
    });

    it('closes on a cut', () => {
        const h = addCut(emptyHistory(), a);
        expect(exportedFileShown(exportedAt(h), addCut(h, b))).toBeNull();
    });

    it('closes on Undo, Redo and restoring a cut', () => {
        const h = addCut(addCut(emptyHistory(), a), b);
        const back = undo(h);
        expect(exportedFileShown(exportedAt(h), back)).toBeNull();
        expect(exportedFileShown(exportedAt(h), restoreCut(h, 0))).toBeNull();
        expect(exportedFileShown(exportedAt(back), redo(back))).toBeNull();
    });

    it('stays closed when Undo then Redo returns to the exported cuts', () => {
        const h = addCut(emptyHistory(), a);
        expect(exportedFileShown(exportedAt(h), redo(undo(h)))).toBeNull();
    });

    it('stays open when Undo or Redo has nothing to step to', () => {
        const h = emptyHistory();
        expect(exportedFileShown(exportedAt(h), redo(undo(h)))).toBe(name);
    });
});

describe('stripLayout', () => {
    it('lays a frame every interval, a stride apart', () => {
        const { entries, width } = stripLayout(1, [], 0.2);
        expect(entries.map((e) => e.kind === 'frame' && e.cell)).toEqual([0, 1, 2, 3, 4]);
        expect(entries.map((e) => e.x)).toEqual([0, 1, 2, 3, 4].map((i) => i * CELL_STRIDE));
        expect(width).toBe(5 * CELL_STRIDE - 3);
    });

    it('leaves out cut frames and marks the cut where it was made', () => {
        const { entries } = stripLayout(2, [{ startTime: 0.4, endTime: 1 }], 0.2);
        expect(entries.map((e) => (e.kind === 'cut' ? `cut ${e.seconds}` : e.cell))).toEqual([
            0,
            1,
            'cut 0.6',
            5,
            6,
            7,
            8,
            9
        ]);
        const marker = entries[2];
        expect(entries[3].x - marker.x).toBe(CUT_STRIDE);
    });

    it('keys every zoom level by 0.2 s cell', () => {
        const { entries } = stripLayout(10, [], 5);
        expect(entries.map((e) => e.kind === 'frame' && e.base)).toEqual([0, 25]);
    });

    it('marks a cut at the very end', () => {
        const { entries } = stripLayout(1, [{ startTime: 0.6, endTime: 1 }], 0.2);
        expect(entries.at(-1)?.kind).toBe('cut');
    });
});

describe('entriesInView', () => {
    it('keeps the frames overlapping the view', () => {
        const { entries } = stripLayout(20, [], 0.2);
        const view = entriesInView(entries, 10 * CELL_STRIDE, 3 * CELL_STRIDE, 0);
        expect(view.map((e) => e.kind === 'frame' && e.cell)).toEqual([10, 11, 12, 13]);
    });
});

describe('frameAt', () => {
    it('finds the frame showing at a time, skipping cut ones', () => {
        const { entries } = stripLayout(2, [{ startTime: 0.4, endTime: 1 }], 0.2);
        expect(frameAt(entries, 0.3)).toMatchObject({ cell: 1 });
        expect(frameAt(entries, 1.1)).toMatchObject({ cell: 5 });
    });
});

describe('overviewGeometry', () => {
    it('places the window, cuts and playhead on the kept timeline', () => {
        const cuts = [{ startTime: 2, endTime: 4 }];
        const g = overviewGeometry(1000, 250, 500, cuts, 10, 6);
        expect(g.windowStart).toBe(25);
        expect(g.windowWidth).toBe(50);
        // 8 s kept: the cut sits at 2 s, the playhead at 6 − 2 = 4 s
        expect(g.cuts).toEqual([25]);
        expect(g.playhead).toBe(50);
    });

    it('fills the bar when the strip fits', () => {
        expect(overviewGeometry(400, 0, 800, [], 10, 0)).toMatchObject({
            windowStart: 0,
            windowWidth: 100
        });
    });
});
