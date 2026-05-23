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
- **Vitest** — unit testing
- **ESLint + Prettier** — linting and formatting
- **npm** as package manager

## Project Setup

```bash
npx sv create screencast --template minimal --types ts --add tailwindcss prettier eslint sveltekit-adapter vitest mcp --install npm
cd screencast
# When prompted for adapter, choose: adapter-static
# Then add remaining dependencies
npm install lucide-svelte
npm install @ffmpeg/ffmpeg @ffmpeg/util @ffmpeg/core
npx shadcn-svelte@latest init
```

Configure `svelte.config.js`:

- Use `adapter-static`
- SSR disabled: add `export const ssr = false` to the root `+layout.ts`

## Svelte MCP Tools

The `mcp` add-on provides access to comprehensive Svelte 5 and SvelteKit
documentation. Use these tools on every component and route:

### Usage Rules

1. **`list-sections`** — call this FIRST at the start of any Svelte or SvelteKit
   task to discover relevant documentation sections. Returns titles, use_cases,
   and paths.

2. **`get-documentation`** — after calling `list-sections`, analyse the returned
   sections (especially `use_cases`) and fetch ALL sections relevant to the
   current task. Accepts single or multiple sections.

3. **`svelte-autofixer`** — MUST be called on every piece of Svelte code before
   presenting it. Keep calling until no issues or suggestions are returned.

4. **`playground-link`** — do NOT use. All code is written directly to project
   files.

## shadcn-svelte Reference

Full component index available at: https://www.shadcn-svelte.com/llms.txt

Consult this before implementing any UI component to confirm the correct
shadcn-svelte API. Each entry links to a full markdown doc for that component.

Components used in this project include: `Button`, `Button Group`, `Badge`,
`Card`, `Dialog`, `Dropdown Menu`, `Progress`, `Separator`, `Spinner`, `Toggle`,
`Tooltip`, `Kbd`.

## Visual Approach

Vanilla shadcn-svelte throughout. No custom Tailwind theme extensions. No
overriding shadcn CSS variables. Use shadcn components exactly as they come —
`Button`, `Dialog`, `DropdownMenu`, `Select` etc with their default appearance.

The only colour accents used are:

- shadcn's built-in `destructive` variant (red) for mute buttons, cam-off
  buttons, and the Discard card
- A custom pulsing red dot for the recording indicator (hand-written CSS only
  where needed)

shadcn-svelte ships with dark mode support via the `dark` class on `<html>` —
the theme toggle uses this directly.

## Theming

- **Default**: dark mode
- **Modes**: dark and light, user-switchable
- **Toggle**: theme switcher button in the top bar (top right)
- **Implementation**: toggle `class="dark"` on `<html>` element
- **Persistence**: preference saved to `localStorage`

## Working Method

Build the application one step at a time. Each step is either a route/page or a
component. After completing each step:

1. Stop and describe what was just built
2. List every file created or modified
3. Explain any decisions or assumptions made that were not explicit in the spec
4. List what comes next
5. Wait for explicit approval before continuing

Do not proceed to the next step without being told to. Do not modify files from
previous steps unless fixing a reported bug. The goal is a reviewable,
incremental build — not a one-shot complete application.

For every Svelte component or route written:

- Fetch https://www.shadcn-svelte.com/llms.txt and consult it before using any
  shadcn-svelte component
- Call `list-sections` and `get-documentation` to check relevant Svelte 5 /
  SvelteKit docs first
- Run `svelte-autofixer` on all Svelte code before presenting it
- Keep running `svelte-autofixer` until it returns no issues

## Feedback & Change Requests

When receiving a focused change prompt:

- Re-read CLAUDE.md fully before making any changes — it is the source of truth
- Only modify the files explicitly listed in the prompt
- Do not refactor, reformat, or improve files not listed
- Run `svelte-autofixer` on any Svelte files changed
- Stop when done and list every file modified and what changed

**Build order (initial build):**

