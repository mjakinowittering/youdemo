import { describe, expect, it } from 'vitest';

import {
    BUBBLE_FRAC,
    BUBBLE_POSITIONS,
    bubbleCoords,
    PAD_FRAC,
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
