# YouDemo — Project Spec

A browser-only screen + webcam recorder, deployable to GitHub Pages. No backend,
no SSR, no routing library.

## Tech Stack

- **SvelteKit** with `@sveltejs/adapter-static` for GitHub Pages
- **Svelte 5** with runes (`$state`, `$effect`, `$derived`, `$props`)
- **TypeScript** throughout — all files `.ts` or `.svelte` with
  `<script lang="ts">`
- **Tailwind CSS v4** via the `sv` CLI add-on — CSS-first configuration via
  `@theme` blocks in `app.css`
- **shadcn-svelte** (Svelte 5 track) — UI primitives, used as-is with no
  customisation
- **lucide-svelte** — icons, imported individually
- **@ffmpeg/ffmpeg**, **@ffmpeg/util**, **@ffmpeg/core** — in-browser WebM → MP4
  conversion
- **fix-webm-duration** — patches WebM blob duration header after MediaRecorder
  recording
- **`@mediapipe/tasks-vision`** — in-browser selfie segmentation for webcam
  background blur
- **Vitest** — unit testing
- **ESLint + Prettier** — linting and formatting
- **npm** as package manager

## Project Setup

```bash
npx sv create yourdemo --template minimal --types ts --add tailwindcss prettier eslint sveltekit-adapter vitest mcp --install npm
cd yourdemo
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

1. **`list-sections`** — call FIRST to discover relevant documentation sections
2. **`get-documentation`** — fetch ALL sections relevant to the current task
3. **`svelte-autofixer`** — MUST be called on every Svelte file before
   presenting. Keep calling until no issues returned
4. **`playground-link`** — do NOT use. All code written directly to project
   files

## shadcn-svelte Reference

Full component index: https://www.shadcn-svelte.com/llms.txt

Consult before implementing any UI component. Components used: `Button`,
`Badge`, `Card`, `Dialog`, `Dropdown Menu`, `Empty`, `Progress`, `Separator`,
`Spinner`, `Toggle`, `Tooltip`.

The `Empty` component from shadcn-svelte is used for all empty states throughout
the app. Consult https://www.shadcn-svelte.com/docs/components/empty before
implementing any empty state.

## Visual Approach — Tailwind v4 CSS-First

**Tailwind utility classes are always preferred over hand-written CSS.**

In Tailwind v4, configuration is CSS-first — use `@theme` blocks in `app.css`:

```css
@theme {
    --color-primary: #6366f1; /* indigo-500 */
}
```

### Primary accent colour: indigo-500

`indigo-500` is the primary accent for the entire application.

| Element                     | Class                                          |
| --------------------------- | ---------------------------------------------- |
| Primary action buttons      | `bg-indigo-500 hover:bg-indigo-600 text-white` |
| Active frame cell in Editor | `ring-2 ring-indigo-500 bg-indigo-500/30`      |
| Cut button active state     | `bg-indigo-500 text-white`                     |
| Progress bars               | `accent-indigo-500` or `bg-indigo-500`         |
| Playhead line               | `bg-indigo-500`                                |
| Webcam bubble border        | `border-2 border-indigo-500`                   |
| Countdown number            | `text-indigo-500`                              |
| Play/pause flash icon       | `text-indigo-500`                              |
| MonitorPlay brand icon      | `text-indigo-500`                              |

### Selection colour: red/destructive

When frames are selected for deletion in the Editor, use red to signal
destructive intent:

| Element              | Class                               |
| -------------------- | ----------------------------------- |
| Selected frame cells | `ring-2 ring-red-500 bg-red-500/20` |
| Delete button        | shadcn `destructive` variant        |

### What stays red (destructive)

- Discard button
- Mute button (when muted)
- Cam-off button (when disabled)
- Delete button in Editor
- Selected frames in edit mode
- REC dot

### No hand-written CSS

Never write raw CSS when a Tailwind class exists. Only acceptable exceptions:

- `@theme` token definitions in `app.css`
- SVG-specific properties with no Tailwind equivalent

## Branding

- **Project name**: YouDemo
- **Top bar logo**: `MonitorPlay` icon (lucide-svelte) in `text-indigo-500` +
  "YouDemo" text
- **Tab title**: `YouDemo` (default), updated during countdown and recording
- **Download filename**: `yourdemo-YYYY-MM-DD.webm`

## Theming

- **Default**: dark mode
- **Toggle**: theme switcher in top bar (top right)
- **Implementation**: toggle `class="dark"` on `<html>`
- **Persistence**: `localStorage`

## Keyboard Shortcuts

**There are no keyboard shortcuts.** The `ShortcutsPanel.svelte` component has
been removed entirely. The `?` button in the top bar has been removed. No
`keydown` event listeners are attached anywhere in the app.

## Working Method

Build one step at a time. After each step:

1. Stop and describe what was built
2. List every file created or modified
3. Explain any assumptions not explicit in the spec
4. List what comes next
5. Wait for explicit approval

For every Svelte file:

- Fetch https://www.shadcn-svelte.com/llms.txt before using any shadcn component
- Call `list-sections` and `get-documentation` for relevant Svelte 5 / SvelteKit
  docs
- Run `svelte-autofixer` until no issues returned
- Prefer Tailwind classes over hand-written CSS at all times

## Feedback & Change Requests

- Re-read CLAUDE.md fully before any changes
- Only modify files explicitly listed in the prompt
- Run `svelte-autofixer` on any Svelte files changed
- Stop when done and list every file modified

## App Structure

```
src/
  routes/
    +layout.svelte          # Shell — top bar, theme toggle, dark mode class
    +layout.ts              # export const ssr = false
    +page.svelte            # Root — owns the state machine, renders active component
  lib/
    recorder.ts             # Canvas compositor, MediaRecorder, audio mixer
    ffmpegConverter.ts      # ffmpeg.wasm — WebM output with cuts
    ffmpegWorker.ts         # Web Worker wrapping ffmpegConverter
    deviceStore.ts          # Svelte 5 rune-based store, persisted to localStorage
    components/
      BrowserCheck.svelte
      BlurComboButton.svelte   # Blur toggle + intensity combo (Setup only)
      Setup.svelte
      Countdown.svelte
      Recording.svelte
      Review.svelte
      Editor.svelte
      Processing.svelte
      Done.svelte
      ErrorScreen.svelte    # Crash/error screen with Skull icon
      WebcamBubble.svelte
      WelcomeModal.svelte   # First-visit welcome dialog (localStorage gate)