1. Project setup + `+layout.svelte` (top bar, theme toggle, shell)
2. `BrowserCheck.svelte`
3. `Setup.svelte` (scaffold only — screen picker, placeholder preview, toolbar)
4. `WebcamBubble.svelte`
5. `Countdown.svelte`
6. `Recording.svelte`
7. `Review.svelte`
8. `Editor.svelte` (player + timeline scaffold)
9. `Processing.svelte`
10. `Done.svelte`
11. `ShortcutsPanel.svelte`
12. `recorder.ts` (capture, compositing, audio mixing)
13. `ffmpegConverter.ts` (FFmpeg wasm, trim + cuts)
14. `deviceStore.ts`
15. Wire up state machine in `+page.svelte`
16. End-to-end testing + fixes

## App Structure

```
src/
  routes/
    +layout.svelte          # Shell — top bar, theme toggle, dark mode class
    +layout.ts              # export const ssr = false
    +page.svelte            # Root — owns the state machine, renders active component
  lib/
    recorder.ts             # getDisplayMedia, getUserMedia, canvas compositing, MediaRecorder
    ffmpegConverter.ts      # ffmpeg.wasm load + WebM → MP4 conversion
    ffmpegWorker.ts         # Web Worker wrapper for ffmpegConverter — keeps main thread free
    thumbnailWorker.ts      # Web Worker for timeline thumbnail generation — keeps main thread free
    deviceStore.ts          # Svelte 5 rune-based store, persisted to localStorage
    components/
      BrowserCheck.svelte   # API capability check on mount
      Setup.svelte          # Pre-recording UI — screen picker, preview, device controls
      Countdown.svelte      # 3s animated countdown with progress ring + audio beeps
      Recording.svelte      # Active recording UI
      Review.svelte         # Post-stop decision screen
      Editor.svelte         # Video player + timeline editor
      Processing.svelte     # FFmpeg conversion progress
      Done.svelte           # Download complete
      ShortcutsPanel.svelte # Keyboard shortcuts overlay
      WebcamBubble.svelte   # Draggable PiP overlay, snaps to 8 positions
```

## State Machine (+page.svelte)

States:

```
check → setup → countdown → recording → review → editor → processing → done
```

Transitions:

```
check:      pass → setup | fail → stays on check (shows error)
setup:      Start Recording → countdown
countdown:  complete → recording  (also used when resuming from review)
recording:  Stop → review | Stream ended by user → setup (show empty state)
review:     Resume → countdown | Edit & Export → editor | Discard → setup (immediate, no confirm)
editor:     Export & Download → processing | Back to Review → review
processing: complete → done
done:       New Recording → setup | Back to Editor → editor
```

State type:

```ts
type AppState = 'check' | 'setup' | 'countdown' | 'recording' | 'review' | 'editor' | 'processing' | 'done'
```

All state lives in a single `$state` object in `+page.svelte`. No routing
library — pure state machine.

## Section 1 — BrowserCheck.svelte

On mount, check:

- `navigator.mediaDevices?.getDisplayMedia` — **critical**
- `window.MediaRecorder` — **critical**
- `navigator.mediaDevices?.getUserMedia` — optional
- `window.AudioContext` — optional

Three outcomes:

1. All critical APIs pass → transition to `setup` silently
2. Critical APIs pass, optional APIs fail → amber warning, checklist with
   ok/warn icons per API, "Update browser for full features" CTA
3. Critical APIs missing → red error, checklist with ok/warn icons per API,
   "Browser not supported" message

Checklist rows (with ok/warn icon per API):

- Screen capture (`getDisplayMedia`) — critical
- Media recording (`MediaRecorder`) — critical
- Camera access (`getUserMedia`) — optional
- Audio mixing (Web Audio API) — optional

## Section 2 — Setup.svelte

Layout:

- **Top bar** (in `+layout.svelte`): "ScreenCast" text logo (left) | Shortcuts
  button · Theme toggle (right)
- **Preview area**: shows selected screen stream in a `<video>` element once
  picked; shows empty state when no screen is selected or when sharing is
  stopped
- **Instruction text**: "Choose a screen to preview, then hit Record"
- **WebcamBubble** shown in preview area (top-right by default), draggable —
  visible only in Setup, hidden from countdown onwards
- **Bottom toolbar**: Mic combo button | Cam combo button | [spacer] | Start
  Recording button

