---
description: Draw ASCII wireframes of UI changes, and sequence diagrams of data flows, for the user to approve before anything is built. Load before planning or building any change a user will see (a new screen, component, state, or a moved control) and whenever a flow crosses +page.svelte, recorder.ts, OPFS and export — or when the user asks to "see it", for a wireframe, a mock-up or a diagram.
name: ascii-wireframes
---

# ASCII wireframes

The user reads a wireframe faster than a paragraph, and one drawing catches a
misunderstanding that three rounds of prose miss. **Draw first, build second:** any
change a user will see gets a wireframe the user has approved before its code is
written. When feedback on a built screen changes the layout, redraw before rebuilding.

They're often read in the VS Code chat panel, where only plain ASCII is reliably one
column wide: box-drawing characters (`- | +` drawn as their Unicode cousins) render
narrower than letters, and symbol glyphs render wider or narrower again, so a row
containing any of them drifts out of line. **Draw with printable ASCII only.**

## What to draw

- **Every state, not just the happy one.** The state machine (`app-shell`) is where
  the surprise hides:
    - `check` — a critical failure (no way forward) and an optional-only failure
      ("Continue anyway")
    - Setup with no screen picked and with a live preview; camera off; blur on
    - the countdown overlay, and Recording with its REC badge
    - Review, and the transient `stitching` progress
    - the Editor at rest, in edit mode, and with a selection ready to delete
    - Processing mid-export and with its in-place error; Done
    - the crash-recovery entry, which skips Setup and lands in the Editor
- **Before and after** for a change to something that exists. Label them `BEFORE` /
  `AFTER`.
- **The neighbours.** Draw enough of what surrounds the change (the top bar, the
  ControlBar, the frame strip) to show where it sits and what it pushes aside. Where a
  thing lives is as much the design as how it looks.
- **Real copy and real icons.** Copy lives inline in each component — use the actual
  strings ("No screen selected", "Download started"), never lorem ipsum. Name an icon
  with a short ASCII word in brackets (`[mic]`, `[trash]`, `[x]`), and name the
  **lucide** icon in a note underneath (`MicOff`, `Trash2`).
- **Every screen it touches.** A shared component gets drawn where it's hardest to
  fit — usually Setup with the ControlBar and webcam bubble at a narrow width, or the
  Editor's frame strip.

## How to draw

- Put each wireframe in a fenced code block with no language.
- Borders are `+` for corners and junctions, `-` across and `|` down. Buttons are
  `[ Label ]`, an icon button is `[x]`, a dropdown is `[ Value  v ]`, a button with a
  chevron is `[ [mic] | v ]`, a selected item is `*` and an ellipsis is `...`.
- No character outside printable ASCII anywhere in the block: no box-drawing, arrows,
  ticks, ellipsis glyphs or emoji, in the drawing or its labels.
- Keep a width of about 90 columns or less; every row of a box ends in the same column.
- **Check the widths before you show it** — counting by eye drifts. Write the drawings
  to a scratch file and print each row's length:
  `awk '{ printf "%3d %s\n", length($0), $0 }' wireframe.txt`. Every row of one box
  must print the same number; fix any that doesn't, then paste the checked text.
- Put notes **below** the drawing, as plain bullets. Never write annotations inside
  the boxes, or a note wide enough to break the alignment.
- One region per drawing. The top bar, the preview area and the ControlBar are
  separate drawings.

## Sequence diagrams for data flows

When the work moves a recording between `+page.svelte`, `recorder.ts`, OPFS and the
stitcher, draw the sequence as well, and **name the data types**.

1. First, list each piece of data as a table: where it lives, the shape
   (`MediaStream`, `Blob`, `Blob[]`, `DeletedRange[]`) and what it is handed to.
2. Then one diagram per path: participants across the top, arrows down the page, the
   payload written on each arrow. Draw the failure path as well as the success path —
   the failure path is where a recording gets lost.

```
User   +page.svelte     recorder.ts    crashStore (OPFS)   videoStitcher
  |          |               |                 |                 |
  |- Stop --->               |                 |                 |
  |          |- stop() ------>                 |                 |
  |          <- Blob --------|                 |                 |
  |          |- saveSegment(i, Blob) ---------->                 |
  |          | segments: Blob[], state = review|                 |
  |- Edit --->               |                 |                 |
  |          |- stitchSegments(Blob[]) --------------------------->
  |          <- editorBlob: Blob -------------------------------|
  |          | state = editor                  |                 |
  |          |                                 |                 |
  |          | ... stitchSegments throws instead ...             |
  |          | goToEditor catches: hasError = true, ErrorScreen  |
```

- A crash-store failure is swallowed: OPFS unavailable or over quota means no crash
  protection, never an error the user sees (`persistence`). Draw that, not a rejection.
- Export runs inside `Processing` (`renderEditedVideo(Blob, DeletedRange[])`), and its
  failure shows **in place** on that screen, not on the global `ErrorScreen`
  (`video-export`).

## Keep it light

A wireframe is a question, not a spec. Keep the prose around it short, end with one
question ("Build it?" plus the one or two decisions it exposes), and ask that question
with AskUserQuestion. If the answer is a change, redraw only the part that changed.
