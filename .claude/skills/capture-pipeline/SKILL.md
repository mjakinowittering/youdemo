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

**Bitrates:** `videoBitsPerSecond: 5_000_000`, `audioBitsPerSecond: 128_000`.
(The stitcher uses 8 Mbps — see `video-export`.)

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

**No debug logging in hot paths** — nothing per-frame or per-export.

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
the ControlBar is disabled mid-recording — see `capture-screens`.)

## Webcam bubble compositing

**Offscreen feathered mask, not `clip()`.** The webcam frame is drawn onto a small
offscreen canvas, masked to a circle by filling with a radial-gradient under
`destination-in` (opaque to `(r - feather)/r`, transparent at the edge, feather =
3% of the radius), then blitted onto the main canvas. Clipping a circle directly
leaves a partial-coverage seam at the cardinal points — visible as straight
"borders" once the canvas is resolution-capped.

The webcam frame is **centre-cropped to a square** before drawing, matching the
preview's `object-cover`, so faces aren't stretched.

Geometry constants are duplicated in this file and in
`Recorder/WebcamBubble.svelte`:

```ts
const BUBBLE_FRAC = 0.18;  // diameter as a fraction of frame height
const PAD_FRAC = 0.025;    // corner padding, same basis
```

**Change both together.** They're fractions of frame *height* precisely so the
Setup preview and the composited recording agree at any resolution. `bubbleCoords`
here mirrors `coords()` there for the eight positions — see `capture-screens`.

## Stream ownership & teardown

- **The recorder owns** the screen stream and the mic stream it acquires. Both are
  stopped immediately in `stop()`, before the recorder finishes flushing, so the
  browser's sharing indicator clears promptly.
- **The recorder does not own the webcam.** The raw stream comes in through
  `options` and is deliberately *not* stopped in `cleanup()` — `+page.svelte`
  releases it (`releaseCamera()`), which is what lets a resume reuse it.
- `recorder.ts` only ever calls `getUserMedia` for the **mic**. It must never open
  a second camera capture: it's wasteful and some webcams reject a concurrent open.
- When `processedWebcamStream` (blurred) is present it is drawn in preference to
  the raw stream, so what the user previewed is what gets recorded. See
  `background-blur`.

## Note

`BubblePosition` is declared in both `recorder.ts` and `WebcamBubble.svelte`.
Neither imports the other's copy; keep them identical if the set ever changes.