### Screen picker flow (embedded in Setup)

- "Choose Screen" button calls `getDisplayMedia` early
- On success: stream shown live in the preview `<video>` element
- "Re-pick" button available to swap the stream
- The acquired stream is reused when recording starts — no second picker prompt
- `screenStream` tracked in page state: `null` (unpicked) or `MediaStream`
- Start Recording button disabled until a screen is picked

### Auto-start on tab share

- When `getDisplayMedia` resolves and the selected source is a **browser tab**,
  automatically trigger the countdown without requiring the user to click Start
  Recording
- This handles the focus-loss problem: selecting a tab in Chrome immediately
  shifts focus away from ScreenCast, so the user would otherwise have to
  navigate back to click Record
- For window or screen sharing: do not auto-start — the user retains enough
  context to click Record themselves
- Detect tab share by checking `getDisplayMedia` track settings for
  `displaySurface === 'browser'`

### Stream ended by user (stop sharing)

- Listen for the `ended` event on the screen video track
- When fired during Setup or Recording: stop all tracks, clear `screenStream`,
  and return to the Setup empty state
- Do not show a black preview — return cleanly to the "Choose Screen" empty
  state
- The user can then re-pick a screen or start fresh

## Section 3 — WebcamBubble.svelte

- **120px diameter circle**
- **Always fully circular** regardless of snap position — no corner clipping
- **8 snap positions**: 4 corners (tl, tr, bl, br) + 4 edge midpoints (tc, rc,
  bc, lc)
- Snaps to nearest of 8 positions on drag release
- **During drag**: highlighted hotspot zones shown at all inactive positions as
  larger drop targets
- **No drag hint** on the bubble — just draggable
- **Visibility rules**:

| State            | Bubble visible                     |
| ---------------- | ---------------------------------- |
| Setup (cam on)   | Yes — draggable, positioned        |
| Countdown        | No — canvas compositing takes over |
| Recording        | No — canvas compositing takes over |
| Review           | No — greyscale last frame shown    |
| All other states | No                                 |

- **When cam is off**: bubble disappears entirely
- The chosen position is passed to canvas compositing and persists across states

## Section 4 — Combo Buttons (Mic & Cam)

Each control is a split button — used in both Setup and Recording toolbars:

**Structure**: `[Icon] [Chevron ▾]`

- Left side (icon): click to mute/unmute (mic) or enable/disable (cam)
- Right side (chevron): opens a shadcn `DropdownMenu` listing available devices
  from `enumerateDevices()`

**Visual states**:

- **Active**: default shadcn style, active icon (`Mic`, `Video`)
- **Muted / Off**: shadcn `destructive` variant, off icon (`MicOff`, `VideoOff`)

**Selected device indicator in dropdown**:

- Use `DropdownMenuRadioGroup` with `DropdownMenuRadioItem` for the device list
- The currently selected device shows a checkmark indicator via the RadioItem's
  built-in checked state
- Only one device can be selected at a time per button

**Tooltip on hover**:

- Wrap the entire combo button in a shadcn `Tooltip` component
- Tooltip content shows the currently selected device name (e.g.
  `"MacBook Pro Microphone"`, `"FaceTime HD Camera"`)
- When no explicit device has been selected and the default is in use, show
  `"Default microphone"` or `"Default camera"` as the fallback label
- Tooltip appears on hover of the full button (both icon side and chevron side)

Device selection saved to `localStorage` via `deviceStore.ts`.

## Section 5 — Countdown.svelte

- Overlaid on the preview area only (not full screen)
- Large number (3 → 2 → 1) centred
- Circular progress ring around the number, depleting each second
- Number animates with a card flip transition between each count
- **Audio beep on each count** — short beep played via Web Audio API on 3, 2,
  and 1 — generate a simple sine wave tone, no external audio files
- **Browser tab title** shows the countdown: `3… | ScreenCast` →
  `2… | ScreenCast` → `1… | ScreenCast`
- WebcamBubble hidden — canvas compositing active from this point
- Triggers after Start Recording, auto-start on tab share, or Resume
- On complete → transition to `recording`, reset `document.title` to recording
  state