```

Note: `ShortcutsPanel.svelte` has been removed entirely.

## State Machine (+page.svelte)

```
check → setup → countdown → recording → review → editor → processing → done
```

Add a global error boundary — if any unhandled error occurs, transition to an
`error` state that shows `ErrorScreen.svelte`.

```
check:      pass → setup | fail → stays (shows error)
setup:      Start Recording → countdown
countdown:  complete → recording
recording:  Stop → release screen stream → review
            Stream ended → full reset → setup
review:     Resume → screen picker → countdown | Edit & Export → editor | Discard → full reset → setup
editor:     Export & Download → processing | Back to Review → review
processing: complete → done
done:       New Recording → full reset → setup | Back to Editor → editor
any state:  unhandled error → error screen
```

### Full reset

**Cleared:** screenStream, blobs/segments, bubble position, deletedRanges
**Preserved:** mic/cam device + mute/enabled status, theme

## Section 1 — BrowserCheck.svelte

Critical APIs: `getDisplayMedia`, `MediaRecorder` Optional APIs: `getUserMedia`,
`AudioContext`

Use shadcn `Empty` component for the error/warning states.

## Section 2 — Setup.svelte

- **Top bar**: `MonitorPlay` icon + "YouDemo" text (left) | Theme toggle (right)
- **Preview area**: live screen stream or shadcn `Empty` component empty state
- **Empty state icon**: `MonitorSmartphone` or similar, 2x size, uses shadcn
  `Empty`
- **WebcamBubble**: `border-2 border-indigo-500`, visible in Setup only
- **Bottom toolbar**: Mic combo | Cam combo | [spacer] | Start Recording
  (`bg-indigo-500`)

### Screen picker

- "Choose Screen" → `getDisplayMedia`
- Start Recording disabled until screen picked
- Auto-start on tab share (`displaySurface === 'browser'`)
- Stream ended → full reset → empty state

## Section 3 — WebcamBubble.svelte

- 120px default diameter (user can resize)
- Always fully circular
- 8 snap positions: tl, tr, bl, br, tc, rc, bc, lc
- `border-2 border-indigo-500`
- Visible in Setup only, hidden from countdown onwards
- Disappears when cam is off

## Section 4 — Combo Buttons (Mic & Cam)

- Chevron opens `DropdownMenu` with `DropdownMenuRadioGroup`
- Wrap in `Tooltip` showing selected device name
- Muted/Off: shadcn `destructive` variant

## Section 4a — BlurComboButton.svelte

Combo button immediately right of the cam combo button. Setup screen only. Not
shown in Recording toolbar.

Primary button toggles blur on/off. Chevron opens `DropdownMenu` with
`DropdownMenuRadioGroup` for intensity: Light / Default / Heavy.

**Variants:**

- Off + cam enabled: `outline` variant, slash icon
- On + cam enabled:
  `bg-green-900 border border-green-700 text-green-400 hover:bg-green-800`, dot
  icon
- Cam muted (any state): `destructive` variant, disabled, slash icon

Restores previous on/off state when camera re-enabled.

**Intensity:**

- Default: `'default'`
- Persisted to `localStorage` key `yourdemo-blur-intensity`
- Changeable from chevron whether blur is on or off
- `setIntensity()` updates the running processor in place — no restart

**Tooltip:**

- Off: `"Background blur off"`
- On light: `"Background blur — Light"`
- On default: `"Background blur"`
- On heavy: `"Background blur — Heavy"`

**Icon:** Bespoke inline SVG — not from lucide-svelte. Two states: slash (off)
and dots (on). Uniform dot sizes, no opacity variation, Lucide-style 24×24
viewBox geometry.

**Props:**

- `rawStream: MediaStream | null` — raw webcam stream in
- `camEnabled: boolean` — from parent
- `onProcessedStream: (stream: MediaStream | null) => void` — emits processed
  stream when blur on, null when blur off
- `onProcessorChange?: (processor: BlurProcessor | null) => void` — emits
  processor reference for lifecycle management by parent

## Section 5 — Countdown.svelte

- Overlaid on preview area
- Large number in `text-indigo-500`
- Circular progress ring in indigo
- Card flip animation between counts
- Audio beep via Web Audio API
- `document.title`: `3… | YouDemo` etc.

## Section 6 — Recording.svelte + recorder.ts

### Empty state during recording

- shadcn `Empty` component with `RadioTower` icon (2x size, static, no
  animation)
- Label: "Recording in progress"

### Canvas compositing — CRITICAL IMPLEMENTATION NOTES

**Use `setInterval` not `requestAnimationFrame`** — Chrome throttles rAF to
~1fps in background tabs:

```ts
intervalId = setInterval(drawFrame, 1000 / 30);
mediaRecorder.start(500);
```

**Use `captureStream(0)` + `requestFrame()`** — never `captureStream(30)`:

```ts
const canvasStream = canvas.captureStream(0);
canvasCaptureTrack?.requestFrame(); // every tick
```

**Wait for `readyState >= 2`** on both video elements before starting.

**Codec probe:**

```ts
const mimeType =
    [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ].find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
