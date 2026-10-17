# Journey and behaviour

What changes in how YouDemo works, screen by screen. The boards in
`../reference/` show how each state looks; this page says how the app gets there
and what each control does. Each item ends with how to check it.

## State machine

```
V1: check → setup → countdown → recording → review → [stitching] → editor → processing → done
V2: check → setup → countdown → recording → review → editor
                        ↑  cancel  │                 │  ↑
                        └──────────┘ (back to where   │  └ Back to review
                                      you came from)  └ Record take N → countdown
```

- `stitching`, `processing` and `done` are removed as app states. Joining takes
  and exporting become phases **inside** the Editor (`joining`, `ready`,
  `exporting`), so the Editor never unmounts during an edit.
- The Welcome dialog is removed. First-visit content lives in Setup.
- The error screen still pre-empts everything.

## 1. Header

- "YouDemo" as plain `ink` text, no icon. No theme toggle.
- `app.html` no longer sets `class="dark"`; `ydTheme` is ignored for now.
- The favicon and Open Graph image stay as they are (see Out of scope).

Check: the header matches `components/app-header` in every screen board.

## 2. Browser check

Two outcomes when a check fails (all passing goes straight to Setup, as now):

- **Blocking** (screen capture or recording missing; in practice a phone):
  `screens/phone-not-supported`. Explains why, names Chrome, Edge and Arc. "Send
  the link to my computer" calls `navigator.share({ title: 'YouDemo', url })`,
  and is hidden where `navigator.share` doesn't exist. The link card shows the
  URL as selectable text, and its copy button writes it to the clipboard and
  confirms with a "Copied" tooltip. The layout is designed at 390 wide; on a
  wider blocked browser the same column sits centred.
- **Limited** (camera or audio mixing missing): `screens/limited-support`. Every
  row has a pill in words ("Available", "Not available") and optional rows say
  "Optional". "Continue without them" goes to Setup.

Check: stories for both; the share button hides when `navigator.share` is
undefined (unit test the helper).

## 3. Setup

- First visit (no `ydWelcomed`): `screens/setup-first-visit`. Returning:
  `screens/setup-returning`. Set `ydWelcomed` the first time a take starts.
- Left column: copy and "Choose what to share". Right: the dashed preview area
  with the live webcam bubble at **224px**, draggable to the eight positions
  (same geometry as now), with a "Drag to move" pill under it. The bubble is big
  so you can check you're in frame; it isn't to scale. The recording still draws
  it at 18% of the video's height (`BUBBLE_FRAC = 0.18`, unchanged). The circle
  crops the same centre square at any size, so what you see is what's recorded.
- The capture dock sits in its own band below (mic, camera, blur), live.
- "Choose what to share" opens the browser's picker; recording then starts after
  the countdown, as in V1.

## 4. Countdown

- `screens/countdown`: the ring (tangerine arc on a `rule` track, ink outline),
  "Recording starts in 3", the hint, and **Cancel** (new).
- Cancel stops the stream just picked and goes back to where you came from:
  Setup, or Review if takes exist.
- Chrome moves focus to a shared tab or window as soon as it's picked (the
  default focus behaviour), so the countdown mostly runs while you're on the
  shared tab. Leave it that way (Decisions 5).
- The dock is locked (dashed) with the note "Mic, camera and blur can change
  between takes".

## 5. Recording

- `screens/recording`: REC pill (ink, `rec` dot, timer), "Take N", the live
  composited preview in an ink frame, and Stop recording (danger, large).
- **Ending the share from the browser's own "Stop sharing" bar now behaves like
  Stop**: the take is kept, saved to the crash store, and you land on Review.
  Today `handleStreamEnded` resets to Setup and clears every take and the crash
  store, losing the recording. This is a bug fix.

Check: an E2E test that ends the display track mid-recording lands on Review
with the take listed.

## 6. Review

`screens/review`, `screens/review-discard-dialog`.

- Heading "N takes, mm:ss in total" under the "Recording paused" eyebrow. Keep
  each take's duration so the list and total can show them.
