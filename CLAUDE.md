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
- **Native export — no ffmpeg.** Combining clips and trimming are done by
  replaying footage through a canvas + `MediaRecorder` (`videoStitcher.ts`).
  ffmpeg.wasm was removed from the pipeline because it crashes on Chrome's
  MediaRecorder output (see Section 9).
- **fix-webm-duration** — patches WebM blob duration header after MediaRecorder
  recording. The `[fix-webm-duration] Duration section is missing` console line
  is benign: the library logs it and then inserts a correct Duration.
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
    videoStitcher.ts        # Native export: combine segments + trim (canvas + MediaRecorder)
    blurProcessor.ts        # MediaPipe selfie-segmentation background blur
    deviceStore.svelte.ts   # Svelte 5 rune-based store, persisted to localStorage
    components/
      BrowserCheck.svelte
      ControlBar.svelte        # Shared footer: Mic + Cam + Blur controls (Setup/Recording/Review)
      MicControl.svelte        # Mic mute + device combo (bindable micMuted)
      CamControl.svelte        # Cam toggle + device combo (bindable camEnabled)
      BlurControl.svelte       # Blur toggle + intensity combo (bindable blurOn/intensity)
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
check → setup → countdown → recording → review → [stitching] → editor → processing → done
```

Add a global error boundary — if any unhandled error occurs, transition to an
`error` state that shows `ErrorScreen.svelte`.

```
check:      pass → setup | fail → stays (shows error)
setup:      Start Recording (picks screen, auto-starts on any surface) → countdown
countdown:  complete → recording
recording:  Stop → capture blob → release camera → review
            Stream ended → full reset → setup
review:     Resume → screen picker → re-acquire camera → countdown
            Edit & Export → [stitching if >1 segment] → editor | Discard → full reset → setup
