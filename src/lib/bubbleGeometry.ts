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
 * {@link previewSpot} as CSS. Spots on the right and bottom are anchored to those
 * edges, as the design draws them, so they don't depend on a measured size.
 */
export function previewSpotStyle(
    pos: BubblePosition,
    frame: FrameSize,
    w: number,
    h: number,
    inset: number
): string {
    const [v, hz] = ANCHORS[pos];
    const { x, y } = previewSpot(pos, frame, w, h, inset);
    const across = hz === 'r' ? `right: ${inset}px` : `left: ${x}px`;
    const down = v === 'b' ? `bottom: ${inset}px` : `top: ${y}px`;
    return `${across}; ${down}`;
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
