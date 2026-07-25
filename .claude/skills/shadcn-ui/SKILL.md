---
name: shadcn-ui
description: shadcn-svelte and lucide conventions for YouDemo — which primitives are installed, the Empty component for every empty state, the Tooltip.Provider requirement, the clickable-card pattern, and button/dropdown combo composition. Load before adding or changing any UI primitive, empty state, tooltip, dropdown, card, or icon.
---

# shadcn-svelte & lucide

Component index: <https://www.shadcn-svelte.com/llms.txt> — **fetch this before
implementing any shadcn component.** Components are used as-is with no
customisation; anything under `src/lib/components/ui/` is generated and should
not be hand-edited.

## Installed primitives

`alert` · `badge` · `button` · `card` · `dialog` · `dropdown-menu` · `empty` ·
`progress` · `separator` · `tooltip`

Anything else needs `npx shadcn-svelte@latest add <name>` first. (`Toggle` is
**not** installed despite older docs listing it.)

## Empty — every empty state

The shadcn `Empty` component is used for **all** empty states throughout the app:
Setup's pre-capture state, Recording's in-progress state, BrowserCheck's failure
state. Consult <https://www.shadcn-svelte.com/docs/components/empty> before
implementing one.

The house pattern is a 2x-size lucide icon in `Empty.Media`, a title/description,
and the screen's **primary CTA centred inside the Empty** — not tucked into a
footer corner. Setup's "Start Recording" and Recording's "Stop Recording" both
follow this.

## Tooltip.Provider

`Tooltip` throws without a provider ancestor. The app supplies one in
`src/routes/+layout.svelte`, wrapping the whole shell. Any **story** rendering a
component that uses tooltips must add its own — see the `testing` skill.

## Clickable cards (Review screen)

`onclick` goes on `Card.Root` itself, with `role="button"`, `tabindex={0}` and an
Enter/Space `onkeydown` handler. The footer "button" is a **`<div>` styled with
`buttonVariants(...)` plus `pointer-events-none`** — purely visual.

This deliberately replaced the stretched-overlay pattern (`<span class="absolute
inset-0">` inside a real `Button`), which caused stacking/pointer issues. Do not
reintroduce it. See `src/lib/components/Recorder/Review.svelte`.

Hover/focus affordance is a ring, not a background:
`ring-2 ring-foreground/25 ring-offset-4` with `hover:ring-indigo-500`
(or `hover:ring-destructive` for the destructive card).

## Button + chevron combo (Mic / Cam / Blur controls)

The capture controls share one composition, worth copying if another is added:

- A `Button` (`size="lg"`, `class="rounded-r-none border-r-0"`) that toggles state
  on click, with an `aria-label` describing the **action**, not the state.
- A sibling `DropdownMenu.Trigger` styled via
  `cn(buttonVariants({ variant, size: 'lg' }), 'rounded-l-none px-2')` holding a
  `ChevronDown` — so the trigger looks like the right half of one control.
- Both share the same `$derived` `variant` and the same `disabled` value.
- The pair is wrapped in a `Tooltip.Root` whose `Tooltip.Trigger` uses the
  `{#snippet child({ props })}` form around a `<div {...props} class="flex">`.
- Options are a `DropdownMenu.RadioGroup` + `RadioItem`s.

See `src/lib/components/Recorder/Control/BlurControl.svelte` for the reference
implementation and the `capture-screens` skill for each control's variant table.

## Utilities

- `cn()` from `$lib/utils.js` for conditional class merging.
- `buttonVariants` and the `ButtonVariant` type are exported from
  `$lib/components/ui/button/button.svelte` — use them to style a non-`<button>`
  element as a button.
- Variants in use: `outline`, `destructive`, `ghost`, `success`. `success` is a
  local addition backed by the `--success` token in `layout.css`.

## Icons

**`@lucide/svelte` only.** The older `lucide-svelte` package has been removed —
do not reintroduce it, and do not use the root named-export form.

Import one icon per line by **deep path**, with the kebab-case filename:

```ts
import MonitorPlay from '@lucide/svelte/icons/monitor-play';
import Trash2 from '@lucide/svelte/icons/trash-2';
```

This is what `shadcn-svelte` generates into `ui/*` and what the whole app uses.
Deep paths keep dev builds fast — the root export pulls in the entire icon set.

The filename is the icon's kebab-case name, which is not always a mechanical
transform of the PascalCase component (`Trash2` → `trash-2`,
`CircleUserRound` → `circle-user-round`). Check
`node_modules/@lucide/svelte/dist/icons/` if unsure.

Size via the `size={20}` prop or a `class="size-4"` utility.