stitching:  combine segments (videoStitcher) → editor   (transient; shows progress)
editor:     Export & Download → processing | Back to Review → review
processing: complete → done
done:       New Recording → full reset → setup | Back to Editor → editor
any state:  unhandled error → error screen
```

### Combined Editor source

On entering the Editor, multiple segments are combined into ONE WebM
(`stitchSegments`, real-time) and cached as `editorBlob`; single segments are
used as-is. The Editor's player, timeline, thumbnails, duration and cuts all run
off this single blob, and the same blob feeds export. The cache is invalidated
when a new segment is recorded (resume) or on full reset.

### Camera lifecycle

The webcam (and blur processor) are live **only** during the capture flow (setup
preview → countdown → recording). `releaseCamera()` tears them down when a
recording is captured (entering Review) so the camera/red-dot doesn't linger;
`armCamera()` re-acquires on Resume (restoring blur from `ydBlurIntensity` if it
was on). Both live in `+page.svelte`.

### Full reset

**Cleared:** screenStream, webcam stream + blur, blobs/segments, `editorBlob`,
bubble position, deletedRanges **Preserved:** mic/cam device + mute/enabled
status, theme

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
- **Bottom toolbar**: shared `ControlBar` (Mic | Cam | Blur), centred, enabled.
  No Start Recording / Re-pick buttons in the footer.

### Screen picker

- The empty-state CTA is labelled **"Start Recording"** → `getDisplayMedia`
- Recording **auto-starts on any surface** (tab, window or screen) the moment a
  screen is picked — there is no separate Start Recording step
- Stream ended → full reset → empty state

## Section 3 — WebcamBubble.svelte

- **Fixed size — no resize.** Diameter and corner padding are a fraction of the
  frame _height_ (`BUBBLE_FRAC = 0.18`, `PAD_FRAC = 0.025`), not absolute
  pixels. The identical fractions are used in `recorder.ts` so the Setup preview
  and the composited recording match at any resolution.
- Preview sizes/positions the bubble against the letterboxed video rect
  (`object-contain`), computed from the screen `screenAspect` (width / height),
  so it lines up with the composited frame, which has no letterbox bars.
- Always fully circular
- 8 snap positions: tl, tr, bl, br, tc, rc, bc, lc
- `border-2 border-indigo-500`
- Visible in Setup only, hidden from countdown onwards
- Disappears when cam is off

## Section 4 — Shared controls (ControlBar + Mic/Cam/Blur)

The Mic, Cam and Blur controls are individual reusable components composed by
`ControlBar.svelte`, which is the shared footer on **all three** capture screens
(Setup, Recording, Review). DRY: the markup is defined once.

- `ControlBar` props (all `$bindable`): `micMuted`, `camEnabled`, `blurOn`,
  `blurIntensity`, plus a plain `disabled` flag.
- `disabled` is `false` on Setup (interactive) and `true` on Recording and
  Review (controls show current state but cannot be operated). Preferring a
  disabled control over coding around mid-recording toggles keeps the recorder
  simple — streams are locked in at `start()`.

### MicControl.svelte / CamControl.svelte

- `$bindable` `micMuted` / `camEnabled`; primary button toggles on click.
- Chevron opens `DropdownMenu` with `DropdownMenuRadioGroup`; each enumerates
  its own devices on mount and reads/writes `deviceStore`.
- Wrapped in `Tooltip` showing the selected device name.
- Muted/Off: shadcn `destructive` variant. Both button and chevron honour
  `disabled`.

### Section 4a — BlurControl.svelte

Controlled, pure-UI combo immediately right of the cam combo. Props (bindable):
`blurOn`, `intensity`; plus `camEnabled` and `disabled`. Primary button toggles
`blurOn`; chevron `DropdownMenuRadioGroup` sets `intensity` (Light / Default /
Heavy). It owns **no** processor — `+page` owns the `BlurProcessor` and reacts
to `blurOn`/`blurIntensity` via `$effect`s.

**Variants:**

- Off + cam enabled: `outline` variant, `UserRound` icon
- On + cam enabled: `success` variant, `CircleUserRound` icon
- Cam off (any state): `destructive` variant, disabled, `UserRound` icon

**Intensity:**

- Default: `'default'`; persisted to `localStorage` key `ydBlurIntensity` (by
  `+page`)
- Changeable from the chevron whether blur is on or off
- `+page`'s intensity `$effect` calls `setIntensity()` on the running processor
  in place — no restart

**Tooltip:** Off `"Background blur off"` · Light `"Background blur — Light"` ·
Default `"Background blur"` · Heavy `"Background blur — Heavy"`.

**Icon:** lucide-svelte `UserRound` (off) and `CircleUserRound` (on).

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
- **Stop is the centred CTA** inside the `Empty` (destructive button), like
  Setup's centred "Start Recording" — not tucked in the footer corner.

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

**Opaque canvas — `getContext('2d', { alpha: false })`.** The composite is
always fully opaque (the screen fills every frame), and an alpha channel makes
Chrome encode VP9 with an alpha plane (`alpha_mode: 1`) that breaks downstream
tooling.

**Webcam bubble — offscreen feathered mask, not `clip()`.** The bubble is drawn
onto a small offscreen canvas, masked to a circle with a radial-gradient
`destination-in` (soft edge), then blitted onto the main canvas. Clipping a
circle directly leaves a partial-coverage seam at the cardinal points (visible
once the canvas is resolution-capped). The webcam frame is centre-cropped to a
square so it isn't distorted (matches the preview's `object-cover`).

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
  (overlaid top-left of the capture area)
- **Centre**: Stop Recording (destructive button) inside the `RadioTower` empty
- **Bottom toolbar**: shared `ControlBar` (Mic | Cam | Blur), **disabled** —
  shows the state chosen in Setup but cannot be operated mid-record
- `document.title`: `● REC 00:42 | YouDemo`
- Reset title on stop and `onDestroy`

## Section 7 — Review.svelte

- **No** greyscale freeze-frame, no duration/mic/cam badges.
- Three shadcn `Card`s tiled horizontally, each **fully clickable** via the
  stretched-button pattern: `Card.Root` is `relative`; the footer `Button`
  contains `<span class="absolute inset-0">` so a click anywhere on the card
  fires it (`hover:bg-muted/50 hover:ring-indigo-500`). Each card = lucide icon
    - `Card.Title` + `Card.Description` + `Card.Footer` button.
- Bottom toolbar: shared `ControlBar`, **disabled** (consistency with the other
  capture screens).

| Card              | Icon           | Footer button           | Action                      |
| ----------------- | -------------- | ----------------------- | --------------------------- |
| Resume recording  | `Clapperboard` | Continue (`outline`)    | → screen picker → countdown |
| Edit recording    | `Film`         | Continue (`outline`)    | → editor                    |
| Discard recording | `Trash2`       | Discard (`destructive`) | → full reset                |

(Duration across N captured clips is a future exploration — not shown today.)

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

- Progress bar: `bg-indigo-500`, status label (`Combining recordings…` /
  `Applying edits…` / `Done!`)
- **Fully native export — no ffmpeg, no Web Worker.** All work happens on the
  main thread via `videoStitcher.ts`:
    1. `source = segments[0]` (the Editor passes a single, already-combined
       blob; a `stitchSegments` call remains as a safety net if >1 is ever
       passed).
    2. No cuts → `source` is the final file.
    3. Cuts → `renderEditedVideo(source, deletedRanges)` re-renders only the
       kept ranges.

### Why native (critical history)

ffmpeg.wasm could not produce a correct multi-clip / trimmed export here:

- Chrome's canvas `MediaRecorder` emits **VP9 with an alpha plane**
  (`alpha_mode: 1`); ffmpeg.wasm aborts re-encoding it with
  `RuntimeError: memory access out of bounds` (crashes at frame 1 — not a memory
  size issue; stripping alpha after the fact did not help).
- `-c copy` concat of independently-recorded WebM **silently drops all but the
  first** segment/range (mismatched params + independent timestamps).

So combining and trimming are both done by **replaying footage through a
canvas + `MediaRecorder`** (the same reliable native encoder that records). It
is real-time (≈ the played duration) and shows progress. Cut precision is
per-frame (better than ffmpeg `-c copy`, which snaps to sparse keyframes).

`videoStitcher.ts` exports:

- `stitchSegments(blobs, onProgress)` — play segments back-to-back into one
  WebM.
- `renderEditedVideo(source, deletedRanges, onProgress)` — play only the kept
  ranges into one WebM.

Both use an opaque canvas (`alpha: false`), `captureStream(0)` +
`requestFrame()`, `createMediaElementSource` → destination for audio (routed
only to the recorder, never the speakers), and `fixWebmDuration` on the result.

### Output format

- Output: `.webm`
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
- **`fix-webm-duration`** — always apply (its "Duration section is missing" log
  is benign — it inserts the duration)
- **Opaque canvases** — recorder + stitcher use
  `getContext('2d', { alpha: false })` so the WebM has no VP9 alpha plane
  (`alpha_mode: 1`)
- **Resolution cap** — composited canvas is scaled so its longest edge ≤ 1920px
  (`MAX_DIM` in `recorder.ts`), even dimensions. Uncapped 1440p/4K software VP9
  encoding is the main cause of renderer crashes during recording.
- **Bitrate** — recorder `videoBitsPerSecond: 5_000_000`, stitcher `8_000_000`;
  `audioBitsPerSecond: 128_000`
- **Single webcam capture** — the raw webcam stream is owned by `+page.svelte`
  (bound from `Setup`) so it survives a resume. `recorder.ts` reuses it (drawing
  the blurred stream when present) and only acquires the **mic** via
  `getUserMedia` — it never opens a second camera.
- **Camera released when idle** — `releaseCamera()` (in `+page.svelte`) stops
  the webcam + blur the moment a recording is captured (Review onward) so the
  camera light/red-dot doesn't linger; `armCamera()` re-acquires on Resume
  (restoring blur from `ydBlurIntensity`). Live only in
  setup/countdown/recording.
- **No debug logging in hot paths** — no per-frame/per-export `console.*`
- **Track teardown** — `track.stop()` immediately on Stop (recorder owns the
  screen + mic streams; the raw webcam stream is owned and released by `+page`)
- **Full reset** — clears screenStream, webcam + blur, blobs, `editorBlob`,
  deletedRanges. Preserves deviceStore
- **Resume** — calls `getDisplayMedia` then `armCamera()` before countdown
- **Native export (no ffmpeg)** — combining + trimming run on the main thread
  via `videoStitcher.ts` (`stitchSegments`, `renderEditedVideo`). ffmpeg.wasm
  was removed because Chrome's MediaRecorder VP9-with-alpha output crashes its
  encoder and `-c copy` concat drops segments. See Section 9.
- **Editor source** — the Editor loads ONE combined WebM (`editorBlob`, stitched
  on entry, cached) so its timeline/duration/thumbnails/cuts span the whole
  recording; the same blob feeds export.
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
  WASM files copied from `node_modules` to build output by the `postbuild`
  script. Model at `static/mediapipe/models/selfie_segmenter.tflite` (244KB,
  committed). Created with `delegate: 'GPU'` and a CPU fallback. The
  segmentation loop is busy-guarded (skips a tick while the previous pass is in
  flight) and reuses a single `ImageData` buffer to avoid per-frame allocation.
- **Blur pipeline** — `blurProcessor.ts` takes raw webcam stream, outputs
  processed canvas `MediaStream`. Same output consumed by `WebcamBubble`
  (preview) and `recorder.ts` (recording). What the user sees is what is
  recorded.
- **Blur compositor** — `setInterval` at 30fps, `captureStream(0)` +
  `requestFrame()` per tick. OffscreenCanvas instances pre-allocated outside the
  loop. Same pattern as `recorder.ts`.
- **Blur intensity** — three levels (light / default / heavy) controlling
  background blur radius and mask edge feathering. Persisted to `localStorage`
  as `ydBlurIntensity`. Default is `'default'`.
- **Blur disabled when cam off** — `destructive` variant, disabled. Blur is also
  disabled (state shown, not interactive) during Recording and Review.
- **Blur icon** — lucide-svelte: `UserRound` (off) and `CircleUserRound` (on).
- **Blur processor lifecycle** — owned entirely by `+page.svelte`. `blurOn` and
  `blurIntensity` are `$state`, bound down through `ControlBar` to
  `BlurControl`. A `$effect` keyed on `blurOn` + `webcamStream` creates/destroys
  the `BlurProcessor` (and so subsumes cam-off and camera release/re-arm — no
  remember/restore logic); a second `$effect` persists intensity and applies it
  in place. `startRecording` awaits a `blurReady` promise so an in-flight
  processor is locked into the recording from the first frame.
- **GitHub Actions** — workflow renamed to `build-and-deploy.yml`. npm cache via
  `actions/cache@v4` keyed on `package-lock.json`.
