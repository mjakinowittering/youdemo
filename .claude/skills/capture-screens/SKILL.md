---
name: capture-screens
description: The four capture screens (Setup, Countdown, Recording, Review), the capture dock (DockBand, CaptureDock and the Mic, Cam and Blur split buttons) and the movable webcam bubble — layout, the welcome on first visit, countdown ring, REC pill, takes list, next-share row, and each control's states. Load when changing anything on the setup, countdown, recording or review screens, the dock, or the bubble.
---

# Capture screens

All live in `src/lib/components/Recorder/` and are **pure**: streams, takes,
ticks and every callback come from `+page.svelte` (`app-shell`). Each is a
column of a sand `stage` band over the `DockBand`. Their boards are
`docs/design/reference/screens/` (setup-*, countdown, recording, review*); the
behaviour is `docs/design/specs/journey.md` sections 3–6.

## Setup

- Left column (460): on first visit (`firstVisit`) the "First time here" pill,
  display heading, lead and three feature rows; otherwise "Ready when you are".
  Then **Choose what to share** (primary, large), which calls `onchoose`; the
  picker and countdown follow in `+page.svelte`. `pickError` shows under it.
- Right: the dashed preview area with `SharePlaceholder` and the live
  `WebcamBubble` (224px, 18px inset, "Drag to move" pill). Big to check
  framing, not to scale; the recording is unchanged.
- Dock live.

## Countdown

The 200px ring: a `rule` track and a tangerine arc (r 86, 10 wide, round caps)
inside a 1.5px ink circle at r 93, the numeral at 88/800. The arc drains a
third each second (`animate-drain` from `--from` to `--to`; still at the end
value under reduced motion). "Recording starts in N", the hint, and **Cancel**
(`oncancel`). `count` is a prop. Dock locked, with its note.

## Recording

REC pill (ink, rec dot, `formatElapsed(elapsed)`), "Take N", the note about
stopping the share; the live composited preview (`previewStream`, labelled
"Live recording preview") in an 820×461 ink frame; **Stop recording** (danger,
large). Dock locked.

## Review

- Heading "N takes, mm:ss in total" under the "Recording paused" eyebrow.
- Left (620): the next take's share live (or Setup's dashed placeholder once it
  has ended) with the bubble on it and the dashed slots always shown; the share
  row "Next take shares **label**" with **Change**, or "Next take: choose what
  to share" with **Choose**; the drag hint.
- Right (380): the takes card (`ListCard` labelled "Takes", scrolling, with
  **Record take N** pinned at its foot), **Discard recording** (confirmed in a
  `ConfirmDialog`), an ink rule, then **Edit and export**.
- Dock live: changes apply to the next take.

# The dock

`DockBand` is the band (rule above, centred dock, the "Mic, camera and blur can
change between takes" note when `locked`); `CaptureDock` is the card of three
`DockControl` split buttons (see `shadcn-ui`). `locked` on Countdown and
Recording; live on Setup and Review.

| Control | States (word, icon, tone)                                                     |
| ------- | ----------------------------------------------------------------------------- |
| Mic     | "Mic" `Mic01Icon` · "Muted" `MicOff01Icon`, off                                |
| Camera  | "Camera" `Video01Icon` · "Camera off" `VideoOffIcon`, off                      |
| Blur    | "Blur off" `UserIcon` · "Blur on" `BlurIcon`, on; the chevron sets intensity   |

Mic and Cam enumerate their devices in `onMount` and read/write `deviceStore`;
tooltips name the device. Blur stays usable while the camera is off, as the
board draws it. `aria-label`s name the action ("Mute microphone",
"Enable background blur"); the E2E specs use them.

# The webcam bubble

`WebcamBubble` (positioning + drag) over `WebcamBubbleFace` (the circle, 2px
ink outline, `shadow-bubble`, optional "Drag to move" pill).

- Eight spots from `previewSpot` / `previewSpotStyle` in `bubbleGeometry.ts`:
  edges `inset` from the frame's inner box, centres on its outer box. Each spot
  anchors to its own edge (CSS `right`/`bottom` for those sides) or centres with
  a `translate`, so a size change grows the bubble towards the middle.
- The dashed slots are the bubble `SLOT_SHRINK` (8px) smaller and `SLOT_INSET`
  (2px) further in. Shown always on Review, while dragging on Setup.
- Size and inset follow the frame (`previewBubble`: the recorded bubble's
  `BUBBLE_FRAC`/`PAD_FRAC`, 8px larger) unless given, as Setup gives 224/18.
- Drag with pointer capture, snap to the nearest spot on release; sets
  `bubblePosition` for the next take. A press without a move leaves it put.
  Focusable; the arrow keys step it one spot (`nextSpot`).
- **Framing check** (Review, `enlargedSize={160}`): hover or focus grows it,
  hides the slots and shows the "Check your framing" pill; a drag shrinks it
  back to scale. `enlarged` forces it on for stories.
- With no stream (stories) the face is a masked placeholder; `loading` dims it
  under a spinner while blur starts.
