import { describe, expect, it } from 'vitest';

import {
    BUBBLE_FRAC,
    BUBBLE_POSITIONS,
    bubbleCoords,
    PAD_FRAC,
    previewBubble,
    previewSpot,
    SLOT_INSET,
    SLOT_SHRINK,
    type BubblePosition
} from '$lib/bubbleGeometry.js';

// A 1000×400 frame: bubble = 72, pad = 10.
const frame = { x: 0, y: 0, w: 1000, h: 400 };

describe('bubbleCoords', () => {
    it('sizes from frame height', () => {
        expect(frame.h * BUBBLE_FRAC).toBe(72);
        expect(frame.h * PAD_FRAC).toBe(10);
    });

    it.each<[BubblePosition, number, number]>([
        ['tl', 10, 10],
        ['tr', 918, 10],
        ['bl', 10, 318],
        ['br', 918, 318],
        ['tc', 464, 10],
        ['rc', 918, 164],
        ['bc', 464, 318],
        ['lc', 10, 164]
    ])('places %s', (pos, x, y) => {
        expect(bubbleCoords(pos, frame)).toEqual({ x, y });
    });

    it('offsets by the frame origin, as the letterboxed preview needs', () => {
        const letterboxed = { ...frame, x: 50, y: 25 };
        for (const pos of BUBBLE_POSITIONS) {
            const base = bubbleCoords(pos, frame);
            expect(bubbleCoords(pos, letterboxed)).toEqual({ x: base.x + 50, y: base.y + 25 });
        }
    });

    it('lists all eight positions once', () => {
        expect(new Set(BUBBLE_POSITIONS).size).toBe(8);
    });
});

// Review's preview: a 620×348 frame with a 1.5px outline, so 617×345 inside.
const review = { innerW: 617, innerH: 345, outerW: 620, outerH: 348 };

describe('previewBubble', () => {
    it('is the recorded bubble 8px larger, inset 2px less than its slot', () => {
        expect(previewBubble(review.innerH)).toEqual({ size: 70, inset: 6 });
    });
});

describe('previewSpot', () => {
    const slot = 70 - SLOT_SHRINK;
    const inset = 6 + SLOT_INSET;

    it.each<[BubblePosition, number, number]>([
        ['tl', 8, 8],
        ['tc', 279, 8],
        ['tr', 547, 8],
        ['lc', 8, 143],
        ['rc', 547, 143],
        ['bl', 8, 275],
        ['bc', 279, 275],
        ['br', 547, 275]
    ])('puts the %s slot where the Review board draws it', (pos, x, y) => {
        expect(previewSpot(pos, review, slot, slot, inset)).toEqual({ x, y });
    });

    it('puts the bubble at its corner, inset from the inner edges', () => {
        expect(previewSpot('tr', review, 70, 70, 6)).toEqual({ x: 541, y: 6 });
    });
});
