---
name: editor-timeline
description: The Editor — Editor.svelte (container) over EditorView (the screen from props) and its parts (VideoPlayer, Scrubber, EditorToolbar, OverviewBar, FrameStrip, TimelineLabels, EditorFooter) — plus the pure maths in editorMath.ts: effective time, the undoable cut history, zoom levels, strip layout, overview geometry. Load when changing playback, seeking, trimming, undo/redo, zoom, the frame strip, thumbnails, or how cuts are represented.
---

# Editor & timeline

Boards: `docs/design/reference/screens/editor*`; behaviour:
`docs/design/specs/journey.md` section 7.

## Container and view

- **`EditorView.svelte`** draws the whole screen — breadcrumb, stage, timeline
  band, footer and the three dialogs — **from props only**, for every phase
  (`joining`, `ready`, `exporting`, `failed`). The video comes in as a snippet.
  The Editor stories render it with the boards' numbers as drawn, even where
  they don't add up (journey.md, Decisions 4).
- **`Editor.svelte`** is the container: it owns playback (bound to the
  `<video>` in `VideoPlayer`), trim mode and selection, zoom, strip panning,
  thumbnails and the dialogs' open state, and works out every display value
  through `editorMath.ts`. The cut history, phase and export state come from
  `+page.svelte` (`app-shell`).

## The maths lives in `editorMath.ts`

Pure, no DOM, unit-tested in `tests/editorMath.spec.ts`. Don't reimplement any
of it in a component.

| Export                                   | Purpose                                           |
| ---------------------------------------- | ------------------------------------------------- |
| `computeEffectiveDuration` / `…CurrentTime` | raw → kept timeline                            |
| `effectiveToRawTime`                     | kept → raw (a time on a cut's start maps past it) |
| `resolveSeekTarget`                      | snap out of a cut to its end                      |
| `selectionToRange`                       | selected cells at an interval → `DeletedRange`   |
| `CutHistory`, `emptyHistory`, `currentCuts`, `addCut`, `restoreCut`, `undo`, `redo`, `canUndo`, `canRedo` | the undoable cuts; `addCut` merges overlaps |
| `ZOOM_LEVELS` (0.2, 1, 5), `zoomLabel`   | seconds a frame                                   |
| `stripLayout`                            | frames and cut markers with x positions           |
| `entriesInView`, `frameAt`               | virtualising, the playhead's frame                |
| `overviewGeometry`                       | the overview bar's window, cuts and playhead in % |
| `formatTime`, `StripItem`, `StripEntry`, constants | `CELL_STRIDE` 83, `CUT_STRIDE` 14 …     |

Everything shown runs off effective (kept) time, never raw `video.duration`.

## Cuts are non-destructive

Trimming never touches the blob. The cuts are a `DeletedRange[]` at the head of
the history; export copies the kept ranges (`video-export`). Restoring a cut
and Remove are history steps, so both undo.

## Timeline band

- **Scrubber**: play/pause, "mm:ss / mm:ss", and a shadcn `Slider` styled as
  the board's native range (the root is the bordered track, with the range
  input's 2px margin).
- **EditorToolbar**: Trim (a `Toggle`; "Trimming" when pressed), Undo + Redo,
  then the zoom group, or in trim mode "Select the frames to remove" and
  **Remove N s**.
- **OverviewBar**: the whole kept recording; click or drag pans the strip.
- **FrameStrip**: the row of frames (80×64, every one a button, a skeleton
  until its thumbnail arrives) and cut markers with a round restore button. It
  doesn't clip or scroll itself: the Editor wraps it in an `overflow-hidden`
  band, pans it with `offset` (a transform) and virtualises with `leading`.
  Wheel input pans.
- **TimelineLabels**: start and middle of the view, "mm:ss after cuts".

## Trim mode

Click a frame to anchor, another to select the range. Remove cuts it and
stays in trim mode. While trimming, New recording hides and the footer swaps
Export and Discard (sliding down, 200ms, instant under reduced motion) for
"Export and discard are hidden while you trim." and **Done trimming**.

Out of trim mode a click on a frame seeks. While playing, the strip follows
the playhead.

## Thumbnails

Generated in the container: a detached `<video>` seeks to each frame's 0.2 s
cell (`base`) and draws it at cell size into a JPEG data URL. The frames
nearest the middle of the view go first, then outwards; results are flushed
into the `SvelteMap` in batches (8, or every 150ms). Every zoom level shares
them.

## No shortcuts

No Delete key or other keyboard shortcut — see `CLAUDE.md`.