- Left: a preview of the shared screen (live if the share is still running,
  otherwise the last frame of the last take) with the camera bubble live on it,
  draggable to the eight dashed spots; this sets `bubblePosition` for the next
  take. Here the bubble is to scale (18% of the frame's height).
- **Framing check** (`screens/review-framing-check`): on hover or keyboard focus
  the bubble grows in place to 160px, towards the centre of the frame (anchored
  at its own corner or edge), and a "Check your framing" pill appears 8px away
  on the side facing the centre, aligned to the bubble's outer edge. The dashed
  spots hide while it's enlarged. It snaps back to scale when a drag starts and
  grows again when the drag ends if the pointer is still over it. 150ms
  ease-out; under reduced motion it swaps size without animating. The bubble is
  focusable (`tabindex="0"`) with an aria-label such as "Camera preview. Drag or
  use the arrow keys to move."
- Under the preview, the share row: "Next take shares **<label>**" and
  **Change**. The label is the display track's `label`. Change opens the picker
  and replaces the stream.
- Right: the takes list (scrolls when long) with "Record take N" pinned at its
  foot; then Discard recording; a 1.5px ink rule; then **Edit and export**, its
  top level with the share row's.
- **Record take N** reuses the current display stream when its track is still
  `live` and goes straight to the countdown; if the share has ended it opens the
  picker first.
- **Discard recording** opens the alert dialog. Discard deletes every take,
  every cut and the crash store, and goes to Setup. Keep recording closes it.
- **The capture dock is live** on Review: mic, camera and blur changes apply to
  the next take. The camera therefore stays on between takes (Decisions 1).

## 7. Editor

`screens/editor-*`. One screen with phases.

**Opening.** One take: straight to `ready`. Several: `joining` first. The Editor
mounts at once with skeleton controls (`screens/editor-joining`) and a card in
the stage, "Joining N takes" with a progress bar and percentage, and a line for
the step it is on: "Reading your takes…", "Re-encoding to match your takes…"
(only when the takes differ), then "The timeline fills in once they're joined."
The breadcrumb and footer are disabled. Then `ready`.

**Breadcrumb row.** "Back to review" (link) returns to Review with cuts kept; "/
Edit" marks the step; **New recording** on the right (hidden while trimming)
starts again after a confirmation (Decisions 2).

**Cuts live in `+page.svelte`**, not in `Editor.svelte`, so they survive Back to
review and any remount. This closes the README bug "Keep cuts on Back to
Editor".

**Scrubber.** Play/pause icon button, "mm:ss / mm:ss" (effective times, after
cuts), and a slider (shadcn Slider, styled per the board).

**Toolbar.**

- **Trim** toggles trim mode; pressed it reads "Trimming" (ink fill).
- **Undo** and **Redo** step through a history of cut operations (cut, restore).
  Each is disabled when there is nothing to step to.
- **Zoom**: "0.2 s a frame" label, zoom out and zoom in. Levels are 0.2 s, 1 s
  and 5 s a frame; the button at the limit is disabled.
- In trim mode the middle reads "Select the frames to remove" and the far right
  shows **Remove N s** (danger), naming the selection's length.

**Timeline.**

- **Overview bar**: the whole recording in one outlined bar. The visible part of
  the strip is an `accent-tint` window with ink edges; each cut is a `danger`
  line; the playhead an ink line. Clicking or dragging the window scrolls the
  strip.
- **Frames**: 80×64 at 0.2 s; the playhead frame gets a 3px ink outline; frames
  marked for removal turn `danger` with a `danger-tint` veil.
- **Cut markers**: where frames were removed, a `danger` line with a round
  restore button ("Restore cut, N seconds"). Restoring is an undoable operation.
- **Labels** under the strip: start and middle times, and "mm:ss after cuts" at
  the end. The old "Final: mm:ss" in the toolbar is gone.
- **Thumbnails** are generated for the visible frames first, then outwards, and
  updates are batched, so long recordings stay responsive. Frames without a
  thumbnail yet show as skeleton cells.

**Trim mode.** Clicking frames selects them, as now. Remove cuts the selection
and keeps you in trim mode. While trimming, the footer's Discard and Export
slide down and fade out (200 ms) and the footer shows "Export and discard are
hidden while you trim." with **Done trimming** (primary). Reduced motion swaps
without animating.

**Footer.** Discard (danger ghost) and Export (primary), together on the right.
Neither acts directly:

- **Export** opens `screens/editor-export-dialog`: length after cuts, number of
  cuts, file name; Cancel or Export.
- **Discard** opens `screens/editor-discard-dialog`: Keep editing or Discard;
  Discard deletes takes, cuts and the crash store, then Setup.

**Exporting.** `screens/editor-exporting`: the stage shows a card with
"Exporting", progress and a line for the step it is on: "Reading your
recording…", "Re-encoding to match your takes…" (only when needed), "Applying
your cut. Editing unlocks when the file is saved.", then "Saving…". The bar only
moves forward and shows 100% only once the file exists; the tab title shows the
same number. Every control is disabled (dashed). With no cuts there is nothing
to do: the file downloads straight away, with no Exporting card. When done, the
file downloads automatically (`youdemo-YYYY-MM-DD-HHMMSS.webm`, as now) and the
Editor returns to `ready` with the **Exported** notice above the video
(`screens/editor-exported`), dismissible. Cuts stay. **The crash store is no
longer cleared on export**; it is cleared by Discard and New recording only.

**Export failed.** `screens/editor-export-failed`: a card in the stage, "Export
didn't finish", the reason, "Your takes and cuts are still here.", Technical
details (collapsed `<details>`), **Try again** and **Copy error**.

Remove `Processing.svelte`, `Done.svelte` and the stitching screen in
`+page.svelte`. Their logic moves into the Editor's phases.

## 8. Error screen

`screens/error`.

- A 48px alert icon in `danger`, "Something went wrong", and a friendly reason
  where the error is recognised (for example `NotReadableError` → "YouDemo
  couldn't start your camera. Another app might be using it."), otherwise
  "YouDemo ran into an unexpected error."
- **Your recording is safe** notice, only when the crash store holds takes.
- **Reload YouDemo** (primary), **Copy error** (ghost), and the stack inside a
  collapsed Technical details.

## Titles

Keep one owner (`titles.ts`). Replace the stitching, processing and done titles
with: joining "Joining takes… 64% | YouDemo", exporting "Exporting… 64% |
YouDemo", exported "Exported | YouDemo". The countdown leads with the number, so
it survives a truncated tab and shows from the shared tab: "3 | YouDemo", "2 |
YouDemo", "1 | YouDemo", then a brief "0 | YouDemo" until recording starts. It
follows the time elapsed, not a count of ticks, so it stays right while YouDemo
is a background tab. Recording, review and editing titles stay as they are.

## Out of scope

- Dark mode and the theme toggle.
- The choppy-export playback bug.
- The floating capture control (dropped).
- Favicon, app icon and Open Graph image.

## Decisions

Settled with Matthew on 17 October 2026:

1. **Camera on Review: keep it live.** Matches the board. The camera and blur
   stay on between takes, and dock changes show straight away. The camera light
   stays on while you're on Review.
2. **New recording confirmation: reuse the discard dialog.** The same
   AlertDialog, titled "Start a new recording?", with Keep editing and a danger
   "Start new". No board, so no compare row covers it.
3. **Review when the share has ended: placeholder.** The preview shows Setup's
   dashed "Your screen will show here" placeholder, and the share row reads
   "Next take: choose what to share" with Choose in place of Change. Not drawn.
4. **Timeline display values are presentational props.** The Editor boards'
   numbers are illustrative and don't agree with each other (the scrubber total
   vs "after cuts", the overview window vs the frames shown, the label spacing,
   and where the cut sits relative to the playhead). Timeline, Scrubber and
   EditorToolbar take display values as props (times, labels, percentages,
   cells). Editor.svelte works them out from editorMath in the app, and the
   stories pass the board's numbers as they are. The boards are not changed.
   editorMath's behaviour is covered by unit tests, not by the screen stories.
5. **Focus on pick: let Chrome switch straight away.** A web page can't switch
   tabs at zero. `CaptureController.setFocusBehavior()` decides only at the
   moment of picking (switch now, or stay on YouDemo), and switching later needs
   the WebExtensions Tabs API, which means a companion extension. So keep the
   current behaviour: don't call `setFocusBehavior`, Chrome switches on pick,
   and recording starts at zero.
