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
- **Side effects are callback props** — `onstart`, `onstop`, `onresume`, `onedit`,
  `ondiscard`, `oncomplete`, `onbacktoeditor`, `onnewrecording`. A component
  signals intent by calling a prop; it never reaches into the state machine.
- Even capability probes are props — `BrowserCheck` takes `hasScreenCapture` etc.
  so failure modes are renderable.

**If a component can't be fully exercised from props in a story, that's a design
smell — push the state up to `+page.svelte`.**

Pure logic goes further: `editorMath.ts` and `titles.ts` exist so timeline maths
and title strings can be tested in plain node with no DOM at all. New pure logic
belongs there, not inline in a component.

## Storybook

Stories live at `src/stories/<Area>/<Component>.stories.svelte` (areas mirror the
component folders: `Recorder/`, `Editor/`, plus one folder each for
`BrowserCheck`, `WelcomeModal`, `ErrorScreen`). Config is in `.storybook/`.

`npm run storybook` · `npm run build-storybook`

### Conventions

- **CSF + `defineMeta`** from `@storybook/addon-svelte-csf` (v5). Title
  `Components/<Area>/<Name>`, `tags: ['autodocs']`,
  `parameters: { layout: 'fullscreen' }`.
- **Shared shell via a `template` snippet** wired in as the meta-level
  `render: template`. `setTemplate` does **not** exist in v5. Define the snippet
  once in the markup; every `<Story>` reuses it.
- **Type the snippet arg as `ComponentProps<typeof X>`** (from `svelte`). Do
  **not** use `Args<typeof Story>` — `Story` derives from `render`, so it
  self-references and errors.
- **Shell wrapper:** `<div class="h-256 bg-background text-foreground">` — screens
  are `h-full`, so the shell supplies a fixed tall height. Strip-like components
  that size themselves (`FrameStrip`) drop the height and keep the colours.
- The wrapper must **not** carry a `dark` class. Theme is global, driven by the
  toolbar switcher.
- **`Tooltip.Provider` is required** for anything rendering `ControlBar` (Setup,
  Recording, Review) — shadcn `Tooltip` throws without a provider ancestor. The
  app supplies one in `+layout.svelte`; components without tooltips (Done,
  Countdown, FrameStrip) omit it.
- **Every callback prop gets an `fn()` spy** (from `storybook/test`) in `args`.
- **Streams and blobs default to `null`** so nothing fires unexpectedly on load —
  `Done`'s auto-download, `Setup`'s `getUserMedia`.
- Add `argTypes` controls for enum-ish props (`blurIntensity`, `bubblePosition`)
  so they're explorable.
- **Variants** cover the meaningful prop states — typically Default, Mic muted,
  Camera off, Blur on for capture screens; a single Default where there are no
  toggles.
- Run `svelte-autofixer` on story files like any other Svelte file.

### Addons

`@storybook/addon-svelte-csf`, `addon-vitest`, `addon-a11y`, `addon-docs`,
`addon-themes`, `@chromatic-com/storybook`.

`preview.ts` imports `../src/routes/layout.css` — without it stories render
unstyled — and registers `withThemeByClassName` (`{ light: '', dark: 'dark' }`,
`defaultTheme: 'dark'`, `parentSelector: 'html'`), giving a Light/Dark toolbar
switcher for visual-testing every screen in both themes. Because it toggles `dark`
on `<html>` and the shadcn tokens live on `:root`/`.dark`, story shells must not
hard-code `dark` themselves.

a11y checks run with `test: 'todo'` — violations surface in the test UI but don't
fail CI.

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
build under `/youdemo/`**, served like Pages by `scripts/serve-build.js` (not
`vite preview`, which lacks the MediaPipe WASM `postbuild` copies into `build/`).
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
