# Design reference

The approved V2 boards, exported from the design canvas. **These are the source
of truth for how YouDemo looks.** Where the specs in `../specs/` and these files
disagree, these files win; where these files and the code disagree, the code is
wrong.

Every board is a pair:

- `<name>.png`: the board as an image.
- `<name>.html`: the same board as standalone mark-up. Open it in Chrome and
  inspect it for exact sizes, spacing, colours, borders, radii and shadows,
  rather than measuring the image. It loads Figtree from `fonts/` and needs
  nothing else.

`manifest.json` lists every board, its size, the Storybook story that must
render it, and (for screens) the sections that are compared separately.
`npm run compare` reads it.

## Screens

Light theme only. Desktop boards are 1280 wide; the Editor boards are 960 tall
so the whole timeline fits.

| Board                           | Size     | Story (`Visual/Screens`) | What it is                                                       |
| ------------------------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| `screens/phone-not-supported`   | 390×844  | Phone not supported      | Blocking browser check on a phone: why, and share the link       |
| `screens/limited-support`       | 1280×800 | Limited support          | Non-blocking browser check, each capability in words             |
| `screens/setup-first-visit`     | 1280×800 | Setup first visit        | Setup with the welcome folded in (no dialog)                     |
| `screens/setup-returning`       | 1280×800 | Setup returning          | Setup once `ydWelcomed` is set                                   |
| `screens/countdown`             | 1280×800 | Countdown                | 3-second countdown, cancellable                                  |
| `screens/recording`             | 1280×800 | Recording                | Live preview, REC timer, Stop, dock locked                       |
| `screens/review`                | 1280×800 | Review                   | Between takes: takes list, next share, live dock, movable bubble |
| `screens/review-discard-dialog` | 1280×800 | Review discard dialog    | Discard confirmation over Review                                 |
| `screens/editor-joining`        | 1280×960 | Editor joining takes     | Editor opening while takes are joined: skeletons + progress      |
| `screens/editor`                | 1280×960 | Editor                   | Editor ready: breadcrumb, video, timeline, footer                |
| `screens/editor-trimming`       | 1280×960 | Editor trimming          | Trim mode: frames marked, Remove, footer swapped                 |
| `screens/editor-export-dialog`  | 1280×960 | Editor export dialog     | Export confirmation                                              |
| `screens/editor-exporting`      | 1280×960 | Editor exporting         | Export progress in the stage, editing locked                     |
| `screens/editor-exported`       | 1280×960 | Editor exported          | Saved notice; editing unlocked                                   |
| `screens/editor-discard-dialog` | 1280×960 | Editor discard dialog    | Discard confirmation over the Editor                             |
| `screens/editor-export-failed`  | 1280×960 | Editor export failed     | Failure card with Try again                                      |
| `screens/error`                 | 1280×800 | Error                    | Unexpected error, with "Your recording is safe"                  |

## Components

Each component board is a 960-wide sheet of the component's states on a
24px-padded `base` ground, exactly as the matching `Visual/Components/<Name>`
story must render it. The sheet's layout (wrapper padding, gaps, widths) is part
of the board: copy it from the `.html`.

| Board                       | Story (`Visual/Components`) |
| --------------------------- | --------------------------- |
| `components/app-header`     | AppHeader                   |
| `components/breadcrumb`     | Breadcrumb                  |
| `components/button`         | Button                      |
| `components/capture-dock`   | CaptureDock                 |
| `components/pill`           | Pill                        |
| `components/card`           | Card                        |
| `components/progress`       | Progress                    |
| `components/skeleton`       | Skeleton                    |
| `components/notice`         | Notice                      |
| `components/alert-dialog`   | AlertDialog                 |
| `components/status-list`    | StatusList                  |
| `components/timeline`       | Timeline                    |
| `components/editor-toolbar` | EditorToolbar               |
| `components/webcam-bubble`  | WebcamBubble                |
| `components/dropdown-menu`  | DropdownMenu                |
| `components/tooltip`        | Tooltip                     |

## The contract a story must meet

`npm run compare` finds each story by its **title and name** in Storybook's
`index.json`, opens it at the board's viewport, and screenshots one element.

- **One root.** The story renders exactly one element with
  `data-compare="root"`, at the board's size: 1280×800, 1280×960 or 390×844 for
  screens; 960 wide (height from content) for components. Nothing outside it is
  compared. Use `parameters: { layout: 'fullscreen' }`.
- **Sections.** Screens mark their bands with `data-section`, on the element
  whose box is the band: `header`, `breadcrumb`, `stage`, `dock`, `timeline`,
  `footer`, and `dialog` on the dialog panel itself. The manifest lists which
  each screen has. They are compared one by one, so a shift in one band shows in
  that band alone.
- **Media is masked.** `<video>`, `<canvas>` and anything with
  `data-compare-mask` are painted magenta in both the board and the build before
  diffing. In the boards, the captured screen, the webcam feed and the frame
  thumbnails carry `data-compare-mask`. In the build, put `data-compare-mask` on
  each thumbnail `<img>` and on any placeholder that stands in for a stream in a
  story. Their size and position still count.
- **Still frames.** The script turns off animation and transition, uses
  `prefers-reduced-motion: reduce` and waits for fonts. Every story must render
  its final state without user input: open dialogs, progress at 64%, the trim
  selection, the exported notice and so on are props or story args, never
  clicks.
- **Same data.** Stories use the boards' content, as display values even where
  they don't add up (see journey.md, Decisions 4): 2 takes (00:42, 00:36), 01:18
  in total, playhead 00:16, one earlier cut of 1.4 s, three frames marked (0.6
  s), file `youdemo-2026-10-09-201512.webm`, "Quarterly planning" as the shared
  tab, REC 01:12, progress 64%.

## Intended differences

The build may differ from the boards only here:

- **Media**: streams, captured screens, thumbnails and the camera feed are real
  (and masked by the script).
- **Device names** in menus and tooltips come from the browser.
- **The frame strip** scrolls horizontally. The boards show it scrolled so the
  playhead is the seventh visible frame, with the earlier cut's marker after the
  fourth. Stories reproduce that position with fixture data, not by scrolling.

## Re-exporting

After editing a board's `.html` by hand, run
`node scripts/compare.mjs --render-references` (or with a name filter) to
re-export its `.png`.
