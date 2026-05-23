# ScreenCast — Project Spec

A browser-only screen + webcam recorder, deployable to GitHub Pages. No backend,
no SSR, no routing library.

## Tech Stack

- **SvelteKit** with `@sveltejs/adapter-static` for GitHub Pages
- **Svelte 5** with runes (`$state`, `$effect`, `$derived`, `$props`)
- **TypeScript** throughout — all files `.ts` or `.svelte` with
  `<script lang="ts">`
- **Tailwind CSS** via the `sv` CLI add-on
- **shadcn-svelte** (Svelte 5 track) — UI primitives, used as-is with no
  customisation
- **lucide-svelte** — icons, imported individually
- **@ffmpeg/ffmpeg**, **@ffmpeg/util**, **@ffmpeg/core** — in-browser WebM → MP4
  conversion
- **fix-webm-duration** — patches WebM blob duration header after MediaRecorder
  recording
- **Vitest** — unit testing
- **ESLint + Prettier** — linting and formatting
- **npm** as package manager

## Project Setup

```bash
npx sv create screencast --template minimal --types ts --add tailwindcss prettier eslint sveltekit-adapter vitest mcp --install npm
cd screencast
# When prompted for adapter, choose: adapter-static
npm install lucide-svelte
npm install @ffmpeg/ffmpeg @ffmpeg/util @ffmpeg/core
npm install fix-webm-duration
npx shadcn-svelte@latest init
```

Configure `svelte.config.js`:

- Use `adapter-static`
- SSR disabled: add `export const ssr = false` to the root `+layout.ts`

## Svelte MCP Tools

The `mcp` add-on provides access to comprehensive Svelte 5 and SvelteKit
documentation. Use these tools on every component and route:

1. **`list-sections`** — call FIRST to discover relevant documentation sections
2. **`get-documentation`** — fetch ALL sections relevant to the current task
3. **`svelte-autofixer`** — MUST be called on every Svelte file before
   presenting. Keep calling until no issues returned
4. **`playground-link`** — do NOT use. All code written directly to project
   files

## shadcn-svelte Reference

Full component index: https://www.shadcn-svelte.com/llms.txt

Consult before implementing any UI component. Components used: `Button`,
`Button Group`, `Badge`, `Card`, `Dialog`, `Dropdown Menu`, `Progress`,
`Separator`, `Spinner`, `Toggle`, `Tooltip`, `Kbd`.

## Visual Approach

Vanilla shadcn-svelte throughout. No custom Tailwind theme extensions. No
overriding shadcn CSS variables. Use shadcn components exactly as they come.

The only colour accents:

- shadcn `destructive` variant (red) for mute buttons, cam-off buttons, Discard
  card
- Custom pulsing red dot for the recording indicator (hand-written CSS only)

shadcn-svelte dark mode via `dark` class on `<html>`.

## Theming

- **Default**: dark mode
- **Toggle**: theme switcher in top bar (top right)
- **Implementation**: toggle `class="dark"` on `<html>`
- **Persistence**: `localStorage`

## Working Method

Build one step at a time. After each step:

1. Stop and describe what was built
2. List every file created or modified
3. Explain any assumptions not explicit in the spec
4. List what comes next
5. Wait for explicit approval

Do not proceed without approval. Do not modify files from previous steps unless
fixing a reported bug.

For every Svelte file:

- Fetch https://www.shadcn-svelte.com/llms.txt before using any shadcn component
- Call `list-sections` and `get-documentation` for relevant Svelte 5 / SvelteKit
  docs
- Run `svelte-autofixer` until no issues returned

## Feedback & Change Requests

- Re-read CLAUDE.md fully before any changes — it is the source of truth
- Only modify files explicitly listed in the prompt
- Do not refactor files not listed
- Run `svelte-autofixer` on any Svelte files changed
- Stop when done and list every file modified and what changed

## App Structure

