# CLAUDE.md

The always-on core for YouDemo: invariants, the app's shape, and cross-cutting
conventions. Follow it precisely; do not deviate without explicit instruction.

YouDemo is a browser-only screen + webcam recorder, deployed to GitHub Pages.
Record your screen with a webcam bubble, trim it in the browser, download a
`.webm`. No backend, no SSR, no routing library. The bar is **the user's
recording is never lost or corrupted, and nothing leaves their device** — favour
correctness and durability over cleverness.

## Principles

They apply to code and to guidance (this file, the skills, the README) alike.

- **Keep it simple** — the plainest thing that works; no cleverness to save a
  line.
- **You aren't gonna need it** — build for today's requirement, not a guessed
  one; no speculative options, abstractions or documentation of what the code
  already shows.
- **Don't repeat yourself** — one home per rule, fact or helper; elsewhere,
  point to it. A rule applying everywhere lives here; a domain rule lives in its
  skill.
- **Kaizen** — leave it a little better: fix what's stale or wrong in whatever
  you touch, in small steps, rather than saving it for a rewrite.

---

## Skills Index

Each domain's patterns and worked detail live in a project skill under
`.claude/skills/`. **Load the matching skill before substantive work in its
domain.** The rules in this file hold whether or not a skill is loaded; where a
skill is more detailed, the skill wins on the _how_.

| Skill               | Load when working on…                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| `tailwind-theme`    | colours, type, shape, classes, animations, `layout.css` tokens                      |
| `shadcn-ui`         | shadcn primitives, buttons, dialogs, tooltips, menus, cards, Hugeicons              |
| `app-shell`         | the state machine, `+page`/`+layout`, titles, errors, browser check                 |
| `capture-screens`   | Setup / Countdown / Recording / Review, the capture dock, Mic/Cam/Blur              |
| `capture-pipeline`  | `recorder.ts`, canvas compositing, MediaRecorder, bubble geometry                   |
| `background-blur`   | background blur, MediaPipe, WASM assets                                             |
| `editor-timeline`   | the Editor, playback, seeking, trimming, undo, zoom, frame strip, `editorMath`      |
| `video-export`      | export, joining takes, `videoStitcher.ts`, the Editor's export phases               |
| `persistence`       | localStorage, `deviceStore`, OPFS crash recovery                                    |
| `testing`           | stories, `npm run compare`, Vitest, Playwright E2E, testability                     |
| `deployment`        | build, GitHub Pages, base paths, CI/deploy workflows, meta/OG tags                  |
| `ascii-wireframes`  | any change a user will see, before it's built; a data flow worth a sequence diagram |
| `branch-and-commit` | branching, staging, commit messages, pushing, PRs                                   |
| `todo-review`       | the README `## Todo` section — `/todo-review`, plan / add / prune an item           |

---

## Stack

SvelteKit + `adapter-static` · Svelte 5 runes · TypeScript · Tailwind v4
(CSS-first) · shadcn-svelte · Hugeicons · Figtree · canvas + `MediaRecorder` ·
fix-webm-duration · Mediabunny · `@mediapipe/tasks-vision` · Vitest (3
projects) + Storybook + a pixel compare against the design boards + Playwright
E2E · ESLint + Prettier · npm · GitHub Pages.

## App Structure

```
src/
  routes/
    +layout.svelte          # AppShell (header band + main), Tooltip.Provider
    +layout.ts              # ssr = false, prerender = true
    +page.svelte            # Root — owns the state machine and all app state
    +error.svelte           # SvelteKit error page
    layout.css              # Tailwind v4 design tokens (yd-*) + animations
  app.html                  # meta/OG/Twitter tags
  lib/
    recorder.ts             # Canvas compositor, MediaRecorder, audio mixer
    videoStitcher.ts        # Lossless export: stitchSegments + renderEditedVideo
    remuxPlan.ts            # Pure packet planning for joins and cuts (unit-tested)
    blurProcessor.ts        # MediaPipe selfie-segmentation background blur
    crashStore.ts           # OPFS crash recovery, one file per take
    deviceStore.svelte.ts   # Rune store: selected mic/cam ids, persisted
    editorMath.ts           # Pure timeline maths: cuts, undo, zoom, strip layout (unit-tested)
    bubbleGeometry.ts       # Webcam bubble size + positions, shared by preview and recorder
    share.ts                # Send or copy the link from a phone (unit-tested)
    errors.ts               # Errors in words for the error screen and export card
    titles.ts               # Every document title string
    types.ts                # AppState, EditorPhase, Take, DeletedRange
    utils.ts                # cn(), tv, exportFilename(), downloadBlob()
    index.ts  assets/
    components/
      AppShell.svelte  AppHeader.svelte  BrowserCheck.svelte  ErrorScreen.svelte
      Icon.svelte  Pill.svelte  Notice.svelte  ConfirmDialog.svelte  …  # design parts
      styles.ts             # Shared class lists for floating parts (tooltip, menu)
      Recorder/
        Setup.svelte  Countdown.svelte  Recording.svelte  Review.svelte
        WebcamBubble.svelte  WebcamBubbleFace.svelte  CaptureDock.svelte  DockBand.svelte
        Control/            # DockControl, MicControl, CamControl, BlurControl
      Editor/
        Editor.svelte       # Container — playback, zoom, trim, thumbnails, maths
        EditorView.svelte   # The screen drawn from props, every phase
        Scrubber  EditorToolbar  OverviewBar  FrameStrip  TimelineLabels  …
      ui/                   # shadcn-svelte generated — do not hand-edit
  stories/Visual/           # Components + Screens stories, one per design board
docs/design/                # The approved V2 design: boards, specs, tokens
tests/                      # Vitest node specs
e2e/                        # Playwright E2E: fixtures/, lib/ (export checks), *.spec.ts
.storybook/                 # main.ts, preview.ts
scripts/compare.mjs  copy-mediapipe-wasm.js  serve-build.js
```

