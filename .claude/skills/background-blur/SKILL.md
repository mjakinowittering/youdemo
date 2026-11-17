---
name: background-blur
description: MediaPipe selfie-segmentation webcam background blur — blurProcessor.ts, the per-frame compositing loop, intensity levels, processor lifecycle owned by +page.svelte, and how the WASM/model assets are served in dev and production. Load when changing blur behaviour or performance, adding an intensity level, or debugging MediaPipe asset 404s.
---

# Background blur (`src/lib/blurProcessor.ts`)

`createBlurProcessor(rawStream, intensity, basePath)` takes the raw webcam stream
and returns a `BlurProcessor`:

```ts
interface BlurProcessor {
    outputStream: MediaStream;               // the blurred video track
    setIntensity(intensity: BlurIntensity): void;
    destroy(): void;
}
```

The same `outputStream` is consumed by `WebcamBubble` (preview) and `recorder.ts`
(recording) — **what the user sees is what is recorded**.

`BlurIntensity` (`'light' | 'default' | 'heavy'`) is exported from this module,
not from `types.ts`.

## In a Worker

`createWorkerBlur()` clones the camera track, reads it with
`MediaStreamTrackProcessor`, and transfers the frames to `blur.worker.ts` with
the `writable` of a `MediaStreamTrackGenerator`, whose track is `outputStream`
(helpers: `trackFrames.ts`). It resolves when the Worker posts `ready`.

It replaced a main-thread loop on a 30 fps timer of its own. That loop read
the mask back from the GPU and wrote ~307k pixels in JavaScript for every
frame, on the thread the recorder then composited on, and its timer sampled
the camera with a second clock.

`createMainThreadBlur()` is that old loop, kept as the fallback: where the
browser can't hand frames to a Worker (`canProcessInWorker()`), or the Worker
posts `failed` (no WebGL 2 in a Worker, the segmenter won't start).

## Segmentation

MediaPipe `ImageSegmenter` with the selfie-segmentation model, `runningMode:
'VIDEO'`, `outputConfidenceMasks: true`, `delegate: 'GPU'`. The fallback tries
`'GPU'` then `'CPU'`.

In the Worker the runtime is the **module build**
(`FilesetResolver.forVisionTasks(path, true)` → `vision_wasm_module_internal`):
a module Worker has no `importScripts`.

Use the **callback form** of `segmentForVideo` — the synchronous form may not fire
the graph in VIDEO mode.

The binary segmenter returns one mask (person confidence) or two (background +
person); the **last** index is always the foreground.

## Per frame, in the Worker

One camera frame at a time, as it arrives; while one is segmented the track
keeps only its newest frame, so slow passes drop frames instead of stacking up.

1. `segmentForVideo(frame, …, callback)`; the mask only lives inside the
   callback.
2. `maskPainter()` draws the mask texture (`getAsWebGLTexture()`) as alpha on
   the segmenter's own canvas. The canvas's WebGL 2 context is created by us
   first, with alpha, and MediaPipe is given the canvas, so both use one
   context; the painter puts back every piece of GL state it touches. The mask
   comes bottom row first, so the shader flips it.
3. Draw the whole frame blurred (`ctx.filter = blur(<radius>px)`) as background.
4. Draw the sharp frame on a second canvas and clip it to the mask canvas via
   `destination-in`.
5. Blit the sharp person over the background and write a `VideoFrame` of it,
   with the camera frame's timestamp.

The canvases are created once and resized only when the frame size changes.

The fallback's loop keeps its two rules: the **busy guard** (`drawFrame`
returns early while a segmentation is in flight) and **pre-allocated buffers**
(a fresh `ImageData` per frame is ~1.2MB at 640×480).

## Intensity

Intensity controls the **background blur radius only** — there is no separate
feathering parameter; edge softness comes free from the confidence mask's own soft
values.

| Level     | `blurRadius` |
| --------- | ------------ |
| `light`   | 4px          |
| `default` | 10px         |
| `heavy`   | 20px         |

`setIntensity()` swaps the config in place on a running processor — **no restart**.

## Lifecycle — owned by `+page.svelte`

`BlurControl` is pure UI and owns no processor (see `capture-screens`). Two
`$effect`s in `+page.svelte` do the work:

1. Keyed on `blurOn` + `webcamStream`: creates the processor and publishes
   `processedWebcamStream`; the cleanup destroys it. Because it depends on the
   stream, turning the camera off, changing device and leaving for the Editor all
   tear blur down for free, and the camera coming back rebuilds it. **Do not add
   remember/restore logic.**
2. Keyed on `blurIntensity`: persists to `ydBlurIntensity` and calls
   `setIntensity()` on the running processor (via `untrack`, so it doesn't
   re-create anything).

`blurLoading` is true from the start of creation until the processor is published,
creation fails, or the effect is torn down. It goes to the screens with a live
dock, Setup and Review, where `WebcamBubble` dims the raw preview under a
spinner (see `capture-screens`); the dock is locked while counting down and
recording, so no other screen can start a load.

`startRecording()` awaits a `blurReady` promise so an in-flight processor is locked
into the recording from the first frame.

The `cancelled` flag in the creation effect matters: the effect can be torn down
while `createBlurProcessor` is still awaiting, and the resolved processor must then
be destroyed rather than published.

## Assets — bundled locally, never from a CDN

| Asset      | Source                                    | Served from                            |
| ---------- | ----------------------------------------- | -------------------------------------- |
| WASM       | `node_modules/@mediapipe/tasks-vision/wasm` | `<base>/mediapipe/wasm`               |
| Model      | committed at `static/mediapipe/models/selfie_segmenter.tflite` (244KB) | `<base>/mediapipe/models/` |

Both paths are prefixed with SvelteKit's `base` (passed in as `basePath`), which
is what makes them work under the GitHub Pages subpath — see `deployment`.

The WASM files are **not committed**. Two separate mechanisms serve them:

- **Dev** — `vendoredWasmDevPlugin` in `vite.config.ts` mounts middleware on
  `/mediapipe/wasm` reading straight out of `node_modules`.
- **Build** — the `postbuild` script `scripts/copy-mediapipe-wasm.js` copies six
  files (`vision_wasm_internal`, `vision_wasm_module_internal` for the Worker and
  `vision_wasm_nosimd_internal`, each `.js` and `.wasm`) into
  `build/mediapipe/wasm/`.

If blur 404s, check which of those two paths is involved before touching the
processor. Adding a new vendored asset means updating **both**.
