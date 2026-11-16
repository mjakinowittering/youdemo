/**
 * Draws one frame of a recording: the screen without a window share's margin,
 * then the webcam bubble. Shared by the compositor Worker (VideoFrames on an
 * OffscreenCanvas) and the recorder's main-thread fallback (<video> elements),
 * so the two can't drift.
 */
import { BUBBLE_FRAC, bubbleCoords, type BubblePosition } from './bubbleGeometry.js';
import type { Margins } from './windowCrop.js';

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Something drawable and its size in pixels. */
export interface Picture {
    source: CanvasImageSource;
    width: number;
    height: number;
}

/** The canvas the bubble is masked on, and its feathered circle. */
export interface Bubble {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    ctx: Context;
    mask: CanvasGradient;
}

/**
 * Sets up `canvas` for the bubble of a frame `frameHeight` tall. The webcam is
 * masked on a canvas of its own and blitted: clipping a circle directly leaves
 * a partial-coverage seam at its edge, visible as straight "borders" once the
 * frame is resolution-capped.
 */
export function createBubble(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    frameHeight: number
): Bubble | null {
    const d = Math.max(2, Math.round(frameHeight * BUBBLE_FRAC));
    canvas.width = d;
    canvas.height = d;
    const ctx = canvas.getContext('2d') as Context | null;
    if (!ctx) return null;
    const r = d / 2;
    const feather = Math.max(1, r * 0.03);
    const mask = ctx.createRadialGradient(r, r, 0, r, r, r);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(Math.max(0, (r - feather) / r), 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    return { canvas, ctx, mask };
}

/** Draws `screen` over the whole `width` × `height` frame, then the bubble if there is one. */
export function drawComposite(
    ctx: Context,
    width: number,
    height: number,
    screen: Picture | null,
    margins: Margins,
    webcam: Picture | null,
    bubble: Bubble | null,
    position: BubblePosition
): void {
    if (screen) {
        const { top, right, bottom, left } = margins;
        const sw = screen.width - left - right;
        const sh = screen.height - top - bottom;
        ctx.drawImage(screen.source, left, top, sw, sh, 0, 0, width, height);
    }
    if (!webcam || !bubble) return;

    const d = bubble.canvas.width;
    const { x, y } = bubbleCoords(position, { x: 0, y: 0, w: width, h: height });

    // Centre-crop the webcam frame to a square — matches the preview's object-cover.
    const side = Math.min(webcam.width, webcam.height);
    const sx = (webcam.width - side) / 2;
    const sy = (webcam.height - side) / 2;

    // Draw the square, then keep only the feathered circle via destination-in.
    // The soft alpha edge blends cleanly onto the frame.
    const bc = bubble.ctx;
    bc.globalCompositeOperation = 'source-over';
    bc.clearRect(0, 0, d, d);
    bc.drawImage(webcam.source, sx, sy, side, side, 0, 0, d, d);
    bc.globalCompositeOperation = 'destination-in';
    bc.fillStyle = bubble.mask;
    bc.fillRect(0, 0, d, d);
    bc.globalCompositeOperation = 'source-over';

    ctx.drawImage(bubble.canvas, Math.round(x), Math.round(y));
}