```
src/
  routes/
    +layout.svelte          # Shell — top bar, theme toggle, dark mode class
    +layout.ts              # export const ssr = false
    +page.svelte            # Root — owns the state machine, renders active component
  lib/
    recorder.ts             # Canvas compositor, MediaRecorder, audio mixer
    ffmpegConverter.ts      # ffmpeg.wasm — trim + cuts + MP4 conversion
    ffmpegWorker.ts         # Web Worker wrapping ffmpegConverter
    deviceStore.ts          # Svelte 5 rune-based store, persisted to localStorage
    components/
      BrowserCheck.svelte
      Setup.svelte
      Countdown.svelte
      Recording.svelte
      Review.svelte
      Editor.svelte
      Processing.svelte
      Done.svelte
      ShortcutsPanel.svelte
      WebcamBubble.svelte
```

## State Machine (+page.svelte)

```
check → setup → countdown → recording → review → editor → processing → done
```

```
check:      pass → setup | fail → stays (shows error)
setup:      Start Recording → countdown
countdown:  complete → recording
recording:  Stop → review | Stream ended → setup (empty state)
review:     Resume → countdown | Edit & Export → editor | Discard → setup (immediate)
editor:     Export & Download → processing | Back to Review → review
processing: complete → done
done:       New Recording → setup | Back to Editor → editor
```

```ts
type AppState = 'check' | 'setup' | 'countdown' | 'recording' | 'review' | 'editor' | 'processing' | 'done'
```

## Section 1 — BrowserCheck.svelte

Critical APIs: `getDisplayMedia`, `MediaRecorder` Optional APIs: `getUserMedia`,
`AudioContext`

Three outcomes:

1. Critical pass → `setup` silently
2. Critical pass, optional fail → amber warning + checklist
3. Critical fail → red error + checklist

## Section 2 — Setup.svelte

- **Top bar**: "ScreenCast" text logo (left) | Shortcuts · Theme toggle (right)
- **Preview area**: live screen stream once picked, empty state placeholder
  before
- **WebcamBubble**: visible and draggable in Setup only — hidden from countdown
  onwards
- **Bottom toolbar**: Mic combo button | Cam combo button | [spacer] | Start
  Recording

### Screen picker

- "Choose Screen" calls `getDisplayMedia` early
- Stream reused when recording starts — never called twice
- `screenStream`: `null` or `MediaStream` in page state
- Start Recording disabled until screen picked

### Auto-start on tab share

- If `displaySurface === 'browser'` → auto-trigger countdown
- Window/screen share: do not auto-start

### Stream ended

- Listen for `ended` on screen video track
- Return to Setup empty state — never show black preview

## Section 3 — WebcamBubble.svelte

- **120px diameter**, always fully circular
- **8 snap positions**: tl, tr, bl, br, tc, rc, bc, lc
- During drag: highlighted hotspot zones at inactive positions
- No drag hint — just draggable
- Visible in Setup (cam on) only — hidden countdown onwards
- Disappears entirely when cam is off
- Chosen position passed to canvas compositor

## Section 4 — Combo Buttons (Mic & Cam)

**Structure**: `[Icon] [Chevron ▾]`

- Icon side: mute/unmute or enable/disable
- Chevron: shadcn `DropdownMenu` with `DropdownMenuRadioGroup` /
  `DropdownMenuRadioItem` — checkmark on selected device
- Wrap entire button in shadcn `Tooltip` showing selected device name
- Fallback tooltip: `"Default microphone"` / `"Default camera"`
- Muted/Off state: shadcn `destructive` variant + `MicOff` / `VideoOff` icon

## Section 5 — Countdown.svelte

- Overlaid on preview area only
- Large number (3→2→1) + circular progress ring depleting each second
- Card flip animation between counts
- Audio beep via Web Audio API on each count (sine wave, no files)
- `document.title`: `3… | ScreenCast` → `2… | ScreenCast` → `1… | ScreenCast`
- On complete: transition to `recording`

## Section 6 — Recording.svelte + recorder.ts

