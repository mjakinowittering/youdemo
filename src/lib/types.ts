/**
 * Shared type definitions.
 *
 * `DeletedRange` describes a span of the recording removed in the Editor. It is
 * the single source of truth consumed by the Editor (selection → range), the
 * export pipeline (Processing / videoStitcher), and `+page.svelte`.
 */
export interface DeletedRange {
    startTime: number;
    endTime: number;
}

/**
 * Every step of the user journey. Owned as `$state` by `+page.svelte`, which
 * renders the matching screen; `titles.ts` maps each one to a document title.
 */
export type AppState =
    | 'check'
    | 'setup'
    | 'countdown'
    | 'recording'
    | 'review'
    | 'stitching'
    | 'editor'
    | 'processing'
    | 'done';
