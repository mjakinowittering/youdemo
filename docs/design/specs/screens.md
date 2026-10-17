# Screens

How each screen is put together. Exact values are in the board's `.html`; this
page names the parts, the components that build them and the measures that are
easy to get wrong. Read it alongside `journey.md` (behaviour) and
`components.md` (parts).

## The frame every desktop screen shares

Top to bottom, full width, each band separated by a 1.5px `ink` rule:

| Band                           | `data-section` | Ground | Height / padding                                                  |
| ------------------------------ | -------------- | ------ | ----------------------------------------------------------------- |
| Header                         | `header`       | base   | 64; padding 0 24; rule below                                      |
| Breadcrumb (Editor)            | `breadcrumb`   | base   | 56; padding 0 24; gap 12; rule below                              |
| Stage                          | `stage`        | sand   | fills the rest (`flex: 1; min-height: 0`)                         |
| Capture dock (capture screens) | `dock`         | base   | padding 14 24 12; dock centred; optional note 6 below; rule above |
| Timeline (Editor)              | `timeline`     | base   | see Editor; rule above                                            |
| Footer (Editor)                | `footer`       | base   | 76; padding 0 24; gap 14; rule above                              |

Screens are 1280×800 (Editor 1280×960). The root is a fixed-size flex column
with `overflow: hidden`.

## phone-not-supported (390×844)

Header (padding 0 16). Main: padding 32 20 24, column, gap 22: the phone →
laptop icons (32, 20, 36), title at 30px, two body paragraphs, the large primary
"Send the link to my computer" full width, the link card (padding 14 16, gap 10:
meta "Or copy the link", the URL at 15/600, a copy icon button), and the privacy
line pushed to the bottom (`margin-top: auto`).

## limited-support

Stage centres a 560 column, gap 22: sand pill "Browser check", screen title,
lead, StatusList (four rows), and the primary "Continue without them" with a
trailing chevron. No dock.

## setup-first-visit / setup-returning

Stage is a row:

- **Left column** 460 wide. First visit: padding 40 40 32, gap 22: pill "First
  time here", display heading, lead, three feature rows (22px icon, gap 12, body
  in ink), the large primary "Choose what to share" 8 below. Returning: padding
  40, gap 18, vertically centred: display "Ready when you are", lead, the
  button, and the small "Recording starts three seconds after you choose."
- **Preview area** fills the rest: margin 32 32 32 0, 1.5px dashed `ink`, radius
  16, centred placeholder (40px share icon, row "Your screen will show here",
  small "A tab, a window or your whole screen"). The WebcamBubble (112) sits 18
  from the top and right, with the "Drag to move" pill 8 below.

Dock below: Mic, Camera, Blur on.

## countdown

Stage centres a column, gap 20: the ring (200, see components), screen title
"Recording starts in 3", lead "Switch to what you want to show. Come back to
this tab to stop.", ghost Cancel. Dock locked, with the note.

## recording

Stage centres a column, padding 24, gap 18: a row the width of the preview
(820): REC pill, "Take 2", spacer, small "Stopping the share in Chrome also ends
the take"; the preview frame 820×461; Stop recording (danger, large). Dock
locked, with the note.

## review / review-discard-dialog

Stage centres a column, gap 24:

- Heading block: meta "Recording paused", screen title "2 takes, 01:18 in
  total".
- A row, gap 48:
    - **Left** (620): the preview frame 620×348 with seven dashed slots and the
      bubble (70, ink outline, 4px offset) at the current spot; 12 below, the
      share row (620×56, card, ink outline, radius 14, padding 0 14: share icon,
      "Next take shares **Quarterly planning**", Change link at 14px); 12 below,
      the drag hint.
    - **Right** (380): a 348-tall column (gap 20) holding the takes card (fills;
      its list scrolls; "Record take 3" pinned at the foot behind a hairline,
      padding 12 14) and Discard recording (large danger ghost, full width),
      closed by a 1.5px ink rule at the bottom; then 12 below, Edit and export
      (large primary, full width, 56 tall) level with the share row.

Dock live: Muted, Camera, Blur on. The dialog board adds the scrim and the
Discard dialog.

## Editor (all editor-* boards)

- **Breadcrumb**: link "Back to review" with a left chevron, "/" and "Edit"
  (small, ink, 600), spacer, ghost "New recording" with a plus.
- **Stage**: the video frame 533×300 centred (ink outline, radius 10). The
  exported board puts the Notice 24 from each side, above the video, gap 12.
  Joining, exporting and failed replace the video with an in-stage Card (440, or
  520 for the failure; padding 24; gap 14; `shadow-panel`).
- **Timeline band**, top to bottom:
    - scrubber row: padding 12 24 0, gap 14: play icon button, time (min-width
      110, small, ink, 600), slider (12 tall, ink outline, tangerine fill, 22px
      card thumb with ink outline and a 2px ink shadow);
    - toolbar: padding 12 24, gap 14 (see EditorToolbar);
    - overview bar: 0 24 side padding, 32 tall;
    - frame strip: 30 top padding (room for the restore buttons), 24 left
      padding, cells 80×64, gap 3, overflowing to the right;
    - labels: padding 6 24 12: start, middle, and "01:18 after cuts" (ink, 600).
- **Footer**: Discard (danger ghost) and Export (primary) on the right. In trim
  mode: "Export and discard are hidden while you trim." on the left and Done
  trimming (primary) on the right.
- **Dialogs**: scrim over the whole board, the dialog centred (480, padding 28,
  gap 18, radius 20).
- **Disabled states** (joining, exporting): the breadcrumb link, New recording
  and the footer buttons are disabled (dashed). Exporting also disables the play
  button, Trim, Undo, Redo and zoom. Joining instead shows Skeleton blocks where
  the slider, toolbar, overview bar, frames and labels will be, and the footer
  reads "Preparing your timeline…" beside the disabled Discard and Export.

## error

Stage centres a 600 column, gap 22: 48px alert icon in `danger`, screen title,
lead (the reason), the success Notice "Your recording is safe" (padding 16, icon
top-aligned, row-style title at 17px), a row of large Reload YouDemo (primary)
and Copy error (ghost), and Technical details as a card-styled `<details>`
(padding 14 18) with the stack in monospace 12.5px.
