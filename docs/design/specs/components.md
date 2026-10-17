# Components

Every part the screens are built from, the shadcn-svelte primitive under it, and
its board in `../reference/components/`. A component's story
(`Visual/Components/<Name>`) renders the same sheet of states as its board.

## shadcn-svelte primitives

Already in `src/lib/components/ui/`: alert, badge, button, card, dialog,
dropdown-menu, empty, progress, separator, tooltip.

Add with the shadcn-svelte CLI (`npx shadcn-svelte@latest add …`):

| Primitive      | Used for                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `alert-dialog` | Export, Discard (Editor and Review), New recording confirmations         |
| `skeleton`     | The Editor while takes are joined; frames without a thumbnail            |
| `breadcrumb`   | The Editor's breadcrumb row                                              |
| `slider`       | The scrubber                                                             |
| `toggle`       | Trim / Trimming                                                          |
| `scroll-area`  | The takes list on Review (if a plain overflow box can't match the board) |

Restyle the primitives through the tokens (see `foundations.md`) and the variant
definitions, not by hand-editing their markup. Where a generated primitive
imports a Lucide icon (check, chevron, close), switch it to the Hugeicons
equivalent; that is the one edit allowed inside `ui/`, and the handover should
list it. `empty` and `dialog` are no longer used by any screen once the V2
screens land; leave them unless nothing imports them.

## Icons

`@hugeicons/svelte` with `@hugeicons/core-free-icons`:

```svelte
<HugeiconsIcon icon={Mic01Icon} size={20} strokeWidth={1.5} />
```

| Where                                              | Hugeicons                                          |
| -------------------------------------------------- | -------------------------------------------------- |
| Choose what to share, share row, setup placeholder | `ComputerScreenShareIcon`                          |
| Mic / Muted                                        | `Mic01Icon` / `MicOff01Icon`                       |
| Camera / Camera off                                | `Video01Icon` / `VideoOffIcon`                     |
| Blur on / Blur off                                 | `BlurIcon` / `UserIcon`                            |
| Dock chevrons                                      | `ArrowDown01Icon`                                  |
| Back to review / Continue                          | `ArrowLeft01Icon` / `ArrowRight01Icon`             |
| Play, Pause, Stop recording                        | `PlayIcon`, `PauseIcon`, `StopIcon`                |
| Record take N                                      | `RecordIcon`                                       |
| Trim, Edit and export, setup feature row           | `ScissorIcon`                                      |
| Undo, Redo, cut restore                            | `UndoIcon`, `RedoIcon`, `UndoIcon`                 |
| Discard, Remove                                    | `Delete02Icon`                                     |
| Export, setup feature row                          | `Download04Icon`                                   |
| Zoom out / in                                      | `SearchMinusIcon` / `SearchAddIcon`                |
| Joining, Exporting                                 | `Loading03Icon`                                    |
| Exported, Available                                | `CheckmarkCircle02Icon`                            |
| Not available, Dismiss                             | `Cancel01Icon`                                     |
| Errors                                             | `Alert02Icon`                                      |
| Your recording is safe                             | `SecurityCheckIcon`                                |
| Reload YouDemo, Try again                          | `RefreshIcon`                                      |
| Copy link, Copy error                              | `Copy01Icon`                                       |
| Send the link                                      | `Share08Icon`                                      |
| Phone → computer                                   | `SmartphoneIcon`, `ArrowRight01Icon`, `LaptopIcon` |
| Drag to move                                       | `Move01Icon`                                       |
| New recording                                      | `PlusSignIcon`                                     |
| Take rows                                          | `VideoReplayIcon`                                  |
| Menu tick, Done trimming                           | `Tick02Icon`                                       |
| Dock note                                          | `InformationCircleIcon`                            |

## Parts

**AppHeader**: 64px band, "YouDemo" at 19/800 in ink, no icon, no toggle. Board:
`app-header`.

**Breadcrumb**: link, "/", current step, spacer, New recording. Board:
`breadcrumb`.

**Button**: primary, ghost, danger, danger ghost, icon, disabled, link. Hard
`0 4px 0` ink shadow and a 4px bottom margin; hover and press move 2px down onto
`0 2px 0`. Board: `button`. Extend `buttonVariants` with these variants and
sizes (`default` 44 tall, `lg` 52, `icon` 44×44) rather than adding classes at
each call site.

**CaptureDock**: three split buttons (toggle + device chevron) in a card dock
(radius 20, padding 12 14 8, gap 14). Mic/Muted, Camera/Camera off, Blur
off/Blur on. Off states use `danger-tint` with `danger` text; Blur on uses
`success-tint`; every state has a word. Locked: all dashed, plus the note.
Board: `capture-dock`. The chevrons open DropdownMenu.

**Pill**: 28 tall, ink outline, uppercase 12/700. Plain, sand, on
(`success-tint`), off (`danger-tint`, `danger` outline and text), REC (ink fill,
`rec` dot, timer). Board: `pill`. Built on `badge`.

**Card**: card ground, ink outline, radius 16. In-stage status cards add
`shadow-panel`. Board: `card`.

**Progress**: 12 tall pill, ink outline, card track, tangerine fill closed by an
ink edge; always with the percentage as text. Board: `progress`.

**Skeleton**: `rule` blocks pulsing 1.4s; still under reduced motion. Board:
`skeleton`.

**Notice**: tint ground, ink outline, radius 14, icon, bold first word. Success
for Exported and Your recording is safe. `role="status"`. Board: `notice`. Built
on `alert`.

**AlertDialog**: card panel 480 wide, radius 20, `shadow-panel`, scrim at 45%
ink, no blur. Title (22/800), body, optional details list (base ground, ink
outline, radius 14, meta labels), buttons right-aligned: the safe one first,
focused on open. Board: `alert-dialog`.

**StatusList**: card with hairline-divided rows: icon, name, optional
"Optional", status pill. Board: `status-list`.

**Timeline**: overview bar, frames (current, marked, skeleton), cut marker with
round restore button, labels. Board: `timeline`.

**EditorToolbar**: a 14px-gap row: Trim toggle, Undo + Redo (an 8px group), then
either zoom (label, out, in, as one 8px group pushed right) or, while trimming,
the hint and Remove N s. The component board and the Editor screens draw the
same markup. Board: `editor-toolbar`.

**WebcamBubble**: circle, 2px ink outline, `4px 4px 0` ink shadow; dashed ink
slots while dragging; "Drag to move" pill. Board: `webcam-bubble`.

**DropdownMenu**: card panel, ink outline, radius 14, `0 4px 0` shadow, 44px
rows, chosen row `accent-tint` with a tick. Board: `dropdown-menu`.

**Tooltip**: ink chip, card text, 14/600, radius 10. Board: `tooltip`.

**Countdown ring** (part of the countdown screen): 200px; `rule` track and
tangerine arc, both 10 wide on r 86, the arc with round caps; a 1.5px ink circle
at r 93; the numeral at 88/800 in ink.