### Canvas compositing pipeline (recorder.ts)

```
screenStream ──┐
               ├──► <canvas> (rAF loop) ──► captureStream(0) + requestFrame() ──► MediaRecorder
webcamStream ──┘

screenStream audio ──┐
                     ├──► AudioContext mixer ──► MediaStreamDestination ──► MediaRecorder
micStream audio ─────┘
```

### Critical implementation details

**Canvas setup:**

```ts
const canvas = document.createElement('canvas')
const videoTrack = screenStream.getVideoTracks()[0]
const settings = videoTrack.getSettings()
canvas.width = settings.width ?? 1920
canvas.height = settings.height ?? 1080
```

**Wait for video elements before starting:**

```ts
await Promise.all([
  new Promise<void>(resolve => {
    if (screenVideo.readyState >= 2) resolve()
    else screenVideo.addEventListener('canplay', () => resolve(), { once: true })
  }),
  new Promise<void>(resolve => {
    if (webcamVideo.readyState >= 2) resolve()
    else webcamVideo.addEventListener('canplay', () => resolve(), { once: true })
  })
])
// Only then start rAF loop and MediaRecorder
```

**Manual frame capture — CRITICAL:**

```ts
// Use captureStream(0) — NOT captureStream(30)
const canvasStream = canvas.captureStream(0)
let canvasCaptureTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack

function drawFrame() {
  ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

  if (camEnabled && webcamStream && webcamVideo.readyState >= 2) {
    const { x, y } = getBubbleCoords(bubblePosition, canvas.width, canvas.height, 120)
    ctx.save()
    ctx.beginPath()
    ctx.arc(x + 60, y + 60, 60, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(webcamVideo, x, y, 120, 120)
    ctx.restore()
  }

  // MUST call requestFrame() explicitly every tick
  canvasCaptureTrack?.requestFrame()

  rafId = requestAnimationFrame(drawFrame)
}
```

**Codec probe:**

```ts
const mimeType = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm',
].find(type => MediaRecorder.isTypeSupported(type)) ?? 'video/webm'
```

**MediaRecorder:**

```ts
const compositeStream = new MediaStream([
  ...canvasStream.getVideoTracks(),
  ...destination.stream.getAudioTracks()
])

mediaRecorder = new MediaRecorder(compositeStream, {
  mimeType,
  videoBitsPerSecond: 8_000_000,
  audioBitsPerSecond: 128_000
})

mediaRecorder.start(500) // 500ms timeslice
```

**WebM duration fix:**

```ts
// Record start time
const recordingStartTime = Date.now()

// In onstop handler:
const durationMs = Date.now() - recordingStartTime
const rawBlob = new Blob(chunks, { type: mimeType })
const fixedBlob = await fixWebmDuration(rawBlob, durationMs)
// Return fixedBlob — never the raw blob
```

**Cleanup — MUST call track.stop() not pause():**

```ts
screenStream.getTracks().forEach(t => t.stop())
webcamStream?.getTracks().forEach(t => t.stop())
screenVideo.srcObject = null
webcamVideo.srcObject = null
cancelAnimationFrame(rafId)
audioCtx.close()
```

### Bubble position coordinates (20px margin)

```ts
type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc'

function getBubbleCoords(pos: BubblePosition, w: number, h: number, size: number) {
  const m = 20
  const coords = {
    tl: { x: m, y: m },
    tr: { x: w - size - m, y: m },
    bl: { x: m, y: h - size - m },
    br: { x: w - size - m, y: h - size - m },
    tc: { x: (w - size) / 2, y: m },
    bc: { x: (w - size) / 2, y: h - size - m },
    lc: { x: m, y: (h - size) / 2 },
    rc: { x: w - size - m, y: (h - size) / 2 },
  }
  return coords[pos]
}
```

### RecorderOptions

```ts
export interface RecorderOptions {
  screenStream: MediaStream
  webcamDeviceId: string | null
  micDeviceId: string | null
  bubblePosition: BubblePosition
  micMuted: boolean
  camEnabled: boolean
}
```

