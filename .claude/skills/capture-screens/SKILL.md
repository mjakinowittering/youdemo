---
name: capture-screens
description: The four capture screens (Setup, Countdown, Recording, Review) and the shared ControlBar with its Mic, Cam and Blur controls — layout, empty states, screen picker, countdown timing, REC badge, and each control's variant/tooltip table. Load when changing anything on the setup, countdown, recording or review screens, or any mic/camera/blur control.
---

# Capture screens

All four live in `src/lib/components/Recorder/`. Each is `flex h-full flex-col`
with a content area and the shared `ControlBar` as its footer. The top bar comes
from `+layout.svelte` — screens don't draw one. See `app-shell` for how they're
wired and `tailwind-theme` for colours.

## Shared layout idiom

Setup, Recording and Review all use the same clickable-`Card.Root` pattern for
their primary action: `role="button"` + `tabindex={0}` + Enter/Space `onkeydown`
on the card, with a `pointer-events-none` `<div>` styled by `buttonVariants` as
the visible CTA. Details in `shadcn-ui`.

## Setup.svelte

- **Preview area** — live screen stream (`object-contain`) or, when there's no
  stream, an `Empty` inside a clickable card.
- **Empty state** — `Clapperboard` icon at `size={128}`, title "No screen
  selected", description "Choose a screen and recording starts straight away",
  CTA "Start Recording" (indigo; reads "Requesting…" while the picker is open).
- **Screen picker** — clicking the card calls `getDisplayMedia({ video: true,
  audio: true })` and then `onstart()` immediately. **Recording auto-starts on any
  surface** (tab, window or screen); there is no separate start step. A
  `NotAllowedError` (user cancelled) is silent; other failures set `pickError`.
- **Stream ended** during setup → tracks stopped, `screenStream` nulled, back to
  the empty state.
- **Webcam preview** — a `$effect` keyed on `camEnabled` +
  `deviceStore.webcamDeviceId` acquires/tears down the preview stream, writing to
  the bound `webcamStream` so `+page.svelte` owns it. Uses `untrack` around the
  writes to avoid self-triggering.
- `WebcamBubble` renders only when `camEnabled`. `ControlBar` is `disabled={false}`
  — this is the only screen where the controls are interactive.

`screenAspect` is captured from `onloadedmetadata` and passed to `WebcamBubble` so
the bubble lines up with the composited frame (see `capture-pipeline`).

## WebcamBubble.svelte

Type `BubblePosition` is exported from this file (not `types.ts`).

- **Fixed size, no resize.** Diameter and padding are fractions of the *frame*
  height: `BUBBLE_FRAC = 0.18`, `PAD_FRAC = 0.025`. The same constants are
  duplicated in `recorder.ts` — **change both together** or preview and recording
  drift apart.
- Positions against the **letterboxed video rect**, derived from `screenAspect`,
  not the raw container, because the composited frame has no letterbox bars.
  `screenAspect === 0` falls back to filling the container.
- 8 snap positions: `tl tr bl br tc rc bc lc`. Default `tr`.
- **Draggable**: pointer capture, clamped to the frame rect, snapping to the
  nearest position on release. While dragging, the seven other positions render as
  translucent ghost circles.
- A `ResizeObserver` (via an `{@attach}`) keeps the container dimensions current.
- Styling: `rounded-full ring-2 ring-indigo-500`, video is `object-cover` (square
  centre-crop, matching the recorder). Falls back to a "No cam" placeholder.
- Prefers `processedStream` (blurred) over the raw `stream` when present, so the
  preview shows exactly what gets recorded.
- Visible in Setup only — hidden from countdown onwards.

## Countdown.svelte

Overlay (`absolute inset-0`), so its story shell needs `relative`.

- 3 → 2 → 1 → 0, one second each (`STEP = 1000`), then a 300ms hold on 0
  (`ZERO_HOLD`) before `oncomplete()`.
- Number: `text-7xl font-bold text-indigo-500 tabular-nums`.
- **Card-flip between counts** via local `flipIn`/`flipOut` Svelte transitions
  (`rotateX` ±90° + opacity, 250/200ms) inside a `{#key count}` block, with
  `perspective:400px` on the parent.