## Section 6 — Recording.svelte

### Capture (recorder.ts)

- Reuse `screenStream` acquired in Setup
- `getUserMedia({ video: { deviceId }, audio: { deviceId } })` for webcam + mic
- Composite screen + webcam onto a hidden `<canvas>` via `requestAnimationFrame`
- Canvas stream + mixed audio → `MediaRecorder` (WebM)
- Each recording session produces one WebM blob (segments stitched in FFmpeg at
  export)
- Expose `start()`, `stop()` from `recorder.ts`
- Listen for `ended` event on screen track — if fired during recording, stop
  recording and return to Setup empty state

### Audio mixing (recorder.ts)

- `AudioContext` with `MediaStreamDestination`
- Connect screen audio source + mic source → destination
- Mic node stored separately for mute toggle (disconnect/reconnect)

### Canvas compositing (recorder.ts)

- Draw screen capture full canvas each frame
- Draw webcam as fully circular clip at chosen snap position (120px diameter)
- No corner clipping — always a full circle
- Position passed in from `WebcamBubble` state
- When cam is off: draw nothing at bubble position

### 8-position compositing map

```ts
type BubblePosition = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'rc' | 'bc' | 'lc'
```

Canvas draw coordinates calculated per position at runtime.

### Browser tab title during recording

- Update `document.title` on each timer tick: `● REC 00:42 | ScreenCast`
- Reset to `ScreenCast` when recording stops

### UI

- **Top bar**: inherited from `+layout.svelte` — "ScreenCast" text logo |
  Shortcuts · Theme toggle | `● REC · mm:ss` badge
- **Bottom toolbar**: Mic combo button | Cam combo button | [spacer] | Stop
  button
- Recording dot: red, pulsing (hand-written CSS animation)
- Timer: `mm:ss` counting up from `00:00`

## Section 7 — Review.svelte

Appears as an overlay on the Setup preview area — not a full screen transition.

- Video paused on the last frame, shown in greyscale
- Three fully opaque action cards tiled horizontally over the video
- Meta pills above the cards: duration · mic status · cam status

**Cards**: | Card | Style | Action | |---|---|---| | Resume | Default shadcn | →
countdown → recording (new segment) | | Edit & Export | Default shadcn | →
editor | | Discard | shadcn `destructive` | → setup immediately, no confirmation
|

## Section 8 — Editor.svelte

### Video player

- `<video>` element fed from stitched WebM blob
- Play/pause button, current time / total time labels
- Scrubable progress bar with draggable thumb

### Timeline

- Video thumbnail tiles along the full timeline width (frames extracted via
  canvas seek)
- **Thumbnail generation runs in a Web Worker** (`thumbnailWorker.ts`) — never
  on the main thread
- Thumbnails are generated progressively and rendered into the timeline as they
  arrive from the worker
- Show a loading skeleton in thumbnail slots while generation is in progress
- Two trim handles (left = start, right = end), draggable on the timeline bar
- Playhead: thin vertical line + draggable handle at top
    - Click anywhere on timeline to jump playhead
    - Drag playhead handle to scrub
    - Synced to `video.currentTime`
- **Add Cut** button places a cut region at current playhead position
    - Click a cut region to select it (highlighted)
    - Drag edges of cut region to resize
    - Delete key or **Remove Cut** button removes selected cut region
- Cut regions shown as red overlay with "cut" label
- Excluded regions (outside trim, cut regions) shown with dark overlay
- Timestamp labels at even intervals below timeline

### Keyboard shortcuts

These work reliably because the user is focused on the ScreenCast tab while
editing:

- `Space`: play/pause
- `←` / `→`: step ±5s
- `C`: add cut at playhead
- `⌘E`: export

### Footer

Left: Back to Review | Centre: final length label | Right: Export & Download
button

## Section 9 — Processing.svelte

- Progress percentage + status label (e.g. "Exporting to MP4… 42%")
- Calls `ffmpegWorker.ts` (Web Worker) which wraps `ffmpegConverter.ts`
- **FFmpeg runs entirely off the main thread** to prevent tab lockup and crash
- Worker instantiated using Vite's Web Worker syntax:
  `new Worker(new URL('../ffmpegWorker.ts', import.meta.url), { type: 'module' })`
