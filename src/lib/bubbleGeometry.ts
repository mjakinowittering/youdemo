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