- Ring: an SVG circle with `stroke-dasharray={CIRC}` (452.4 ≈ 2πR, R=72) driven by
  the `animate-deplete` keyframe token, re-keyed each count. See `tailwind-theme`.
- Beep: a Web Audio `OscillatorNode` at 880Hz with a 150ms exponential gain ramp,
  fired on every count. Wrapped in try/catch — no AudioContext means a silent
  countdown, not a crash.
- `count` is `$bindable` so `+page.svelte` can put it in the document title.

## Recording.svelte

- **Empty state** — `Tv` icon at `size={128}`, title "Recording in progress". The
  whole card is the stop target; the CTA is a destructive "Stop Recording" with a
  filled `Square` icon.
- **REC badge** — `absolute top-4 left-4`, black translucent pill: a
  `animate-rec-pulse` red dot, "REC", and `elapsed` formatted by `formatElapsed`
  from `titles.ts` (the same helper the document title uses).
- The elapsed timer is a 1s `setInterval` started in `onMount`, cleared on stop and
  in `onDestroy`. `elapsed` is `$bindable` — `+page.svelte` reads it for the title.
- A `$effect` (not `onMount`, so teardown is reliable) listens for the screen
  track's `ended` event and calls `onstreamended`.
- `ControlBar` is `disabled={true}`.

## Review.svelte

Three cards in a row (`flex-col sm:flex-row`), each fully clickable:

| Card              | Icon           | Button label | Variant       | Callback    |
| ----------------- | -------------- | ------------ | ------------- | ----------- |
| Resume recording  | `Clapperboard` | Continue     | `outline`     | `onresume`  |
| Edit recording    | `Film`         | Continue     | `outline`     | `onedit`    |
| Discard recording | `Trash2`       | Discard      | `destructive` | `ondiscard` |

Rendered from a single `{#snippet actionCard(...)}` — add a card by calling the
snippet, not by copying markup. Destructive cards get `text-destructive` and
`hover:ring-destructive`; the others get indigo.

No freeze-frame, no duration/mic/cam badges. `ControlBar` is `disabled={true}`.

# ControlBar & controls

`ControlBar.svelte` is the footer on **all three** of Setup, Recording and Review —
the markup exists once. Props are all `$bindable` (`micMuted`, `camEnabled`,
`blurOn`, `blurIntensity`) plus a plain `disabled` flag.

`disabled` is `false` on Setup only. Recording and Review show the state chosen in
Setup but can't be operated: streams are locked in at `recorderStart()`, and a
disabled control is far simpler than coding around mid-recording toggles.

All three controls share the button+chevron composition described in `shadcn-ui`.

## MicControl / CamControl

`src/lib/components/Recorder/Control/`. Each enumerates its own devices in
`onMount` via `enumerateDevices()` (filtered to `audioinput` / `videoinput`),
defaults `deviceStore` to the first device if unset, and reads/writes
`deviceStore` from the dropdown. The tooltip shows the selected device label.

| State           | Variant       | Icon     |
| --------------- | ------------- | -------- |
| Mic live        | `outline`     | `Mic`    |
| Mic muted       | `destructive` | `MicOff` |
| Cam enabled     | `outline`     | `Video`  |
| Cam disabled    | `destructive` | `VideoOff` |

Empty device list renders a non-interactive "No microphones found" item.

## BlurControl

Pure UI — it owns **no** processor. `+page.svelte` owns the `BlurProcessor` and
reacts to `blurOn` / `blurIntensity`; see `background-blur`.

Props: `blurOn` and `intensity` (both `$bindable`), plus `camEnabled` and
`disabled`. It is disabled whenever `disabled || !camEnabled`.

| State                 | Variant       | Icon               |
| --------------------- | ------------- | ------------------ |
| Off, cam enabled      | `outline`     | `UserRound`        |
| On, cam enabled       | `success`     | `CircleUserRound`  |
| Cam off (any)         | `destructive` | `UserRound`        |

Chevron sets intensity via a `RadioGroup` — Light / Default / Heavy — and works
whether blur is on or off. Tooltip: "Background blur off" · "Background blur —
Light" · "Background blur" · "Background blur — Heavy".
