---
name: video-export
description: Lossless video export — videoStitcher.ts (stitchSegments, renderEditedVideo) copying recorded packets with Mediabunny, the pure remuxPlan.ts, the re-encode fallback, the Processing screen, the Done screen and download filename, plus the history of why ffmpeg.wasm and the real-time canvas replay were removed. Load when changing export, combining segments, applying trims, export progress, or before ever proposing ffmpeg/WASM transcoding or a real-time replay.
---

# Export (`src/lib/videoStitcher.ts`)

**Lossless, by copying packets — no decoding, no re-encoding, no real time.**
Joining takes and applying cuts both copy the recorded video and audio packets
byte for byte into a new WebM, restamped. [Mediabunny](https://mediabunny.dev)
(pure TypeScript) reads and writes the WebM; the pure `src/lib/remuxPlan.ts`
decides which packets go where. An export takes well under a second and can't
drop frames or lose quality; the output has a real duration and a seek index
(Cues).

```ts
stitchSegments(blobs, onProgress): Promise<Blob>       // takes back to back
renderEditedVideo(source, deletedRanges, onProgress)   // drop the deleted ranges
```

`stitchSegments` returns `blobs[0]` unchanged for a single take;
`renderEditedVideo` returns `source` unchanged with no cuts, or when every frame
is cut.

## How a cut lands

A copied stretch must start on a keyframe, so **cuts depend on the recorder
keying every editor cell** (every 6 frames = 0.2 s — see `capture-pipeline`).
`cutPlan` starts each kept range on the keyframe **nearest** its start (within
~0.1 s, either way) and ends it exactly; audio follows the same snapped ranges so
the tracks stay in sync. `joinPlan` places each take where the previous one ends
(the later of its last video and audio packet). All of this is in `remuxPlan.ts`,
unit-tested in `tests/remuxPlan.spec.ts`.

## The re-encode fallback

`needsNormalising` flags takes that can't be copied: encoder settings that
differ (a resume picked a different-sized screen) or keyframes too sparse to cut
on (takes recovered from OPFS that were recorded before the recorder keyed every
cell). Then **every** take is re-encoded once, first — at the first take's size,
letterboxed, keyed every cell, audio copied — and the copy path runs as usual.

The re-encode decodes each frame (`VideoSampleSink`), redraws it on an opaque
canvas and encodes it through the browser's own WebCodecs encoder
(`VideoSampleSource`), as fast as the machine allows. It costs one generation of
quality but can't drop frames. Mediabunny's `Conversion` would be shorter but
**drops one frame in six** of the recorder's output (and repeats frames instead
when given a fixed `frameRate`) — don't switch to it without checking the
different-screen-sizes E2E scenario.

## Why not ffmpeg, and why not a real-time replay — do not undo this

ffmpeg.wasm could not produce a correct multi-clip or trimmed export here:

- Chrome's canvas `MediaRecorder` emitted **VP9 with an alpha plane**
  (`alpha_mode: 1`). ffmpeg.wasm aborts re-encoding it with `RuntimeError: memory
  access out of bounds`, crashing at frame 1 — not a memory-size problem, and
  stripping the alpha afterwards did not help.
- `-c copy` concat of independently-recorded WebM **silently dropped all but the
  first** segment/range: mismatched parameters and independent timestamps, and
  cuts snapped to the recorder's one-and-only keyframe.

Its replacement replayed the footage in real time through a canvas and
`MediaRecorder`. That re-encoded every join and cut, and whenever the machine
fell behind — a slow CPU, a busy tab — it dropped frames: on the CI runner every
export with a cut stuttered, and with the CPU slowed 20× it exported at ~7 fps.

Packet copying fixes both: regular keyframes make `-c copy`-style cuts precise,
and Mediabunny writes one consistent file from takes that share encoder settings.
It is not the "ffmpeg/WASM transcoding" `CLAUDE.md` rules out: no WASM, and the
only re-encode is the fallback's, through the browser's native encoder. If you
are tempted to reintroduce ffmpeg, WASM transcoding or a real-time replay, read
this section first and raise it explicitly.

It runs on the main thread. A Web Worker would only matter if the Processing
progress bar stutters on a long recording — measure first.

## Processing.svelte

Runs the pipeline in `onMount` with a `cancelled` guard, then calls
`oncomplete(blob)` after a 300ms pause on "Done!".

1. `source = segments[0]`.
2. `segments.length > 1` → `stitchSegments` (status "Combining recordings…").
   The Editor normally passes a single already-combined blob, so this is a safety
   net — see `app-shell`.
3. `deletedRanges.length > 0` → `renderEditedVideo` (status "Applying edits…"),
   progress reset to 0 first.
4. No cuts → `source` is the final file, unmodified.

UI is an `Empty` inside a card: `Film` icon at 128px, the status as title, a
`Progress` bar (`class="*:bg-indigo-500"`) and a percentage. Failure swaps in a
`TriangleAlert` and the message in monospace — export errors are shown in place,
not routed to the global `ErrorScreen`.

`progress` is `$bindable` so `+page.svelte` can put it in the document title.

## Done.svelte

- **Auto-downloads on mount** via a synthesised `<a download>` click, revoking the
  object URL on teardown. A `null` blob is a no-op — which is what lets it render
  safely in Storybook.
- Filename (format in `CLAUDE.md`'s branding rule) is built by `exportFilename()` in
  `src/lib/utils.ts` (pure, unit-tested in `tests/utils.spec.ts`). Local time, not
  UTC, so the stamp matches the user's clock; the seconds keep same-day exports
  from colliding.
- `Empty` with a 128px `CircleCheck`, title "Download started", and two buttons:
  "Back to Editor" (indigo) and "New Recording" (outline).
