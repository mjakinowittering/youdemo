---
name: app-shell
description: The YouDemo state machine and shell — +page.svelte state ownership and transitions, the share and camera lifecycles, the Editor's phases and cut history, the full-reset contract, editorBlob caching, the global error boundary and ErrorScreen, document titles via titles.ts, AppShell/AppHeader, and the browser check. Load when changing app state, wiring a screen into +page.svelte, adding a transition, touching the layout or header, or working on titles, error handling or first-visit flow.
---

# App shell & state machine

`src/routes/+page.svelte` is the **single owner of truth** — the props-driven
rule in `CLAUDE.md`, with its rationale in `testing`. What changes and why, per
screen, is in `docs/design/specs/journey.md`; this skill is how it's wired.

## Routes and shell

| File                          | Role                                                      |
| ----------------------------- | --------------------------------------------------------- |
| `src/routes/+layout.ts`       | `ssr = false`, `prerender = true`                         |
| `src/routes/+layout.svelte`   | `Tooltip.Provider` around `AppShell class="h-screen"`     |
| `src/routes/+page.svelte`     | State machine, all streams/blobs, every transition        |
| `src/routes/+error.svelte`    | SvelteKit error page (not the in-app `ErrorScreen`)       |
| `components/AppShell.svelte`  | Positioned column: `AppHeader` over `<main>`; dialogs cover it |
| `components/AppHeader.svelte` | The "YouDemo" wordmark band — no icon, no controls        |

Screens draw their own bands (`stage`, `dock`, `breadcrumb`, `timeline`,
`footer`) inside `<main>`; the visual stories' `ScreenFrame` uses the same
`AppShell`, so they lay out alike.

## States

`AppState` in `src/lib/types.ts`:

```
check → setup → countdown → recording → review → editor
                    ↑ cancel │                 │ ↑
                    └────────┘   Record take N └ Back to review
```

| From        | Trigger                       | To                                                 |
| ----------- | ----------------------------- | -------------------------------------------------- |
| `check`     | pass (or Continue on limited) | `setup`, or `editor` if OPFS takes are recovered   |
| `check`     | blocking failure              | stays — the phone screen                           |
| `setup`     | Choose what to share          | picker → `countdown`                               |
| `countdown` | 3, 2, 1, 0                    | `recording`                                        |
| `countdown` | Cancel, or the share ends     | `setup`, or `review` if takes exist                |
| `recording` | Stop, or the share ends       | take kept and saved → `review`                     |
| `review`    | Record take N                 | `countdown` (picker first if the share has ended)  |
| `review`    | Change / Choose               | picker, stays on `review`                          |
| `review`    | Edit and export               | `editor`                                           |
| `review`    | Discard (confirmed)           | full reset → `setup`                               |
| `editor`    | Back to review                | `review`, cuts kept                                |
| `editor`    | Discard / New recording (confirmed) | full reset → `setup`                         |
| any         | unhandled error               | `ErrorScreen`                                      |

**Ending the share from the browser** ("Stop sharing") behaves like Stop while
recording, cancels the countdown, and on Review turns the share row to "Next
take: choose what to share".

## The Editor's phases

`EditorPhase`: `joining` → `ready` ⇄ `exporting` → `ready` or `failed`. The
Editor mounts at once; `+page.svelte` runs the async work and passes the phase
and progress down, so a story can render any phase.

- **Joining**: several takes are joined once into `editorBlob` (a lossless
  packet copy, `stitchSegments`) and cached until the takes change —
  invalidated in `stopRecording()` and `resetToSetup()` only.
- **Exporting**: `renderEditedVideo(editorBlob, cuts)`, then `downloadBlob`
  with the name fixed when the Export dialog opened; `exportedFile` shows the
  Exported notice. **The crash store is not cleared on export.**
- **Failed**: `exportError` feeds the export-failed card (Try again, Copy error).

The cuts live here as a `CutHistory` (`editorMath.ts`), bound down, so they
survive Back to review and any remount.

## Shares and the camera

- **The share** (`screenStream`, `shareLabel`) outlives a take, so Record take
  N reuses it. It ends on reset, on entering the Editor (assumed: no sharing
  while editing), or from the browser's bar. `chooseShare()` is the one place
  the picker opens; a share picked for the take counting down is stopped again
  by Cancel.
- **The camera** is live on every capture screen (Setup through Review) and
  released for the Editor, by an `$effect` on `cameraWanted` and the selected
  device. The recorder never opens its own camera.
- Blur follows the camera stream through its own effect (`background-blur`).

## Ticks

The countdown and recording timers tick here (`countdownValue`,
`recordingElapsed`), not in the screens, so a screen renders a given moment
from props and the title follows.

## Full reset (`resetToSetup`)

**Cleared:** the share, preview stream, takes, `editorBlob` and its URL, the
cut history, the export state, counters, the discard dialog, and OPFS takes
(`crashStore.clear()`). **Kept:** `micMuted`, `camEnabled`, `blurOn`,
`blurIntensity`, the selected devices and `ydWelcomed` (see `persistence`).
The camera stays live for Setup.

## First visit

Until `ydWelcomed` is set, Setup carries the welcome (`firstVisit`); it is set
when the first take starts.

## Error boundary

`window.onerror` and `onunhandledrejection` call `showError(error)`, which also
checks whether the crash store holds takes. `hasError` pre-empts every screen.
`ErrorScreen` shows the reason in words (`errorReason` in `errors.ts`), "Your
recording is safe" when it is, Reload YouDemo, Copy error and a collapsed
Technical details.

## Document titles

**No component sets `document.title`.** Every string lives in `titles.ts`
(`titleFor(state, ctx)`); `+page.svelte` renders it in one `<svelte:head>`. The
Editor's titles follow its phase: "Joining takes… 64%", "Exporting… 64%",
"Exported", otherwise "Editing".

## BrowserCheck

Every probe is an overridable prop, which is what makes it story-testable.

| Check           | API               | Failure means |
| --------------- | ----------------- | ------------- |
| Screen capture  | `getDisplayMedia` | blocking      |
| Media recording | `MediaRecorder`   | blocking      |
| Camera access   | `getUserMedia`    | limited       |
| Audio mixing    | `AudioContext`    | limited       |

All pass → `onpass` straight away. **Blocking** (in practice a phone): "YouDemo
needs a computer", Send the link (Web Share, hidden where `navigator.share` is
missing) and the link to copy, through `share.ts`. **Limited**: each
capability in words and "Continue without them".
