/**
 * Shared type definitions.
 *
 * `DeletedRange` describes a span of the recording removed in the Editor. It is
 * the single source of truth consumed by the Editor (selection → range), the
 * export pipeline (videoStitcher), and `+page.svelte`.
 */
export interface DeletedRange {
    startTime: number;
    endTime: number;
}

/** One recorded take: its WebM and how long it runs, in seconds. */
export interface Take {
    blob: Blob;
    duration: number;
}

/**
 * Every step of the user journey. Owned as `$state` by `+page.svelte`, which
 * renders the matching screen; `titles.ts` maps each one to a document title.
 */
export type AppState = 'check' | 'setup' | 'countdown' | 'recording' | 'review' | 'editor';

/**
 * The Editor's phases. It mounts at once: `joining` while several takes are
 * joined, `ready` to edit, `exporting` while the file is written, and `failed`
 * if that didn't finish.
 */
export type EditorPhase = 'joining' | 'ready' | 'exporting' | 'failed';

/** The step a join or export is on, named in the line under its progress bar. */
export type ExportStep = 'reading' | 'reencoding' | 'writing' | 'saving';
