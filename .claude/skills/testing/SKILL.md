---
name: testing
description: How YouDemo is tested — the props-down/state-up design that makes it possible, Storybook CSF v5 story conventions, the three Vitest projects (node unit, browser component, storybook), and the Playwright E2E suite with its export-quality checks. Load when writing or changing a story, adding a unit or E2E test, running the test suite, or deciding where new logic should live so it can be tested.
---

# Testing

Manual end-to-end testing is expensive here: every real run needs a screen-share
grant, a live camera and an actual recording. So the app is built to be tested
**without** the capture pipeline.

## The design principle that makes it possible

Build every screen component as a **pure function of its props**:

- **All UI state is a `$bindable` prop**, never read from a singleton or the DOM.
  `micMuted`, `camEnabled`, `blurOn`, `blurIntensity`, `bubblePosition`, the
  streams, the blob — all flow **down** from `+page.svelte` and changes flow back
  **up** via binding. `+page.svelte` is the single owner of truth; leaf components
  hold none. See `app-shell`.
- **Side effects are callback props** — `onchoose`, `oncancel`, `onstop`,
  `onrecord`, `onchangeshare`, `onedit`, `ondiscard`, `onexport`, `onback`. A
  component signals intent by calling a prop; it never reaches into the state
  machine. Ticks (countdown, REC timer) and async work (joining, export) run in
  `+page.svelte` too, so a screen renders any moment from props.
- Even capability probes are props — `BrowserCheck` takes `hasScreenCapture` etc.
  so failure modes are renderable.

**If a component can't be fully exercised from props in a story, that's a design
smell — push the state up to `+page.svelte`.**

Pure logic goes further: `editorMath.ts`, `bubbleGeometry.ts`, `share.ts` and
`titles.ts` exist so maths and strings can be tested in plain node with no DOM
at all. The Editor's display values come out of `editorMath.ts`, so they are
covered there rather than by the screen stories. New pure logic
belongs there, not inline in a component.

## Storybook and the visual compare

Every story is a **visual story** in `src/stories/Visual/`, one per approved
board in `docs/design/reference/` (the contract is that folder's README):

- `Components.stories.svelte` — title `Visual/Components`, each story named as
  in `manifest.json` (`AppHeader`, `Button` …), rendering the board's 960-wide
  sheet inside `Sheet.svelte`.
- `Screens.stories.svelte` — title `Visual/Screens` ("Setup first visit",
  "Editor trimming" …), each inside `ScreenFrame.svelte` (`AppShell` at the
  board's size).

Rules a visual story keeps:

- One `data-compare="root"`, at the board's size; screens mark their bands
  with `data-section` (header, breadcrumb, stage, dock, timeline, footer,
  dialog). The components put those on themselves.
- **Props and fixtures only**: no real streams, no clicks. Open dialogs,
  progress at 64%, a trim selection are props. Media is a placeholder with
  `data-compare-mask`, sized as the board draws it. Fixtures are in
  `fixtures.ts` and use the boards' data.
- Floating parts render in place through bits' `ContentStatic`, with the class
  lists from `styles.ts`.

`npm run compare` builds Storybook into `.storybook-static`, screenshots each
story the manifest names at the board's size, masks media, and diffs it with
the board's `.html` rendered on the same machine. It writes
`.compare/<name>-side.png` (board · build · diff) per board and section and
exits 1 above 0.1%. Iterate with `npm run compare -- <name>` until `vsHtml` is
0.00. Never edit a board or the manifest to pass; ask instead.

Conventions: CSF + `defineMeta` from `@storybook/addon-svelte-csf` (v5), a
`{#snippet template()}` per story, `parameters: { layout: 'fullscreen' }`. Run
`svelte-autofixer` on story files like any other Svelte file. `preview.ts`
imports `layout.css` (light only); a11y checks run with `test: 'todo'`.

`npm run storybook` · `npm run compare`

## Vitest

`npm test` (single run) · `npm run test:unit` (watch)

`vite.config.ts` defines **three projects**:

| Project     | Environment          | Includes                                            |
| ----------- | -------------------- | --------------------------------------------------- |
| `server`    | node                 | `tests/**/*.{test,spec}.ts` + `src/**/*.{test,spec}.ts` (excluding `.svelte.spec`) |
| `client`    | Playwright Chromium  | `src/**/*.svelte.{test,spec}.ts`                    |
| `storybook` | Playwright Chromium  | every story, via `storybookTest`                    |

So **writing a story also writes a smoke test** — the storybook project renders
each one and fails on a render error.

`expect: { requireAssertions: true }` is set globally: a test with no assertion
fails. Don't write bare "it doesn't throw" tests.

Existing node specs: `tests/editorMath.spec.ts`, `tests/crashStore.spec.ts`,
`tests/utils.spec.ts`, `tests/titles.spec.ts`, `tests/bubbleGeometry.spec.ts`.
Pure modules go in `tests/`, importing their subject through `$lib/…`; component tests use the `.svelte.spec.ts` suffix so they land in the
browser project.

## E2E (Playwright)

`npm run test:e2e` — `@playwright/test` specs in `e2e/`, one per area (first
visit, setup, capture, editor, export, lifecycle). They drive the **production
build under `/youdemo/`**, served like Pages by `npm run preview`
(`scripts/serve-build.js`).
One worker: recording is real time.

- **No test hooks in the app.** Specs drive screens by role and visible text
  through `App` in `e2e/fixtures/app.ts`: `recordTake`, `openEditor`, `cut`,
  `exportAndDownload`, `readTakes` (the takes crash recovery saved to OPFS).
- **Fake screen** (`e2e/fixtures/fakeDisplay.ts`) replaces `getDisplayMedia` with
  a canvas stamping each frame with a **barcode of its capture time**, plus a
  tone. `stopSharing()` mimics the browser's bar; `cancel` / `noMic` options.
  Camera and mic are Chromium's fake devices.
- **Export checks** (`e2e/lib/inspect.ts` + `checks.ts`): a bare page loads
  Mediabunny, demuxes and decodes the download and the takes, and reports play
  duration, frame gaps, frozen frames, which recorded moment each frame shows,
  seek index, audio length and whether every video packet is byte-identical to
  the takes (lossless).
- The viewport is 4000px wide so the frame strip renders every cell; `cut()`
  takes raw cell indices — cut later ranges first.
- **Known gaps are `test.fail()`** with a comment naming the fix; remove the
  marker when the fix lands (Playwright fails a `test.fail` that passes).
- A hidden tab can't be reproduced: headless Chromium never hides a page and
  Playwright disables background throttling. The slow-machine scenario uses CDP
  `Emulation.setCPUThrottlingRate` during export instead.

## CI

Every PR runs `npm run lint`, `npm run check` and `npm test`, and the E2E suite
as its own job. The workflow, its caching and its deliberate PR-only trigger are
in `deployment`.
