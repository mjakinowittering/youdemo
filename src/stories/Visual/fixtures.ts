import type { StripItem } from '$lib/editorMath.js';

/** A stand-in thumbnail: masked by the compare script, so only its box counts. */
export const FIXTURE_THUMB =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="64"%3E%3Crect width="80" height="64" fill="%23f4f6f8"/%3E%3C/svg%3E';

/** The boards' 1.4 s cut. */
export const FIXTURE_CUT_SECONDS = 1.4;

/**
 * A frame strip from a pattern of kinds: `frame`, `current`, `marked`,
 * `skeleton` or `cut`.
 */
export function fixtureStrip(
    pattern: ('frame' | 'current' | 'marked' | 'skeleton' | 'cut')[]
): StripItem[] {
    let cell = 60;
    return pattern.map((kind, i) =>
        kind === 'cut'
            ? { kind: 'cut', cut: i, seconds: FIXTURE_CUT_SECONDS }
            : {
                  kind: 'frame',
                  cell: cell++,
                  thumb: kind === 'skeleton' ? null : FIXTURE_THUMB,
                  current: kind === 'current',
                  marked: kind === 'marked'
              }
    );
}
