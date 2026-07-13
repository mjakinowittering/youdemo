/**
 * The document title for every moment of the user journey.
 *
 * `+page.svelte` renders the result through `<svelte:head>`, so this module is
 * the only place a title string is spelled out — no component writes
 * `document.title` itself.
 */
import type { AppState } from '$lib/types.js';

export const APP_NAME = 'YouDemo';

export interface TitleContext {
    /** Pre-empts the state machine, matching the `hasError` branch in `+page`. */
    hasError?: boolean;
    /** Countdown: seconds remaining. */
    count?: number;
    /** Recording: seconds elapsed. */
    elapsed?: number;
    /** Stitching / processing: 0–100. */
    progress?: number;
}

/** Seconds → `mm:ss`. Also drives the on-screen REC badge in `Recording`. */
export function formatElapsed(totalSeconds: number): string {
    const mm = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, '0');
    const ss = Math.floor(totalSeconds % 60)
        .toString()
        .padStart(2, '0');
    return `${mm}:${ss}`;
}

/** `'Editing'` → `'Editing | YouDemo'`. */
function suffixed(text: string): string {
    return `${text} | ${APP_NAME}`;
}

export function titleFor(state: AppState, ctx: TitleContext = {}): string {
    const { hasError = false, count = 3, elapsed = 0, progress = 0 } = ctx;

    if (hasError) return suffixed('Something went wrong');

    switch (state) {
        case 'check':
            return suffixed('Checking browser…');
        case 'setup':
            return suffixed('Ready to record');
        case 'countdown':
            return suffixed(`${count}…`);
        case 'recording':
            return suffixed(`● REC ${formatElapsed(elapsed)}`);
        case 'review':
            return suffixed('Review recording');
        case 'stitching':
            return suffixed(`Combining… ${progress}%`);
        case 'editor':
            return suffixed('Editing');
        case 'processing':
            return suffixed(`Exporting… ${progress}%`);
        case 'done':
            return suffixed('Download ready');
    }
}
