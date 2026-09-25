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
| `tailwind-theme`    | colours, classes, animations, dark mode, `layout.css`                               |
| `shadcn-ui`         | shadcn primitives, empty states, tooltips, cards, icons                             |
| `app-shell`         | the state machine, `+page`/`+layout`, titles, errors, welcome/check                 |
| `capture-screens`   | Setup / Countdown / Recording / Review, ControlBar, Mic/Cam/Blur                    |
| `capture-pipeline`  | `recorder.ts`, canvas compositing, MediaRecorder, bubble geometry                   |
| `background-blur`   | background blur, MediaPipe, WASM assets                                             |
| `editor-timeline`   | the Editor, playback, seeking, trimming, frame strip, `editorMath`                  |
| `video-export`      | export, stitching, `videoStitcher.ts`, Processing, Done                             |
| `persistence`       | localStorage, `deviceStore`, OPFS crash recovery                                    |
| `testing`           | stories, Vitest, testability                                                        |
| `deployment`        | build, GitHub Pages, base paths, CI/deploy workflows, meta/OG tags                  |
| `ascii-wireframes`  | any change a user will see, before it's built; a data flow worth a sequence diagram |
| `branch-and-commit` | branching, staging, commit messages, pushing, PRs                                   |
| `todo-review`       | the README `## Todo` section — `/todo-review`, plan / add / prune an item           |

---

## Stack

SvelteKit + `adapter-static` · Svelte 5 runes · TypeScript · Tailwind v4
(CSS-first) · shadcn-svelte · `@lucide/svelte` · canvas + `MediaRecorder` ·
fix-webm-duration · `@mediapipe/tasks-vision` · Vitest (3 projects) + Storybook
· ESLint + Prettier · npm · GitHub Pages.

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
    bubbleGeometry.ts       # Webcam bubble size + positions, shared by preview and recorder
    types.ts                # AppState, DeletedRange
    utils.ts                # cn(), exportFilename()
    index.ts  assets/
    components/
      BrowserCheck.svelte  ErrorScreen.svelte  WelcomeModal.svelte
      Recorder/
        Setup.svelte  Countdown.svelte  Recording.svelte  Review.svelte
        WebcamBubble.svelte  ControlBar.svelte
        Control/            # MicControl, CamControl, BlurControl
      Editor/
        Editor.svelte       # Shell — owns state, composes the five below
        VideoPlayer.svelte  Scrubber.svelte  EditorToolbar.svelte
        FrameStrip.svelte  EditorFooter.svelte
        Processing.svelte  Done.svelte
      ui/                   # shadcn-svelte generated — do not hand-edit
  stories/                  # Storybook, mirrors the component folders
tests/                      # Vitest node specs
.storybook/                 # main.ts, preview.ts
scripts/copy-mediapipe-wasm.js
```

## State Machine (`+page.svelte`)

```
check → setup → countdown → recording → review → [stitching] → editor → processing → done
```

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

- **`setInterval`, not rAF**, and `captureStream(0)` + `requestFrame()`, in
  every capture/encode loop. **Opaque canvases** (`{ alpha: false }`) in the
  recorder and stitcher. Why: **`capture-pipeline`**.
- **Native export — never reintroduce ffmpeg/WASM transcoding** without reading
  the history in **`video-export`**.

**UI**

- **indigo-500** is the accent everywhere; **red/destructive** signals
  destruction (details: **`tailwind-theme`**).
- **No hand-written CSS.** Tailwind classes only; the exceptions are `@theme`
  token definitions and SVG-only properties.
- shadcn-svelte primitives used as-is; **shadcn `Empty`** for every empty state
  (**`shadcn-ui`**).
- **No global keyboard shortcuts** — no `document`/`window` keydown listeners,
  no shortcuts panel, no `?` button. Element-level `onkeydown` handlers for
  Enter/Space activation on clickable non-buttons are required for a11y and are
  not shortcuts.
- Branding: **YouDemo**, `MonitorPlay` icon, download filename
  `youdemo-YYYY-MM-DD-HHMMSS.webm`.

---

## Workflow

- **Plan against the current `develop`** — check `git status`, then
  `git switch develop && git pull --ff-only` before exploring for a plan.
- **Draw before building** — any change a user will see gets an ASCII wireframe
  the user approves first (**`ascii-wireframes`**).
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
