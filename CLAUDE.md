# YouDemo — Project Spec

A browser-only screen + webcam recorder, deployed to GitHub Pages. Record your
screen with a webcam bubble, trim it in the browser, download a `.webm`. No
backend, no SSR, no routing library, nothing uploaded.

## Skill index

Detailed specs live in `.claude/skills/`. Load the one that matches the task
rather than guessing — each is the source of truth for its area.

| Working on…                                                       | Skill              |
| ----------------------------------------------------------------- | ------------------ |
| Colours, classes, animations, dark mode, `layout.css`             | `tailwind-theme`   |
| shadcn primitives, empty states, tooltips, cards, icons           | `shadcn-ui`        |
| State machine, `+page`/`+layout`, titles, errors, welcome/check   | `app-shell`        |
| Setup / Countdown / Recording / Review, ControlBar, Mic/Cam/Blur  | `capture-screens`  |
| `recorder.ts`, canvas compositing, MediaRecorder, bubble geometry | `capture-pipeline` |
| Background blur, MediaPipe, WASM assets                           | `background-blur`  |
| Editor, playback, seeking, trimming, frame strip, `editorMath`    | `editor-timeline`  |
| Export, stitching, `videoStitcher.ts`, Processing, Done           | `video-export`     |
| localStorage, `deviceStore`, OPFS crash recovery                  | `persistence`      |
| Stories, Vitest, CI, testability                                  | `testing`          |
| Build, GitHub Pages, base paths, meta/OG tags                     | `deployment`       |

## Tech Stack

- **SvelteKit** + `@sveltejs/adapter-static`
- **Svelte 5** with runes (`$state`, `$effect`, `$derived`, `$props`,
  `$bindable`)
- **TypeScript** throughout — every file `.ts` or `.svelte` with
  `<script lang="ts">`
- **Tailwind CSS v4** — CSS-first config in `src/routes/layout.css`
- **shadcn-svelte** (Svelte 5 track) — UI primitives, used as-is
- **@lucide/svelte** — icons, one per line by deep path
  (`@lucide/svelte/icons/x`)
- **Native export — no ffmpeg.** Combining and trimming replay footage through a
  canvas + `MediaRecorder` (`videoStitcher.ts`). ffmpeg.wasm was removed because
  it crashes on Chrome's MediaRecorder output — see `video-export`.
- **fix-webm-duration** — patches the WebM duration header after recording. Its
  `Duration section is missing` console line is benign.
- **`@mediapipe/tasks-vision`** — in-browser selfie segmentation for webcam blur
- **Vitest** (3 projects) + **Storybook** (`@storybook/sveltekit`) — see
  `testing`
- **ESLint + Prettier**, **npm**

## App Structure

```
src/
  routes/
    +layout.svelte          # Shell — top bar, theme toggle, Tooltip.Provider
    +layout.ts              # ssr = false, prerender = true
    +page.svelte            # Root — owns the state machine and all app state
    +error.svelte           # SvelteKit error page
    layout.css              # Tailwind v4 theme tokens + custom animations
  app.html                  # dark by default, meta/OG/Twitter tags
  lib/
    recorder.ts             # Canvas compositor, MediaRecorder, audio mixer
    videoStitcher.ts        # Native export: stitchSegments + renderEditedVideo
    blurProcessor.ts        # MediaPipe selfie-segmentation background blur
    crashStore.ts           # OPFS crash recovery, one file per take
    deviceStore.svelte.ts   # Rune store: selected mic/cam ids, persisted
    editorMath.ts           # Pure timeline/edit maths (unit-tested, no DOM)
    titles.ts               # Every document title string
    types.ts                # AppState, DeletedRange
    utils.ts                # cn()
    components/
      BrowserCheck.svelte
      ErrorScreen.svelte
      WelcomeModal.svelte
      Recorder/
        Setup.svelte  Countdown.svelte  Recording.svelte  Review.svelte
        WebcamBubble.svelte  ControlBar.svelte
        Control/
          MicControl.svelte  CamControl.svelte  BlurControl.svelte
      Editor/
        Editor.svelte         # Shell — owns state, composes the five below
        VideoPlayer.svelte  Scrubber.svelte  EditorToolbar.svelte
        FrameStrip.svelte  EditorFooter.svelte
        Processing.svelte  Done.svelte
      ui/                     # shadcn-svelte generated — do not hand-edit
  stories/                    # Storybook, mirrors the component folders
tests/                        # Vitest node specs
.storybook/                   # main.ts, preview.ts
scripts/copy-mediapipe-wasm.js
```

## State Machine (`+page.svelte`)

```
check → setup → countdown → recording → review → [stitching] → editor → processing → done
```

`+page.svelte` is the single owner of truth. Every screen is a pure function of
`$bindable` props (state down) + callback props (intent up). Full transition
table, camera lifecycle and reset contract: `app-shell`.

## Non-negotiable invariants

- **indigo-500** is the accent everywhere; **red/destructive** signals
  destruction (Discard, Delete, mute, cam-off, selected frames, REC dot).
- **No hand-written CSS.** Tailwind classes only; the exceptions are `@theme`
  token definitions and SVG-only properties.
- **shadcn `Empty`** for every empty state.
- **No global keyboard shortcuts** — no `document`/`window` keydown listeners,
  no shortcuts panel, no `?` button. Element-level `onkeydown` handlers for
  Enter/Space activation on clickable non-buttons are required for a11y and are
  not shortcuts.
- **Native export — never reintroduce ffmpeg/WASM transcoding** without reading
  the history in `video-export`.
- **Opaque canvases** (`{ alpha: false }`) in the recorder and stitcher.
- **`setInterval`, not rAF**, and `captureStream(0)` + `requestFrame()`, in
  every capture/encode loop.
- **No debug logging in hot paths** — nothing per-frame or per-export.
- **Storage keys** match `/^yd[A-Z][a-zA-Z0-9]*$/`.
- **Props-driven components.** If a component needs real streams or singletons
  to render, push that state up to `+page.svelte`.
- Branding: **YouDemo**, `MonitorPlay` icon, download filename
  `youdemo-YYYY-MM-DD-HHMMSS.webm`.

## Working Method

Build one step at a time. After each step:

1. Stop and describe what was built
2. List every file created or modified
3. Explain any assumptions not explicit in the spec
4. List what comes next
5. Wait for explicit approval

## Svelte MCP Tools

For every Svelte file:

1. **`list-sections`** — call FIRST to discover relevant documentation sections
2. **`get-documentation`** — fetch ALL sections relevant to the current task
3. **`svelte-autofixer`** — MUST be called on every Svelte file before
   presenting. Keep calling until no issues are returned
4. **`playground-link`** — do NOT use. All code is written directly to project
   files

Fetch <https://www.shadcn-svelte.com/llms.txt> before using any shadcn
component.

## Feedback & Change Requests

- Re-read CLAUDE.md and the relevant skill before any changes
- Only modify files explicitly listed in the prompt
- Run `svelte-autofixer` on any Svelte files changed
- Stop when done and list every file modified
