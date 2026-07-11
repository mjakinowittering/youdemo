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
