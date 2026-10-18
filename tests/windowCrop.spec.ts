import { describe, expect, it } from 'vitest';

import { blackMargins } from '$lib/windowCrop.js';

// A width×height RGBA frame, black, with a light rectangle from (x0, y0) up to
// but not including (x1, y1)
function frame(width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const light = x >= x0 && x < x1 && y >= y0 && y < y1;
            data.fill(light ? 240 : 0, i, i + 3);
            data[i + 3] = 255;
        }
    }
    return data;
}

describe('blackMargins', () => {
    it('finds a window shadow margin, deeper below', () => {
        expect(blackMargins(frame(200, 100, 4, 3, 195, 92), 200, 100)).toEqual({
            top: 3,
            right: 5,
            bottom: 8,
            left: 4
        });
    });

    it('finds none when the content reaches every edge', () => {
        expect(blackMargins(frame(200, 100, 0, 0, 200, 100), 200, 100)).toEqual({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        });
    });

    it('stops at the first line with anything light in it', () => {
        const data = frame(200, 100, 10, 10, 190, 90);
        // One light pixel on row 2, as a dark app's edge might have
        data.fill(240, (2 * 200 + 100) * 4, (2 * 200 + 100) * 4 + 3);
        expect(blackMargins(data, 200, 100).top).toBe(2);
    });

    it('counts near-black as black, as encoding leaves it', () => {
        const data = frame(200, 100, 4, 4, 196, 96);
        for (let i = 0; i < 200 * 4; i += 4) data.fill(8, i, i + 3);
        expect(blackMargins(data, 200, 100).top).toBe(4);
    });

    it('keeps an edge whole when its black band is too deep to be a shadow', () => {
        // 30 of 100 rows black at the bottom: content, not a margin
        expect(blackMargins(frame(200, 100, 4, 3, 196, 70), 200, 100)).toEqual({
            top: 3,
            right: 4,
            bottom: 0,
            left: 4
        });
    });

    it('leaves an all-black frame whole', () => {
        expect(blackMargins(frame(200, 100, 0, 0, 0, 0), 200, 100)).toEqual({
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        });
    });
});
