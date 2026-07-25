---
name: editor-timeline
description: The Editor screen and its sub-components (VideoPlayer, Scrubber, EditorToolbar, FrameStrip, EditorFooter) plus the pure timeline math in editorMath.ts — effective duration/time, deleted ranges, cut selection, frame-strip cells, thumbnails and virtualization. Load when changing playback, seeking, trimming, the frame strip, or anything about how cuts are represented.
---

# Editor & timeline

`src/lib/components/Editor/Editor.svelte` is a **shell**: it owns all state and
composes five presentational children, top to bottom.

| Component           | Role                                                     |
| ------------------- | -------------------------------------------------------- |
| `VideoPlayer`       | `<video>`, click-to-toggle, deleted-span skipping         |
| `Scrubber`          | play/pause, `mm:ss / mm:ss`, range input                  |
| `EditorToolbar`     | Cut · Delete · "Final: <effectiveDuration>"               |
| `FrameStrip`        | thumbnail cells, playhead, timestamp labels               |
| `EditorFooter`      | Back to Review · Discard · Export & Download              |

It receives one `videoUrl` — the single combined recording (`editorBlob`), see
`app-shell`. Callbacks out: `onback`, `ondiscard`, `onexport(deletedRanges,
totalDuration)`.

## The math lives in `editorMath.ts`

**All timeline maths is pure and already extracted** — no DOM, no video element —
so it is unit-testable in node (`tests/editorMath.spec.ts`). Do not reimplement any
of it inside a component; import it.

| Export                       | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `computeEffectiveDuration`   | raw duration − sum of deleted spans                       |
| `computeEffectiveCurrentTime`| raw playhead → kept timeline                              |
| `effectiveToRawTime`         | inverse — used when the scrubber seeks                    |
| `resolveSeekTarget`          | snap a time out of a deleted span to the span's end       |
| `computeCellCount`           | cells for a duration                                      |
| `computeDeletedCells`        | original cell indices inside deleted spans                |
| `computeVisibleCells`        | surviving original indices, in order                      |
| `computeVirtualWindow`       | rendered position range for the current scroll            |
| `computeTimestampLabels`     | ~8 labels across the visible strip                        |
| `selectionToRange`           | selected cells → `DeletedRange`                           |
| `formatTime`                 | `mm:ss`                                                   |
| Constants                    | `FRAME_RATE` 30, `SAMPLE_INTERVAL` 0.2, `CELL_WIDTH` 80, `CELL_HEIGHT` 64, `CELL_GAP` 3, `CELL_STRIDE` |

The shell wires them into `$derived` — `cellCount`, `currentCell`, `deletedCells`,
`visibleCells`, `effectiveDuration`, `effectiveCurrentTime`, `canDelete`.

Everything downstream is driven by `effectiveDuration` / `effectiveCurrentTime`,
**never** raw `video.duration` / `video.currentTime`.

## Cuts are non-destructive

Trimming never touches the blob. `deletedRanges: DeletedRange[]` (from
`types.ts`) is the whole representation; it is handed to `Processing` at export,
where the kept ranges are re-rendered. See `video-export`.

## VideoPlayer

- Click (or Enter/Space) anywhere on the video toggles play/pause and flashes a
  96px `Play`/`Pause` in `text-indigo-500` using the `animate-ping-once` token,
  cleared after 600ms. See `tailwind-theme`.
- `paused`, `currentTime` and `duration` are `$bindable`, bound straight to the
  `<video>` — the shell reads them as its source of truth.
- **Deleted-span skipping** happens in a `timeupdate` listener: it calls
  `resolveSeekTarget`, returns immediately if nothing changed, and otherwise jumps.
  A span that runs to the end pauses and parks just before it. The jump is wrapped
  in `requestAnimationFrame` with a `Math.abs(videoEl.currentTime - pos) < 0.1`
  guard so a user seek that lands mid-frame isn't overridden.

## FrameStrip

Cells are `CELL_WIDTH × CELL_HEIGHT` with `CELL_GAP` spacing (`CELL_STRIDE` is the
sum). Cell state is a **border plus an absolutely-positioned tint overlay**:

| State                | Classes                                              |
| -------------------- | ---------------------------------------------------- |
| Default              | `border-2 border-transparent rounded-xs cursor-pointer` |
| Active (current)     | `border-indigo-500` + overlay `bg-indigo-500/30`     |
| Selected (edit mode) | `border-red-500` + overlay `bg-red-500/20`           |
| Collapsing           | `mr-0! w-0! opacity-0` over `transition-[width,margin,opacity] duration-250` |

- **Playhead**: `absolute top-0 w-0.5 bg-indigo-500 z-10 pointer-events-none`,
  positioned at `currentCellPos * CELL_STRIDE`.
- **Virtualized** — only the window from `computeVirtualWindow` (±5 cells of
  slack) renders, behind a left spacer div, with the outer width fixed at
  `visibleCells.length * CELL_STRIDE`.
- Cells are keyed by **original** index while positioned by rendered index;
  `cellRenderPos` maps between them. Keep that distinction — mixing them up
  misplaces the playhead after a cut.
- Missing thumbnails render an `animate-pulse` placeholder.
- An `$effect` keeps the playhead centred while playing.

## Thumbnails

Generated in the shell's `onMount`: a detached `<video>` is seeked to each sample
point and drawn to a canvas at cell size, stored as a JPEG data URL (quality 0.6)
in a `SvelteMap`. `await setTimeout(0)` between frames yields to the main thread;
a `cancelled` flag stops the loop on unmount. Browser-bound by nature — this is
the one part of the Editor that isn't pure.

## Edit mode

1. **Enter** — Cut button; it switches to the `default` variant with
   `bg-indigo-500 text-white` and its label becomes "Selecting…".
2. **Select** — click an anchor cell, then an end cell; the inclusive range turns
   red. Clicking outside edit mode seeks instead.
3. **Delete** — the destructive Delete button appears only when
   `canDelete` (edit mode + a non-empty selection). It sets `collapsingCells`,
   waits 250ms for the width animation, then appends `selectionToRange(...)` to
   `deletedRanges` and clears the selection.
4. **Auto-exit** — `editMode` returns to `false` after a deletion, every time.

`deletedRanges` is append-only here; there is no un-delete.

There is **no Delete-key shortcut** — see the keyboard rule in `CLAUDE.md`.