`getUserMedia` for webcam + mic called inside `recorder.ts` `start()` — not
outside.

### Recording UI

- **Top bar**: "ScreenCast" | Shortcuts · Theme toggle | `● REC · mm:ss` badge
- **Bottom toolbar**: Mic combo | Cam combo | [spacer] | Stop
- `document.title` updated each tick: `● REC 00:42 | ScreenCast`
- `document.title` reset to `ScreenCast` on stop — cleared in both Stop handler
  AND `onDestroy`
- Timer `setInterval` stored and cleared on stop

## Section 7 — Review.svelte

Overlay on Setup preview area — not full screen.

- Last frame paused, shown in greyscale
- Three fully opaque cards tiled horizontally over video
- Meta pills: duration · mic status · cam status

| Card          | Style                | Action                                |
| ------------- | -------------------- | ------------------------------------- |
| Resume        | Default shadcn       | → countdown → recording (new segment) |
| Edit & Export | Default shadcn       | → editor                              |
| Discard       | shadcn `destructive` | → setup, no confirmation              |

## Section 8 — Editor.svelte

### Video player

- `<video>` from fixed WebM blob
- Play/pause, current time / total time
- Scrubable progress bar with draggable thumb

### Timeline thumbnail generation

Runs on main thread (not a worker — `HTMLVideoElement` not available in
Workers). Uses a hidden `<video>` element separate from the main player:

```ts
async function generateThumbnails(
  videoEl: HTMLVideoElement,
  count: number,
  duration: number,
  onThumbnail: (index: number, dataUrl: string) => void
) {
  for (let i = 0; i < count; i++) {
    videoEl.currentTime = (i / (count - 1)) * duration
    await new Promise<void>(resolve => { videoEl.onseeked = () => resolve() })
    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    canvas.getContext('2d')!.drawImage(videoEl, 0, 0, 160, 90)
    onThumbnail(i, canvas.toDataURL('image/jpeg', 0.7))
    await new Promise(resolve => setTimeout(resolve, 0)) // yield to browser
  }
}
```

### Timeline

- Thumbnail tiles along full width
- Two trim handles (left = start, right = end), draggable
- Playhead: vertical line + draggable handle at top
    - Click to jump, drag to scrub, synced to `video.currentTime`
- Add Cut: places cut region at playhead
    - Click to select, drag edges to resize
    - Delete key or Remove Cut button removes selected cut
- Cut regions: red overlay with "cut" label
- Excluded regions: dark overlay
- Timestamp labels at even intervals

### Keyboard shortcuts (Editor only — app has focus)

- `Space`: play/pause
- `←` / `→`: ±5s
- `C`: add cut at playhead
- `⌘E`: export

### Footer

Left: Back to Review | Centre: final length | Right: Export & Download

## Section 9 — Processing.svelte

### Known issue

Export currently fails with `DataCloneError` when posting segments to the FFmpeg
worker. The `segments` array is a Svelte 5 reactive proxy — must be fully
dereferenced before `postMessage`.

### Required fix (not yet resolved)

```ts
// In Processing.svelte — break out of Svelte reactivity before postMessage
const plainSegments: Blob[] = []
for (const s of segments) {
  const buffer = await s.arrayBuffer()
  plainSegments.push(new Blob([buffer], { type: 'video/webm' }))
}
worker.postMessage({ segments: plainSegments, trimStart, trimEnd, cuts: cuts ?? [] })
```

Must be inside an async IIFE within `$effect`:

```ts
$effect(() => {
  (async () => {
    // ... conversion and postMessage ...
  })()
})
```

### FFmpeg worker (ffmpegWorker.ts)

- Instantiated with Vite syntax:
  `new Worker(new URL('../ffmpegWorker.ts', import.meta.url), { type: 'module' })`
- Receives:
  `{ segments: Blob[], trimStart: number, trimEnd: number, cuts: CutRegion[] }`