- Worker receives: array of WebM segment blobs + trim start/end + cut regions
- Worker posts progress messages back to the main thread for the progress
  indicator
- `ffmpegConverter.ts`:
    - Load `@ffmpeg/core` (single-threaded, no SharedArrayBuffer required)
    - Write each segment blob to FFmpeg virtual FS
    - Stitch segments, apply trim + cuts via `filter_complex`
    - Run conversion → `output.mp4`
    - Read output, return as `Blob`
- On complete → auto-trigger `<a download>` → transition to `done`

## Section 10 — Done.svelte

- Download auto-triggers immediately on arrival
- "Download started" message
- Filename: `screen-recording-YYYY-MM-DD.mp4`
- Buttons: Back to Editor | New Recording

## Section 11 — ShortcutsPanel.svelte

Toggled by Shortcuts button in top bar or pressing `?`. Rendered as a shadcn
`Dialog` overlay.

Note: keyboard shortcuts are only implemented for the Editor and general
navigation. Recording controls (stop, mute, webcam toggle) are not assigned
shortcuts — when recording is active the ScreenCast tab is in the background and
cannot intercept keyboard events.

**Editor** | Key | Action | |---|---| | `Space` | Play / pause | | `←` / `→` |
Step back / forward 5s | | `C` | Add cut at playhead | | `⌘E` | Export &
download |

**General** | Key | Action | |---|---| | `?` | Open shortcuts panel |

## Key Types (recorder.ts)

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
  segments: Blob[]  // one WebM blob per recording session
  trimStart: number
  trimEnd: number
  cuts: CutRegion[]
}
```

## deviceStore.ts

```ts
// Svelte 5 rune-based, persisted to localStorage
export const deviceStore = {
  webcamDeviceId: $state<string | null>(null),
  micDeviceId: $state<string | null>(null),
}
```

## GitHub Pages

- `adapter-static` configured in `svelte.config.js`
- `export const ssr = false` in `src/routes/+layout.ts`
- Build: `npm run build` → `/build`
- Deploy: push `/build` to `gh-pages` branch, or configure Pages to serve
  `/build` from `main`

## Notes

- Use `@ffmpeg/core` (not `@ffmpeg/core-mt`) — avoids
  `SharedArrayBuffer`/COOP/COEP header requirements on GitHub Pages
- **All heavy processing runs in Web Workers** — FFmpeg in `ffmpegWorker.ts`,
  thumbnail generation in `thumbnailWorker.ts` — never on the main thread
- Both workers must be instantiated using Vite's Web Worker syntax:
  `new Worker(new URL('../workerFile.ts', import.meta.url), { type: 'module' })`
- All app state in a single `$state` object in `+page.svelte`
- shadcn-svelte Svelte 5 track — confirm correct init command at time of setup
- `getDisplayMedia` stream acquired in Setup and reused in Recording — do not
  call twice
- Resume flow: each session produces a separate WebM blob; all segments stitched
  together in FFmpeg at export time
- Discard is immediate — no confirmation dialog
- WebcamBubble disappears entirely when cam is off
- WebcamBubble hidden from countdown onwards — canvas compositing handles the
  webcam overlay
- Theme preference (dark/light) persisted to `localStorage`
- No custom Tailwind theme extensions — vanilla shadcn styling only
- Keyboard shortcuts limited to Editor and general navigation only — recording
  shortcuts are not viable in a browser tab that loses focus during capture
- Auto-start countdown applies to tab sharing only
  (`displaySurface === 'browser'`) — not window or screen sharing
- `document.title` updated during countdown and recording, reset to `ScreenCast`
  at all other times
- Stream `ended` event handled in both Setup and Recording — always returns to
  Setup empty state cleanly
- Combo buttons use `DropdownMenuRadioGroup` / `DropdownMenuRadioItem` for
  device selection with built-in checkmark on selected item
- Combo buttons wrapped in shadcn `Tooltip` showing selected device name on
  hover; fallback label used when default device is active