```

**WebM duration fix:**

```ts
const fixedBlob = await fixWebmDuration(rawBlob, durationMs);
```

**Cleanup — release tracks immediately:**

```ts
clearInterval(intervalId);
screenStream.getTracks().forEach((t) => t.stop());
webcamStream?.getTracks().forEach((t) => t.stop());
audioCtx.close();
```

### Recording UI

- **Top bar**: MonitorPlay + YouDemo | Theme toggle | `● REC · mm:ss` badge
- **Bottom toolbar**: Mic combo | Cam combo | [spacer] | Stop
- `document.title`: `● REC 00:42 | YouDemo`
- Reset title on stop and `onDestroy`

## Section 7 — Review.svelte

- Last frame paused, greyscale
- Three cards tiled horizontally

| Card          | Style                | Action                      |
| ------------- | -------------------- | --------------------------- |
| Resume        | `border-indigo-500`  | → screen picker → countdown |
| Edit & Export | `border-indigo-500`  | → editor                    |
| Discard       | shadcn `destructive` | → full reset                |

## Section 8 — Editor.svelte

### Video player

- Click anywhere on video → toggle play/pause
- On click: show play/pause flash icon centred on video
    - Icon: `Play` or `Pause` from lucide-svelte, large (96px),
      `text-indigo-500`
    - Animation: scale up then fade out (YouTube style) using Tailwind
      `animate-` or CSS transition
- Custom progress bar: `<input type="range" class="accent-indigo-500 w-full">`
- Driven by `effectiveDuration` and `effectiveCurrentTime` — NOT
  `video.duration`

### Effective time calculations

```ts
let effectiveDuration = $derived(
    Math.max(
        0,
        (video?.duration ?? 0) -
            deletedRanges.reduce((sum, r) => sum + (r.endTime - r.startTime), 0)
    )
);