## State Machine (`+page.svelte`)

```
check → setup → countdown → recording → review → editor
                    ↑ cancel │                 │ ↑
                    └────────┘   Record take N └ Back to review
```

The Editor moves through its own phases (`joining`, `ready`, `exporting`,
`failed`) without unmounting.

Full transition table, camera lifecycle and reset contract: **`app-shell`**.

---

## General Rules

**Code**

- TypeScript throughout — every file `.ts`, or `.svelte` with
  `<script lang="ts">`. No `any` — use `unknown` and narrow (the
  shadcn-generated helpers in `utils.ts` are the only exception). Explicit
  return types on exported functions.
- Svelte 5 runes only — no `writable` stores, `$:`, `export let` or `on:click`.
  On any Svelte file you write, use the Svelte MCP: `list-sections` →
  `get-documentation` for the relevant docs, then `svelte-autofixer` until it
  returns no issues. Never `playground-link`.
- **Props-driven components.** `+page.svelte` is the single owner of truth;
  every screen is a pure function of `$bindable` props (state down) + callback
  props (intent up). If a component needs real streams or singletons to render,
  push that state up (why: **`testing`**).
- No `console.log` in committed code; `console.error` only for genuine,
  otherwise-invisible failures. **Nothing in hot paths** — per-frame or
  per-export.
- **Storage keys** match `/^yd[A-Z][a-zA-Z0-9]*$/` (inventory:
  **`persistence`**).

**Capture & export**

- **`setInterval`, not rAF**, and `captureStream(0)` + `requestFrame()`, in the
  recorder's capture loop. **Opaque canvases** (`{ alpha: false }`) wherever
  frames are drawn for encoding. Why: **`capture-pipeline`**.
- **Export copies packets — never a real-time replay, and never reintroduce
  ffmpeg/WASM transcoding** without reading the history in **`video-export`**.

**UI**

- **The design in `docs/design/` is the source of truth for how it looks**: its
  boards, then `specs/journey.md`, then the other specs. Tangerine (`yd-accent`)
  is the one accent and is never text; **danger** signals destruction (details:
  **`tailwind-theme`**). Light only for now.
- **No hand-written CSS.** Tailwind classes only; the exceptions are `@theme`
  token definitions and SVG-only properties.
- shadcn-svelte primitives, restyled through the tokens and their variants
  (**`shadcn-ui`**); icons are Hugeicons through `Icon.svelte`.
- **No global keyboard shortcuts** — no `document`/`window` keydown listeners,
  no shortcuts panel, no `?` button. Element-level `onkeydown` handlers for
  Enter/Space activation on clickable non-buttons are required for a11y and are
  not shortcuts.
- Branding: the **YouDemo** wordmark in Figtree, no icon; download filename
  `youdemo-YYYY-MM-DD-HHMMSS.webm`.

---

## Workflow

- **Plan against the current `develop`** — check `git status`, then
  `git switch develop && git pull --ff-only` before exploring for a plan.
- **Draw before building** — any change a user will see gets an ASCII wireframe
  the user approves first (**`ascii-wireframes`**), unless an approved board in
  `docs/design/reference/` already draws it.
- **Match the boards** — a screen or part with a board gets a `Visual/Screens`
  or `Visual/Components` story; `npm run compare -- <name>` until it reports
  0.00, and the whole `npm run compare` exits 0 before handing over
  (**`testing`**).
- **One branch per plan**, `feature/…` or `bug/…`, cut off `develop` as the
  plan's first step; PRs target `develop` with an explicit `--base develop`
  (**`branch-and-commit`**).
- **Hand over** by listing every file created or modified, and any assumption
  the request didn't make explicit. Kaizen fixes in files you touched are
  welcome — name them in the handover rather than slipping them in.
- **Scripted edits must assert their target matched.** A PostToolUse hook runs
  `npm run format` after every edit, so a `sed`/`python` replace written against
  a remembered shape can silently match nothing. Re-read the file, assert the
  old text is present, and re-read the result.
