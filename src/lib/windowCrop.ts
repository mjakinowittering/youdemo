// A single-window share can bring the window's shadow margin with it: see-through
// pixels around the window that the recorder's opaque canvas turns black (deeper
// below the window, as GNOME draws its shadows). These find that margin in one
// frame so the recorder can leave it out.

/** How far in from each edge of a frame the margin runs, in px. */
export interface Margins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export const NO_MARGINS: Margins = { top: 0, right: 0, bottom: 0, left: 0 };

/** A channel at or below this counts as black. */
const DARK = 10;
/**
 * The deepest a margin may be, as a fraction of the frame. A black band reaching
 * it is the window's own content (a terminal, a dark app), not a shadow, so that
 * edge is kept whole.
 */
export const MAX_MARGIN_FRAC = 0.12;

/**
 * The black margin on each edge of an RGBA frame: rows or columns in which every
 * pixel is near-black, counted in from the edge. An edge whose band reaches
 * `MAX_MARGIN_FRAC` of the frame is not cropped, so an all-black frame (or a
 * dark app) is left whole.
 */
export function blackMargins(data: Uint8ClampedArray, width: number, height: number): Margins {
    const dark = (x: number, y: number) => {
        const i = (y * width + x) * 4;
        return data[i] <= DARK && data[i + 1] <= DARK && data[i + 2] <= DARK;
    };
    const darkRow = (y: number) => {
        for (let x = 0; x < width; x++) if (!dark(x, y)) return false;
        return true;
    };
    const darkColumn = (x: number) => {
        for (let y = 0; y < height; y++) if (!dark(x, y)) return false;
        return true;
    };
    // Counts black lines in from an edge; at the cap it is content, so 0
    const depth = (cap: number, isDark: (n: number) => boolean) => {
        let n = 0;
        while (n < cap && isDark(n)) n++;
        return n < cap ? n : 0;
    };
    const capY = Math.floor(height * MAX_MARGIN_FRAC);
    const capX = Math.floor(width * MAX_MARGIN_FRAC);
    return {
        top: depth(capY, (n) => darkRow(n)),
        bottom: depth(capY, (n) => darkRow(height - 1 - n)),
        left: depth(capX, (n) => darkColumn(n)),
        right: depth(capX, (n) => darkColumn(width - 1 - n))
    };
}
