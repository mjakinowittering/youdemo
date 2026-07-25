---
name: video-export
description: Native video export — videoStitcher.ts (stitchSegments, renderEditedVideo), the Processing screen, the Done screen and download filename, plus the critical history of why ffmpeg.wasm was removed. Load when changing export, combining segments, applying trims, export progress, or before ever proposing ffmpeg/WASM transcoding.
---

# Export (`src/lib/videoStitcher.ts`)

**Fully native — no ffmpeg, no Web Worker.** Combining and trimming are both done
by replaying footage through a **canvas + `MediaRecorder`** on the main thread —
the same encoder that produces the recordings. Both operations run in real time
(about as long as the footage plays) and report progress.

```ts
stitchSegments(blobs, onProgress): Promise<Blob>       // play segments back-to-back
renderEditedVideo(source, deletedRanges, onProgress)   // play only the kept ranges
```

`stitchSegments` returns `blobs[0]` unchanged for a single segment.

## Why native — do not undo this

ffmpeg.wasm could not produce a correct multi-clip or trimmed export here:

- Chrome's canvas `MediaRecorder` emits **VP9 with an alpha plane**
  (`alpha_mode: 1`). ffmpeg.wasm aborts re-encoding it with `RuntimeError: memory
  access out of bounds`, crashing at frame 1 — not a memory-size problem, and
  stripping the alpha afterwards did not help.
- `-c copy` concat of independently-recorded WebM **silently drops all but the
  first** segment/range: mismatched parameters and independent timestamps.

Re-recording through the browser's own pipeline sidesteps both. Cut precision is
also better — per-frame, versus ffmpeg `-c copy` snapping to sparse keyframes.

The canvases here are opaque (`alpha: false`) as a belt-and-braces measure even
though the source segments fully cover the frame.

If you are tempted to reintroduce ffmpeg/WASM transcoding, read this section
first and raise it explicitly.

## Shared implementation notes

Both functions follow the same recipe (mirroring `capture-pipeline`):

- Probe the first blob for output dimensions (fallback 1280×720).
- Opaque canvas, `captureStream(0)` + `requestFrame()` per tick, `setInterval`
  driving the draw loop.
- `createMediaElementSource` → `MediaStreamAudioDestinationNode`, routed **only**
  to the recorder, never to the speakers.
- `keepAudioAlive()` adds a silent `ConstantSource` — same load-bearing trick as
  the recorder; without it a silent recording produces a zero-packet Opus track
  and Chromium later refuses the file with "The element has no supported sources".
- `videoBitsPerSecond: 8_000_000`, `audioBitsPerSecond: 128_000` — higher than the
  recorder's 5 Mbps, to limit generational loss on this second encode.
- `fixWebmDuration` on the result.
- Codec probe is three entries here (vp9 → vp8 → webm); the recorder's has an
  extra h264 rung.

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
- Filename: **`youdemo-YYYY-MM-DD.webm`** (`new Date().toISOString().slice(0, 10)`).
- Output format is always `.webm`.
- `Empty` with a 128px `CircleCheck`, title "Download started", and two buttons:
  "Back to Editor" (indigo) and "New Recording" (outline).
