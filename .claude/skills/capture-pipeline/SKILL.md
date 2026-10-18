---
name: capture-pipeline
description: recorder.ts internals — canvas compositing of screen + webcam bubble, the MediaRecorder setup, audio mixing, codec probe, resolution cap, WebM duration fix and track teardown. Load when changing how recording works, debugging a corrupt/silent/short WebM, a renderer crash while recording, or the composited bubble's size or position.
---

# Recording pipeline (`src/lib/recorder.ts`)

A module-level singleton: `start(options)` builds the whole graph, `stop()`
returns the finished `Blob`. Screen video and webcam video are drawn onto one
canvas 30×/sec; the canvas stream plus a mixed audio track feed a `MediaRecorder`.

`+page.svelte` calls it — see `app-shell` for lifecycle and ownership.

## Non-negotiable implementation rules

Each of these looks arbitrary and is not. Do not "clean them up".

**`setInterval`, never `requestAnimationFrame`.** Chrome throttles rAF to ~1fps in
background tabs, which would stall the recording whenever the user switches away.

```ts
_intervalId = setInterval(drawFrame, 1000 / 30);
_recorder.start(500);
```

**`captureStream(0)` + `requestFrame()`** — manual frame control. Never
`captureStream(30)`; the track must be driven explicitly at the end of every
`drawFrame()`.

**Opaque canvas — `getContext('2d', { alpha: false })`.** With an alpha channel
Chrome encodes VP9 with an alpha plane (`alpha_mode: 1`), which breaks downstream
tooling. The composite is fully opaque anyway — the screen fills every frame.

**Wait for `readyState >= 2`** on both video elements before sizing the canvas and
starting (`videoReady()`).

**Resolution cap.** `cappedDimensions()` scales the canvas so its longest edge ≤
`MAX_DIM` (1920), keeping even dimensions. Uncapped 1440p/4K software VP9
compositing + encode is the main cause of renderer crashes ("white screen") mid
recording.

**A window share loses its shadow margin.** Sharing one window can bring the
window's see-through shadow with it, which the opaque canvas records as black
bands (deeper below, as GNOME draws them). When the track's `displaySurface`
is `'window'`, `measureMargins()` reads one frame through `blackMargins()`
(`windowCrop.ts`, unit-tested) at start and again on the video's `resize`; the
canvas is sized to the window without them and `drawFrame()` draws only the
inner rect, so the bubble sits inside the window. An edge is cropped only where
every pixel of a line is near-black, and never once the band reaches 12% of the
frame (that's content). Measuring reads pixels, so it never runs per frame.
The E2E fake can share a window with a margin (`windowMargins`).

**Bitrates:** `videoBitsPerSecond: 5_000_000`, `audioBitsPerSecond: 128_000`.
`VIDEO_BITS_PER_SECOND` is exported: export's re-encode fallback reuses it.

**A keyframe on every editor cell, by time** —
`videoKeyFrameIntervalDuration: KEYFRAME_AFTER_MS`, half a frame short of
`SAMPLE_INTERVAL` (≈183 ms). Export cuts by copying packets, and a copied
stretch must start on a keyframe; Chrome's default is one keyframe at the start,
which would make every cut snap to 0 or force a re-encode. Chrome keys the first
frame at least that long after the last keyframe (`now >= last + duration`), so
at 30 fps it's every 6th frame (0.2 s); a full 200 ms misses the 6th frame by a
hair and makes 7-frame groups. **Never a count** (`videoKeyFrameIntervalCount`):
when the machine falls behind and frames come late, 6 frames span more than a
cell and the keys drift apart — on the CI runner up to 0.46 s. Chrome takes one
of the two options, not both. The option isn't in TypeScript's DOM typings yet,
hence the intersection type. The E2E export suite checks that no frame sits a
cell or more after its keyframe (`maxKeyframeLag`). See `video-export`.

**Codec probe** — first supported wins:

```ts
const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm'
];
```

**Always apply `fixWebmDuration(blob, durationMs)`** before resolving. Its
`[fix-webm-duration] Duration section is missing` console line is benign — the
library logs it, then inserts a correct Duration. Without this the blob has no
duration header and the Editor can't seek it.

## Audio graph

System audio (from the screen stream's audio tracks) + mic are mixed through an
`AudioContext` into a `MediaStreamAudioDestinationNode`, whose track is added to
the canvas stream. The destination is **never** connected to `ctx.destination`, so
nothing is echoed to the speakers.

**The silent `ConstantSource` is load-bearing.** With no mic and no tab audio, an
input-less destination hands `MediaRecorder` an Opus track with zero packets, and
Chromium then rejects the resulting WebM with "The element has no supported
sources" when the Editor loads it. A started `createConstantSource()` at
`offset = 0` guarantees the track always carries samples. It is inaudible. Don't
remove it.

Mute is a graph operation, not a track flag: `setMicMuted()` connects/disconnects
`_micNode` from the destination. (In practice mute is fixed at `start()` because
the dock is locked mid-recording — see `capture-screens`.)

## Webcam bubble compositing

**Offscreen feathered mask, not `clip()`.** The webcam frame is drawn onto a small
offscreen canvas, masked to a circle by filling with a radial-gradient under
`destination-in` (opaque to `(r - feather)/r`, transparent at the edge, feather =
3% of the radius), then blitted onto the main canvas. Clipping a circle directly
leaves a partial-coverage seam at the cardinal points — visible as straight
"borders" once the canvas is resolution-capped.

The webcam frame is **centre-cropped to a square** before drawing, matching the
preview's `object-cover`, so faces aren't stretched.

**Geometry lives in `src/lib/bubbleGeometry.ts`**, shared with the Setup preview
(`WebcamBubble.svelte`) so the two cannot drift: `BubblePosition`,
`BUBBLE_POSITIONS`, `BUBBLE_FRAC` (0.18, diameter) and `PAD_FRAC` (0.025, corner
padding), and `bubbleCoords(pos, frame)`. Sizes are fractions of frame *height* so
preview and recording agree at any resolution. The recorder passes the whole canvas
as the frame; the preview passes its letterboxed rect. Covered by
`tests/bubbleGeometry.spec.ts`.

## Live preview and the picker

`start()` resolves with a **video-only** `MediaStream` holding the canvas capture
track itself — not a clone, and no audio, so the preview can't echo. `+page.svelte`
keeps it as `previewStream` for the Recording screen; it ends with the recorder.

`DISPLAY_MEDIA_OPTIONS` is the one screen-picker request (`chooseShare()` in
`+page.svelte`, from Setup and Review):
`selfBrowserSurface: 'exclude'` keeps the YouDemo tab out of the picker so the
preview isn't recorded inside itself. A whole-screen share with YouDemo visible
still mirrors — accepted.

## Stream ownership & teardown

- **The recorder owns only the mic stream** it acquires, stopped in `stop()`.
- **It does not own the share or the webcam.** Both come in through `options`
  and are deliberately *not* stopped: `+page.svelte` keeps them for the next
  take (Record take N reuses a live share) and stops them on reset or on
  entering the Editor (`app-shell`).
- `stop()` resolves with the `Take`: the duration-fixed blob and its length in
  seconds, which Review lists.
- `recorder.ts` only ever calls `getUserMedia` for the **mic**. It must never open
  a second camera capture: it's wasteful and some webcams reject a concurrent open.
- When `processedWebcamStream` (blurred) is present it is drawn in preference to
  the raw stream, so what the user previewed is what gets recorded. See
  `background-blur`.
