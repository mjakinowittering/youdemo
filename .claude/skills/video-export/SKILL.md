---
name: video-export
description: Lossless video export — videoStitcher.ts (stitchSegments, renderEditedVideo) copying recorded packets with Mediabunny, the pure remuxPlan.ts, the re-encode fallback, the Editor's joining and exporting phases, the download and its filename, plus the history of why ffmpeg.wasm and the real-time canvas replay were removed. Load when changing export, combining segments, applying trims, export progress, or before ever proposing ffmpeg/WASM transcoding or a real-time replay.
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
differ (Change picked a different-sized screen) or keyframes too sparse to cut
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

It runs on the main thread. A Web Worker would only matter if the export
progress bar stutters on a long recording — measure first.

## In the Editor

There is no separate processing or download screen: joining and exporting are
phases of the Editor, run by `+page.svelte` (`app-shell`).

- **Joining** (`stitchSegments`) on entering the Editor with several takes;
  the Editor shows "Joining N takes" with progress over skeleton controls.
- **Export** confirms in a dialog (length after cuts, number of cuts, file
  name), then `renderEditedVideo(editorBlob, cuts, onProgress)` with the stage
  showing "Exporting" and its percentage and every control disabled. No cuts →
  the joined recording as is.
- The file downloads straight away through `downloadBlob(blob, filename)` in
  `utils.ts`; the name is `exportFilename()` (format in `CLAUDE.md`'s
  branding rule; local time, with seconds), fixed when the dialog opened. The
  Editor then shows the dismissible Exported notice. **The crash store is
  kept**; only Discard and New recording clear it.
- **Failure** shows in place, never through the global `ErrorScreen`: the
  export-failed card with the reason in words (`exportFailureReason` in
  `errors.ts`), Technical details, **Try again** and **Copy error**. Takes and
  cuts are untouched.