let effectiveCurrentTime = $derived(() => {
    const t = video?.currentTime ?? 0;
    const deletedBefore = deletedRanges
        .filter((r) => r.endTime <= t)
        .reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
    return Math.max(0, t - deletedBefore);
});
```

### Safe seek

```ts
function safeSeek(targetTime: number) {
    for (const range of deletedRanges) {
        if (targetTime >= range.startTime && targetTime < range.endTime) {
            targetTime = range.endTime;
            break;
        }
    }
    if (video) video.currentTime = Math.min(targetTime, video.duration - 0.001);
}
```

### timeupdate — skip deleted ranges

```ts
function handleTimeUpdate() {
    if (!video || deletedRanges.length === 0) return;
    for (const range of deletedRanges) {
        if (
            video.currentTime >= range.startTime &&
            video.currentTime < range.endTime
        ) {
            const jumpTo = range.endTime;
            if (jumpTo >= video.duration) {
                video.pause();
                video.currentTime = Math.max(0, range.startTime - 0.001);
                return;
            }
            requestAnimationFrame(() => {
                if (
                    video &&
                    Math.abs(video.currentTime - video.currentTime) < 0.1
                ) {
                    video.currentTime = jumpTo;
                }
            });
            return;
        }
    }
}
```

### Frame strip timeline

**Cell dimensions:**

```ts
const CELL_WIDTH = 80;
const CELL_HEIGHT = 64;
const CELL_GAP = 3;
const SAMPLE_INTERVAL = 0.2; // 5 cells per second
```

**Cell states (Tailwind):**

- Default: `border-2 border-transparent rounded-sm cursor-pointer`
- Active (current frame): `ring-2 ring-indigo-500 bg-indigo-500/30 rounded-sm` —
  impossible to miss
- Selected in edit mode: `ring-2 ring-red-500 bg-red-500/20 rounded-sm` — red
  for destructive intent
- Collapsing: `w-0 mr-0 opacity-0 transition-all duration-250`

**Playhead:** `absolute top-0 bottom-0 w-0.5 bg-indigo-500 pointer-events-none`

**Timestamp labels:** recalculated after each deletion based on remaining
visible cells and `effectiveDuration`

### Edit mode behaviour

- **Enter**: click Cut button → button becomes `bg-indigo-500 text-white`
- **Select**: click anchor cell, click end cell to select range — selected cells
  turn red
- **Delete**: click Delete button (shadcn `destructive`) or press Delete key
    - Cells animate width to 0 over 250ms
    - After animation: update `deletedRanges`, recalculate `effectiveDuration`,
      recalculate timeline scale/timestamps
    - **Automatically exit edit mode** — Cut button returns to default state
- **Timeline recalculation after cut**: strip re-renders with remaining cells,
  timestamp intervals adjust to reflect new effective duration

### Toolbar

```
[Cut button] [Delete button — edit mode only] [spacer] [Final: effectiveDuration]
```

### Footer

```
[Back to Review]                              [Export & Download (bg-indigo-500)]
```

## Section 9 — Processing.svelte

- Progress bar: `bg-indigo-500`
- Three-tier export:
    - **Tier 1**: single segment, no cuts → raw blob, instant download
    - **Tier 2**: multiple segments, no cuts → FFmpeg concat with `-c copy`
    - **Tier 3**: cuts present → FFmpeg `filter_complex` trim+concat, VP9 output

### Passing to worker — CRITICAL

```ts
worker.postMessage({
    segments: [...plainSegments],
    deletedRanges: [...(deletedRanges ?? [])].map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime
    })),
    totalDuration: videoDuration
});
```

### Output format

- Output: `.webm` (VP9)
- Filename: `yourdemo-YYYY-MM-DD.webm`

## Section 10 — Done.svelte

- Download auto-triggers on arrival
- Filename: `yourdemo-YYYY-MM-DD.webm`
- New Recording → full reset
- Back to Editor → editor

## Section 11 — ErrorScreen.svelte

Shown when an unhandled error occurs anywhere in the app.

```svelte
<div class="flex h-full flex-col items-center justify-center gap-6 p-8">
    <Skull class="text-destructive" size={128} />
    <h2 class="text-xl font-semibold">Something went wrong</h2>
    <p class="max-w-md text-center text-sm text-muted-foreground">
        {errorMessage}
    </p>
    <div class="flex gap-3">
        <Button variant="outline" onclick={copyErrorToClipboard}>
            <Copy class="mr-2 h-4 w-4" /> Copy error
        </Button>
        <Button onclick={() => window.location.reload()}>Reload YouDemo</Button>
    </div>
