---
name: background-blur
description: MediaPipe selfie-segmentation webcam background blur — blurProcessor.ts, the per-frame compositing loop, intensity levels, processor lifecycle owned by +page.svelte, and how the WASM/model assets are served in dev and production. Load when changing blur behaviour or performance, adding an intensity level, or debugging MediaPipe asset 404s.
---

# Background blur (`src/lib/blurProcessor.ts`)

`createBlurProcessor(rawStream, intensity, basePath)` takes the raw webcam stream
and returns a `BlurProcessor`:

```ts
interface BlurProcessor {
    outputStream: MediaStream;               // canvas capture stream
    setIntensity(intensity: BlurIntensity): void;
    destroy(): void;
}
```

The same `outputStream` is consumed by `WebcamBubble` (preview) and `recorder.ts`
(recording) — **what the user sees is what is recorded**.

`BlurIntensity` (`'light' | 'default' | 'heavy'`) is exported from this module,
not from `types.ts`.

## Segmentation

MediaPipe `ImageSegmenter` with the selfie-segmentation model, `runningMode:
'VIDEO'`, `outputConfidenceMasks: true`. Created with `delegate: 'GPU'` and a
try/catch fallback to `'CPU'` — GPU is markedly faster both to initialise and per
frame.

Use the **callback form** of `segmentForVideo` — the synchronous form may not fire
the graph in VIDEO mode.

The binary segmenter returns one mask (person confidence) or two (background +
person); the **last** index is always the foreground.

## Per-frame loop

Same shape as `recorder.ts` (see `capture-pipeline`): `setInterval` at 30fps,
`captureStream(0)` + `requestFrame()` per tick.

1. Draw the whole frame blurred (`ctx.filter = blur(<radius>px)`) as background.
2. Write the confidence values into the alpha channel of a reused `ImageData`.
3. Draw the sharp frame into a temp canvas, clip it to the mask via
   `destination-in`.
4. Blit the sharp person over the blurred background, then `requestFrame()`.

Two performance rules, both load-bearing:

- **Busy guard** — `drawFrame` returns early while a previous segmentation is
  still in flight. Without it slow passes stack up and saturate the CPU/GPU.
- **Pre-allocated buffers** — the two `OffscreenCanvas` instances and the
  `ImageData` are created once outside the loop. A fresh `ImageData` per frame is
  ~1.2MB at 640×480, i.e. ~36MB/s of garbage.

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
   stream, cam-off, `releaseCamera()` and full reset all tear blur down for free,
   and `armCamera()` rebuilds it. **Do not add remember/restore logic.**
2. Keyed on `blurIntensity`: persists to `ydBlurIntensity` and calls
   `setIntensity()` on the running processor (via `untrack`, so it doesn't
   re-create anything).

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
- **Build** — the `postbuild` script `scripts/copy-mediapipe-wasm.js` copies four
  files (`vision_wasm_internal.{js,wasm}`, `vision_wasm_nosimd_internal.{js,wasm}`)
  into `build/mediapipe/wasm/`.

If blur 404s, check which of those two paths is involved before touching the
processor. Adding a new vendored asset means updating **both**.
