---
name: app-shell
description: The YouDemo state machine and shell — +page.svelte state ownership and transitions, camera lifecycle (armCamera/releaseCamera), the full-reset contract, editorBlob caching, the global error boundary, document titles via titles.ts, plus BrowserCheck, WelcomeModal and ErrorScreen. Load when changing app state, wiring a screen into +page.svelte, adding a transition, touching the layout/top bar, or working on titles, error handling or first-visit flow.
---

# App shell & state machine

`src/routes/+page.svelte` is the **single owner of truth**. Every screen is a pure
function of `$bindable` props (state down) + callback props (intent up); leaf
components hold no app state. See the `testing` skill for why this matters.

## Routes

| File                        | Role                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `src/routes/+layout.ts`     | `export const ssr = false` and `export const prerender = true`       |
| `src/routes/+layout.svelte` | Shell: `Tooltip.Provider`, top bar (brand + theme toggle), `<main>`  |
| `src/routes/+page.svelte`   | State machine, all streams/blobs, every transition                   |
| `src/routes/+error.svelte`  | SvelteKit error page (distinct from the in-app `ErrorScreen`)        |
| `src/routes/layout.css`     | Theme tokens — see `tailwind-theme`                                  |

Top bar (in `+layout.svelte`): `MonitorPlay` icon in `text-indigo-500` +
"YouDemo" text on the left, theme toggle on the right. It is **always** rendered —
individual screens do not draw their own top bar.

## States

`AppState` is defined in `src/lib/types.ts`:

```
check → setup → countdown → recording → review → [stitching] → editor → processing → done
```

| From         | Trigger                    | To                                            |
| ------------ | -------------------------- | --------------------------------------------- |
| `check`      | pass, OPFS takes recovered | `editor` (stitches first if >1 take)          |
| `check`      | pass, no takes             | `setup`                                       |
| `check`      | fail                       | stays — `BrowserCheck` renders the error      |
| `setup`      | screen picked              | `countdown` (auto-starts on any surface)      |
| `countdown`  | complete                   | `recording` (calls `recorderStart`)           |
| `recording`  | Stop                       | capture blob → release camera → `review`      |
| `recording`  | screen stream ended        | full reset → `setup`                          |
| `review`     | Resume                     | screen picker → `armCamera()` → `countdown`   |
| `review`     | Edit & Export              | `stitching` if >1 segment, then `editor`      |
| `review`     | Discard                    | full reset → `setup`                          |
| `editor`     | Export & Download          | `processing`                                  |
| `editor`     | Back to Review             | `review`                                      |
| `processing` | complete                   | `done` (+ `crashStore.clear()`)               |
| `done`       | New Recording              | full reset → `setup`                          |
| `done`       | Back to Editor             | `editor`                                      |
| any          | unhandled error            | `ErrorScreen` (see error boundary below)      |

`stitching` is transient and renders inline in `+page.svelte` (a `Progress` bar),
not as its own component.

## Combined Editor source

On entering the Editor, `goToEditor()` builds **one** WebM and caches it as
`editorBlob`: multiple segments go through `stitchSegments` (real-time, shows
`stitching`), a single segment is used as-is. The Editor's player, timeline,
thumbnails, duration and cuts all run off this one blob, and the same blob feeds
export (`Processing` receives `[editorBlob]`).

The cache is invalidated in exactly two places — `stopRecording()` (a new segment
was recorded) and `resetToSetup()`. Keep it that way.

## Camera lifecycle

The webcam and blur processor are live **only** during the capture flow
(setup preview → countdown → recording).

- `releaseCamera()` stops the webcam tracks and nulls `webcamStream`. Called on
  Stop, so the camera light doesn't linger through Review/Editor/Done.
- `armCamera()` re-acquires via `getUserMedia`, honouring
  `deviceStore.webcamDeviceId`. Called on Resume. It no-ops when `camEnabled` is
  false and swallows failures — a missing camera records screen-only.
- **Blur needs no restore logic.** The blur `$effect` is keyed on `blurOn` +
  `webcamStream`, so nulling the stream tears the processor down and re-arming
  rebuilds it. Don't add remember/restore code. See `background-blur`.
- The raw webcam stream is owned here, not by `Setup` or `recorder.ts`, so it
  survives a resume and there is only ever **one** camera capture.

## Full reset (`resetToSetup`)

**Cleared:** `screenStream` (tracks stopped), webcam + blur (via
`releaseCamera()`), `segments`, `editorBlob`, `editorVideoUrl` (revoked),
`outputBlob`, `bubblePosition`, `exportDeletedRanges`, all progress/elapsed
counters, and OPFS takes (`crashStore.clear()`).

**Preserved:** `micMuted`, `camEnabled`, `blurOn`, `blurIntensity`, the selected
mic/cam devices, and the theme — all persisted. See `persistence`.

## Error boundary

`+page.svelte` installs `window.onerror` and `window.onunhandledrejection` at
module scope, setting `errorMessage` + `hasError`. `hasError` short-circuits the
render before any state branch. `goToEditor()` additionally try/catches, since
stitching failures are async and would otherwise surface as an unhandled
rejection with no context.

`ErrorScreen.svelte`: `Skull` icon (`text-destructive`, 128px), the full message
and stack, a "Copy error" button, and a "Reload YouDemo" button calling
`window.location.reload()`.

## Document titles

**No component sets `document.title`.** Every title string lives in
`src/lib/titles.ts` (`titleFor(state, ctx)` + `APP_NAME` + `formatElapsed`), and
`+page.svelte` renders the result through a single `<svelte:head><title>`.

The live values feeding it — `countdownValue`, `recordingElapsed`,
`exportProgress`, `stitchProgress` — are `$state` in `+page.svelte`, bound **up**
out of the components that own the tick. If you add a state or want a dynamic
title, edit `titles.ts`; `formatElapsed` also drives the on-screen REC badge.

## BrowserCheck

Probes four APIs and renders nothing once they pass (it calls `onpass` in
`onMount`). Every probe is an overridable prop, which is what makes it
story-testable.

| Check           | API                             | Critical |
| --------------- | ------------------------------- | -------- |
| Screen capture  | `getDisplayMedia`               | yes      |
| Media recording | `MediaRecorder`                 | yes      |
| Camera access   | `getUserMedia`                  | no       |
| Audio mixing    | `AudioContext`                  | no       |

Critical failure → `Empty` with `CircleX`, no way forward. Optional-only failure →
`Empty` with `TriangleAlert` (`text-amber-500`) plus a "Continue anyway" button. A
checklist of all four renders underneath either way.

## WelcomeModal

First-visit only, gated on the `ydWelcomed` localStorage key, and it owns its own
`open` state — the parent renders `<WelcomeModal />` with no wiring. `dismiss()`
always writes the key then closes, and `onOpenChange` routes Escape/overlay
dismissal through it so the flag can't be missed.

It accepts one optional prop, `contentProps`, passed through to `Dialog.Content`.
That exists solely so Storybook can scope the dialog to a container; the app never
passes it.

Layout: `MonitorPlay` (52px, indigo) → headline → one-sentence description →
`Separator` → three `Monitor`/`Scissors`/`Download` feature rows (18px, indigo) →
full-width indigo "Let's begin" button.