</div>
```

- `Skull` icon from lucide-svelte, `text-destructive`, 128px
- Error message shown in full
- Copy error button copies the full error + stack trace to clipboard
- Reload button calls `window.location.reload()`
- Triggered by global error boundary in `+layout.svelte` or `+page.svelte`

## Section 12 — WelcomeModal.svelte

**File:** `src/lib/components/WelcomeModal.svelte`

Shown on first visit only. Manages its own open/close state internally — no
props, no parent state changes needed.

### First-visit detection

- On mount, reads `ydWelcomed` from `localStorage`
- If the key is absent the dialog opens automatically
- On any dismiss path (button click or Escape), sets
  `localStorage.setItem('ydWelcomed', 'true')` and closes

### Layout (top to bottom)

1. `MonitorPlay` icon — `text-indigo-500`, 52 px, centred
2. Headline: `"Welcome to YouDemo"`, centred
3. Body copy: one-sentence description, `text-muted-foreground text-sm`, centred
4. shadcn `Separator`
5. Three left-aligned feature rows, each with a lucide icon (`text-indigo-500`,
   18 px) and a text label:
    - `Monitor` — "Record your screen with a webcam overlay"
    - `Scissors` — "Trim the footage right in the browser"
    - `Download` — "Download it — no sign-up, nothing uploaded"
6. shadcn `Button` — `bg-indigo-500 hover:bg-indigo-600 text-white w-full`,
   label `"Let's begin"`, calls `dismiss()` on click

### Components & icons used

- shadcn: `Dialog` (Root + Content), `Separator`, `Button`
- lucide-svelte: `MonitorPlay`, `Monitor`, `Scissors`, `Download`

### Dismiss behaviour

`dismiss()` always: sets the localStorage flag then sets `open = false`. The
`onOpenChange` handler on `<Dialog.Root>` also calls `dismiss()` when the dialog
closes via Escape or overlay click, ensuring the flag is always written.

## meta / OpenGraph (`src/app.html`)

The following tags are added inside `<head>`:

```html
<meta
    name="description"
    content="YouDemo lets you record your screen with a webcam overlay, trim the footage, and download it — all in the browser, all without signing up for anything."
/>
<meta property="og:title" content="YouDemo" />
<meta
    property="og:description"
    content="YouDemo lets you record your screen with a webcam overlay, trim the footage, and download it — all in the browser, all without signing up for anything."
/>
<meta property="og:type" content="website" />
<meta property="og:url" content="https://mjakinowittering.github.io/youdemo/" />
```

## Key Types

```ts
export type BlurIntensity = 'light' | 'default' | 'heavy';

export type BubblePosition =
    | 'tl'
    | 'tr'
    | 'bl'
    | 'br'
    | 'tc'
    | 'rc'
    | 'bc'
    | 'lc';

