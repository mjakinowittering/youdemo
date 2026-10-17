---
name: shadcn-ui
description: shadcn-svelte and Hugeicons conventions for YouDemo's V2 design — which primitives are installed and how they're restyled, the button variants, the design parts built on them (Pill, Notice, ConfirmDialog, StageCard, ListCard, the dock's split buttons), tooltips and menus that render in place for stories, the Tooltip.Provider requirement, and the Icon wrapper. Load before adding or changing any UI primitive, button, dialog, tooltip, dropdown, card, notice or icon.
---

# shadcn-svelte & Hugeicons

Component index: <https://www.shadcn-svelte.com/llms.txt> — fetch it before
implementing a new primitive. Which part uses which primitive, and every icon
name, is in `docs/design/specs/components.md`; this skill is the _how_.

## Installed primitives

`alert` · `alert-dialog` · `badge` · `breadcrumb` · `button` · `card` ·
`dropdown-menu` · `progress` · `skeleton` · `slider` · `toggle` · `tooltip`

Anything else: `npx shadcn-svelte@latest add <name>` (add `--overwrite`, then
`git checkout` any existing file it replaced, such as `button`). Remove a
primitive once nothing imports it.

## Restyle, don't hand-edit

`ui/` is generated. Restyle through the tokens (`tailwind-theme`) and classes
passed in through `cn()`; reach a primitive's hard-coded children with
descendant variants (`*:data-[slot=…]:`). The only hand edits allowed in `ui/`:

- swapping a primitive's Lucide icon for a Hugeicon (`dropdown-menu`
  radio/checkbox/sub-trigger, `breadcrumb` separator/ellipsis);
- **`buttonVariants`** in `ui/button/button.svelte`, which holds the design's
  buttons.

## Buttons

`buttonVariants` variants: `primary` (tangerine), `ghost` (card), `danger`,
`danger-ghost`, `link` (ink text, 2.5px tangerine underline); plus `default`
(= primary) and `outline` (= ghost), which the generated alert-dialog parts
use. Sizes: `default` 44 tall, `lg` 52, `icon` 44×44, `icon-sm` the round 30px
restore button on a cut marker.

Every button has the hard `0 4px 0` ink shadow and a 4px bottom margin that
reserves it; hover moves it 2px down onto `0 2px 0`. Disabled is dashed and
never faded. Give icon-only buttons an `aria-label`.

## Design parts (`src/lib/components/`)

| Part            | Built on          | Notes                                                          |
| --------------- | ----------------- | -------------------------------------------------------------- |
| `Pill`          | `badge`           | plain · sand · on · off · rec (ink, rec dot, timer)            |
| `Notice`        | `alert`           | success tint, `role="status"`; titled or inline with Dismiss   |
| `ConfirmDialog` | `alert-dialog`    | safe action first and focused; see below                       |
| `StageCard`     | `card`            | in-stage card with the panel shadow; `ProgressCard` on top      |
| `ProgressBar`   | `progress`        | sized by width, not the primitive's translate                   |
| `SkeletonBlock` | `skeleton`        | `rule` block pulsing at 1.4s                                    |
| `ListCard`      | —                 | hairline-divided `<li>` rows, optional pinned footer           |
| `StatusList`    | `ListCard`, `Pill`| capability rows in words                                        |

**ConfirmDialog** renders in place (portal disabled), absolutely over
`AppShell`, which is positioned — like the drawn scrim. It lifts bits'
`contain: layout`, and its Action closes the dialog before calling
`onconfirm` (bits' Action doesn't close it).

## Dock controls

`Recorder/Control/DockControl.svelte` is the split button the three dock
controls share: a toggle (word + icon, `aria-label` naming the action) and a
chevron opening a `DropdownMenu` of `MenuOptions` rows, inside one `Tooltip`.
The pair shares one shadow and presses as one. `off` tone is danger-tint,
`on` success-tint, and a tone keeps its tint when the dock is locked.

## Tooltips and menus

Their classes live in `styles.ts` (`tooltipClass`, `menuClass`,
`menuItemClass`), so the app's floating versions and a story's in-place
versions (bits' `Tooltip.ContentStatic` / `DropdownMenu.ContentStatic`) draw
the same chip and panel. Tooltips have no arrow (`arrowClasses="hidden"`).

`Tooltip` throws without a provider ancestor: the app has one in
`+layout.svelte`; the visual stories' `Sheet` and `ScreenFrame` supply their own.

## Icons

Hugeicons Free (`@hugeicons/core-free-icons`), always through
**`Icon.svelte`**:

```svelte
<Icon icon={Mic01Icon} />            <!-- 20px, buttons -->
<Icon icon={ArrowDown01Icon} size={18} />
```

`Icon` wraps `HugeiconsIcon` at the set's own 1.5 stroke with round joins, as
the design draws them, and remounts when `icon` changes (HugeiconsIcon doesn't
redraw on a new `icon`). Sizes: 20 in buttons, 18 in links and dock chevrons,
22–24 in rows, 48 for the error screen.