- Posts progress: `{ type: 'progress', percent: number }`
- Posts completion: `{ type: 'done', blob: Blob }`
- Posts errors: `{ type: 'error', message: string }`

### ffmpegConverter.ts

- Load `@ffmpeg/core` (single-threaded — no SharedArrayBuffer required)
- Write segment blobs to FFmpeg virtual FS
- Stitch segments, apply trim + cuts via `filter_complex`
- VP9 WebM → MP4 via libx264:
    ```
    ffmpeg -i input.webm -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k output.mp4
    ```
- On complete → auto-trigger `<a download>` → transition to `done`

## Section 10 — Done.svelte

- Download auto-triggers on arrival
- Filename: `screen-recording-YYYY-MM-DD.mp4`
- Buttons: Back to Editor | New Recording

## Section 11 — ShortcutsPanel.svelte

shadcn `Dialog`. Keyboard shortcuts only for Editor and general nav — recording
shortcuts not viable when tab loses focus.

**Editor** | Key | Action | |---|---| | `Space` | Play / pause | | `←` / `→` |
Step ±5s | | `C` | Add cut at playhead | | `⌘E` | Export & download |

**General** | Key | Action | |---|---| | `?` | Open shortcuts panel |

## Key Types

```ts
export type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc'

export interface RecorderOptions {
  screenStream: MediaStream
  webcamDeviceId: string | null
  micDeviceId: string | null
  bubblePosition: BubblePosition
  micMuted: boolean
  camEnabled: boolean
}

export interface CutRegion {
  id: string
  start: number // seconds
  end: number   // seconds
}

export interface ExportOptions {
  segments: Blob[]
  trimStart: number
  trimEnd: number
  cuts: CutRegion[]
}
```

## deviceStore.ts

```ts
export const deviceStore = {
  webcamDeviceId: $state<string | null>(null),
  micDeviceId: $state<string | null>(null),
}
```

## GitHub Pages

- `adapter-static` in `svelte.config.js`
- `export const ssr = false` in `src/routes/+layout.ts`
- Build: `npm run build` → `/build`
- Deploy: `/build` to `gh-pages` branch

## Critical Implementation Notes

- **`captureStream(0)` + `requestFrame()`** — NEVER use `captureStream(30)`.
  Chrome does not reliably auto-capture canvas frames. Must call
  `canvasCaptureTrack.requestFrame()` at the end of every rAF tick
- **Wait for `readyState >= 2`** on both video elements before starting rAF loop
  and MediaRecorder — starting too early produces blank webcam frames
- **`fix-webm-duration`** — always apply with measured `durationMs`
  (`Date.now()` delta between start and stop). The duration header is always
  missing from MediaRecorder output
- **Track teardown** — always call `track.stop()` on every `MediaStreamTrack`.
  Never just `videoElement.pause()`. Pausing does not release the track and
  Chrome keeps showing the sharing indicator
- **Segments postMessage** — `segments` is a Svelte 5 reactive proxy. Must
  convert via `arrayBuffer()` to plain `Blob` before `postMessage` or
  DataCloneError will be thrown
- **Thumbnail generation** — runs on main thread with async yields between
  frames. `HTMLVideoElement` is not available in Web Workers
- **FFmpeg worker** — must use Vite Web Worker syntax:
  `new Worker(new URL('../ffmpegWorker.ts', import.meta.url), { type: 'module' })`
- **`@ffmpeg/core`** not `@ffmpeg/core-mt` — avoids SharedArrayBuffer/COOP/COEP
  requirements on GitHub Pages
- **Auto-start** applies to tab sharing only (`displaySurface === 'browser'`)
- **`document.title`** must be reset in both the Stop handler and `onDestroy` as
  a safety net
- **No custom Tailwind theme** — vanilla shadcn only
- **Keyboard shortcuts** — Editor and general nav only. Recording shortcuts not
  viable when tab loses focus during capture