export interface DeletedRange {
    startTime: number;
    endTime: number;
}

export interface ExportOptions {
    segments: Blob[];
    deletedRanges: DeletedRange[];
    totalDuration: number;
}
```

## deviceStore.ts

```ts
export const deviceStore = {
    webcamDeviceId: $state<string | null>(null),
    micDeviceId: $state<string | null>(null),
    micMuted: $state<boolean>(false),
    camEnabled: $state<boolean>(true)
};
```

## GitHub Pages

- `adapter-static` in `svelte.config.js`
- `export const ssr = false` in `src/routes/+layout.ts`
- Build: `npm run build` → `/build`
- Workflow: `.github/workflows/build-and-deploy.yml` (npm cache via
  `actions/cache@v4`)

## Critical Implementation Notes

- **`setInterval` not `requestAnimationFrame`** — Chrome throttles rAF in
  background tabs
- **`captureStream(0)` + `requestFrame()`** every tick
- **Wait for `readyState >= 2`** before starting compositor
- **`fix-webm-duration`** — always apply
- **Track teardown** — `track.stop()` immediately on Stop
- **Full reset** — clears screenStream, blobs, deletedRanges. Preserves
  deviceStore
- **Resume** — calls `getDisplayMedia` again before countdown
- **Segments + deletedRanges postMessage** — escape Svelte reactivity, use
  `.map(r => ({...}))` for objects
- **FFmpeg** — trim+concat approach, WebM output, three-tier speed optimisation
- **Tailwind v4** — `@theme` in `app.css`
- **No hand-written CSS** — Tailwind classes only
- **indigo-500** — primary accent throughout
- **Red/destructive** — selected frames in edit mode, mute, cam-off, Discard,
  Delete, REC dot
- **No keyboard shortcuts** — ShortcutsPanel removed, no keydown listeners
- **shadcn Empty component** — used for all empty states
- **Edit mode auto-exit** — automatically exits after deletion, Cut button
  returns to default
- **Timeline recalculation** — after each deletion, recalculate strip,
  timestamps, effectiveDuration
- **Active frame** — `ring-2 ring-indigo-500 bg-indigo-500/30` — highly visible
- **Selected frames** — `ring-2 ring-red-500 bg-red-500/20` — red for
  destructive intent
- **Click video** — toggles play/pause with YouTube-style icon flash in indigo
- **Error screen** — Skull icon + error message + Reload + Copy error buttons
- **Branding** — YouDemo, MonitorPlay icon, `yourdemo-YYYY-MM-DD.webm` filename
- **Background blur** — MediaPipe `ImageSegmenter` with selfie segmentation
  model, bundled locally via `@mediapipe/tasks-vision`. Not fetched from CDN.
  WASM files copied from `node_modules` to build output by
  `vite-plugin-static-copy`. Model at
  `static/mediapipe/models/selfie_segmenter.tflite` (244KB, committed).
- **Blur pipeline** — `blurProcessor.ts` takes raw webcam stream, outputs
  processed canvas `MediaStream`. Same output consumed by `WebcamBubble`
  (preview) and `recorder.ts` (recording). What the user sees is what is
  recorded.
- **Blur compositor** — `setInterval` at 30fps, `captureStream(0)` +
  `requestFrame()` per tick. OffscreenCanvas instances pre-allocated outside the
  loop. Same pattern as `recorder.ts`.
- **Blur intensity** — three levels (light / default / heavy) controlling
  background blur radius and mask edge feathering. Persisted to `localStorage`
  as `yourdemo-blur-intensity`. Default is `'default'`.
- **Blur disabled when cam muted** — `destructive` variant, disabled. Previous
  on/off state restored on unmute.
- **Blur icon** — lucide-svelte: `UserRound` (off) and `CircleUserRound` (on).
- **Blur processor lifecycle** — `BlurProcessor` reference held by
  `+page.svelte` via `onProcessorChange` callback from `BlurComboButton`.
  Processor is destroyed in `resetToSetup()` so it doesn't outlive the recording
  session.
- **GitHub Actions** — workflow renamed to `build-and-deploy.yml`. npm cache via
  `actions/cache@v4` keyed on `package-lock.json`.
