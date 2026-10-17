// Webcam bubble geometry, shared by the Setup preview (WebcamBubble.svelte) and the
// composited recording (recorder.ts) so the two can never drift apart. Sizes are a
// fraction of frame height, so they agree at any resolution.

export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc';

export const BUBBLE_POSITIONS: BubblePosition[] = ['tl', 'tr', 'bl', 'br', 'tc', 'rc', 'bc', 'lc'];

export const BUBBLE_FRAC = 0.18;
export const PAD_FRAC = 0.025;

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Top-left corner of the bubble at `pos` within `frame`. */
export function bubbleCoords(pos: BubblePosition, frame: Rect): { x: number; y: number } {
    const bubble = frame.h * BUBBLE_FRAC;
    const pad = frame.h * PAD_FRAC;
    const left = frame.x + pad;
    const right = frame.x + frame.w - bubble - pad;
    const top = frame.y + pad;
    const bottom = frame.y + frame.h - bubble - pad;
    const cx = frame.x + frame.w / 2 - bubble / 2;
    const cy = frame.y + frame.h / 2 - bubble / 2;
    switch (pos) {
        case 'tl':
            return { x: left, y: top };
        case 'tr':
            return { x: right, y: top };
        case 'bl':
            return { x: left, y: bottom };
        case 'br':
            return { x: right, y: bottom };
        case 'tc':
            return { x: cx, y: top };
        case 'rc':
            return { x: right, y: cy };
        case 'bc':
            return { x: cx, y: bottom };
        case 'lc':
            return { x: left, y: cy };
    }
}

/** A box's size: the inner (padding) box and the outer (border) box of a frame. */
export interface FrameSize {
    innerW: number;
    innerH: number;
    outerW: number;
    outerH: number;
}

// Which edge or centre each spot sits against: [vertical, horizontal]
const ANCHORS: Record<BubblePosition, ['t' | 'c' | 'b', 'l' | 'c' | 'r']> = {
    tl: ['t', 'l'],
    tc: ['t', 'c'],
    tr: ['t', 'r'],
    lc: ['c', 'l'],
    rc: ['c', 'r'],
    bl: ['b', 'l'],
    bc: ['b', 'c'],
    br: ['b', 'r']
};

/**
 * Top-left of a `w`×`h` box at `pos` in a preview frame, `inset` from its inner
 * edges. Centred spots are centred on the frame's outer box, as the design draws
 * them. In CSS pixels relative to the frame's padding box.
 */
export function previewSpot(
    pos: BubblePosition,
    frame: FrameSize,
    w: number,
    h: number,
    inset: number
): { x: number; y: number } {
    const [v, hz] = ANCHORS[pos];
    const xs = { l: inset, c: (frame.outerW - w) / 2, r: frame.innerW - w - inset };
    const ys = { t: inset, c: (frame.outerH - h) / 2, b: frame.innerH - h - inset };
    return { x: xs[hz], y: ys[v] };
}

/**
 * {@link previewSpot} as CSS. Each spot is anchored to its own edge, or centred
 * with a translate, so it doesn't depend on a measured size: a box that changes
 * size grows from its spot towards the middle of the frame.
 */
export function previewSpotStyle(pos: BubblePosition, frame: FrameSize, inset: number): string {
    const [v, hz] = ANCHORS[pos];
    const across = {
        l: `left: ${inset}px`,
        c: `left: ${frame.outerW / 2}px`,
        r: `right: ${inset}px`
    };
    const down = { t: `top: ${inset}px`, c: `top: ${frame.outerH / 2}px`, b: `bottom: ${inset}px` };
    const shift = `translate: ${hz === 'c' ? '-50%' : '0'} ${v === 'c' ? '-50%' : '0'}`;
    return `${across[hz]}; ${down[v]}; ${shift}`;
}

// Each spot's column and row in the 3×3 grid around the frame; the middle is empty
const GRID: Record<BubblePosition, [number, number]> = {
    tl: [0, 0],
    tc: [1, 0],
    tr: [2, 0],
    lc: [0, 1],
    rc: [2, 1],
    bl: [0, 2],
    bc: [1, 2],
    br: [2, 2]
};

const STEPS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};

/**
 * The spot an arrow key moves the bubble to: one step across the grid, over the
 * empty middle to the far side, staying put at an edge. Null for any other key.
 */
export function nextSpot(pos: BubblePosition, key: string): BubblePosition | null {
    const step = STEPS[key];
    if (!step) return null;
    let [col, row] = GRID[pos];
    do {
        col += step[0];
        row += step[1];
    } while (col === 1 && row === 1);
    if (col < 0 || col > 2 || row < 0 || row > 2) return pos;
    return BUBBLE_POSITIONS.find((p) => GRID[p][0] === col && GRID[p][1] === row) ?? pos;
}

/**
 * The preview bubble for a frame of this inner height: the recording's bubble
 * (BUBBLE_FRAC, PAD_FRAC) drawn 8px larger, so it reads as lifted off its slot.
 */
export function previewBubble(innerH: number): { size: number; inset: number } {
    return {
        size: Math.floor(innerH * BUBBLE_FRAC) + SLOT_SHRINK,
        inset: Math.floor(innerH * PAD_FRAC) - SLOT_INSET
    };
}

/** A dashed slot is the bubble `SLOT_SHRINK` smaller, `SLOT_INSET` further in. */
export const SLOT_SHRINK = 8;
export const SLOT_INSET = 2;
