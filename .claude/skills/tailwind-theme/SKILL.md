---
name: tailwind-theme
description: Tailwind v4 CSS-first theming for YouDemo's V2 design — the yd- design tokens (colour, type, shadows, radii) in layout.css, how shadcn's variables map onto them, the tangerine accent and danger semantics, the button press and other motion, and why cn() knows the custom utilities. Load when styling any component, picking a colour, type style or class, adding an animation, defining a token, or touching layout.css.
---

# Tailwind v4 theming

**Tailwind utility classes are always preferred over hand-written CSS.**
Configuration is CSS-first — there is no `tailwind.config.js`. Everything lives
in **`src/routes/layout.css`**, imported by `+layout.svelte` and by
`.storybook/preview.ts` so stories render with the real tokens.

The values come from the approved design: `docs/design/specs/foundations.md`
(how to use them) and `docs/design/tokens.json`. **Light only**; dark mode is
later, separate work. Where a board's `.html` and a token disagree, the board
wins — read exact values from the board, never estimate from the PNG.

## Tokens (`@theme static`)

Prefixed `yd-` so they never collide with shadcn's own `card`, `muted` and
`accent`. `static` emits every variable so the shadcn mapping can point at them.

| Kind    | Utilities                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------- |
| Colour  | `yd-base` page/bands · `yd-sand` the stage · `yd-card` raised surfaces · `yd-ink` text, outlines, shadows · `yd-muted` body copy · `yd-rule` skeletons · `yd-hairline` dividers in a card · `yd-accent` tangerine · `yd-accent-tint` · `yd-danger` · `yd-danger-tint` · `yd-success-tint` · `yd-rec` the REC dot · `yd-scrim` |
| Type    | `text-display` 40 · `text-screen` 28 · `text-dialog` 22 · `text-row` 19 · `text-lead` 18.5 · `text-body` 16 · `text-button` 15 · `text-small` 14 · `text-meta` 12.5 · `text-pill` 12 · `text-wordmark` 19 (each carries its line height, and weight/tracking where the design sets them) |
| Shadow  | `shadow-offset` (0 4px 0) · `shadow-offset-sm` · `shadow-offset-press` (0 2px 0) · `shadow-panel` (8px 8px 0) · `shadow-bubble` (4px 4px 0) — all hard ink, never blurred |
| Radius  | `rounded-frame` 8 · `rounded-control` 10 · `rounded-notice` 14 · `rounded-card` 16 · `rounded-panel` 20 |
| Font    | `font-sans` Figtree Variable · `font-mono` system monospace (Technical details only) |

Headings using `text-screen` or `text-display` also take **`text-balance`**, as
the design's do. The root sets `tabular-nums`.

## Colour rules

- **Tangerine (`yd-accent`) is the one accent and is never text** (2.6:1 on
  base). Primary fills, progress fills, the countdown arc, the overview window
  edge, link underlines. Text on it is ink.
- **Danger signals destruction**: Stop, Discard, Remove, cut markers, frames
  marked for removal, off toggles (`danger-tint` ground, `danger` text).
- Every raised surface is `yd-card` outlined in 1.5px `yd-ink`.
- Disabled is never faded: `base` fill, dashed `muted` outline, `muted` text,
  no shadow (built into `buttonVariants`; see `shadcn-ui`).

## shadcn's variables

`:root` points shadcn's variables at the tokens so the primitives pick the
palette up: `--background` → base, `--foreground` → ink, `--card`/`--popover`
→ card, `--primary` → accent (foreground ink), `--destructive` → danger,
`--border`/`--input`/`--ring` → ink, `--muted-foreground` → muted, `--accent` →
accent-tint. Prefer the `yd-` utilities in new markup.

## `cn()` and `tv` know the custom utilities

`src/lib/utils.ts` extends tailwind-merge with the type, shadow and radius
names. Without it `text-button` reads as a colour and is dropped beside
`text-yd-ink`. Restyle primitives through `cn()` (or the shared `tv`), never by
concatenating class strings.

## Custom animations

Registered as theme tokens so `animate-*` utilities exist — not CSS classes:

| Token                 | Used by                                                    |
| --------------------- | ---------------------------------------------------------- |
| `--animate-skeleton`  | skeleton blocks and frames (opacity 1 → 0.55, 1.4s)         |
| `--animate-drain`     | the countdown arc, from `--from` to `--to` per second       |
| `--animate-ping-once` | the play/pause flash on the Editor's video                  |
| `--animate-pinwheel` / `-slow` | the joining and exporting spinner (1.6s a turn; 3.2s) |

Everything stops under `prefers-reduced-motion` (`motion-reduce:animate-none`,
`motion-reduce:transition-none`), except the spinner, which slows to
`animate-pinwheel-slow` so a long job still reads as running. The 200ms footer swap in trim mode is a Svelte
`fly` with zero duration under reduced motion.

To add one: define `--animate-<name>` plus its `@keyframes` inside the `@theme`
block.

## Pixel-exact gotchas

These came out of matching the boards with `npm run compare` (see `testing`):

- A `<button>`'s figures are proportional in the design (its `font` shorthand
  resets them), so buttons carry `normal-nums`; a link-style button's line
  height is the browser's `normal` (`leading-[normal]`, not `leading-normal`).
- Chrome draws 1.5px borders as 1px at 1×, so a box drawn inside one (a
  thumbnail, a preview) is sized explicitly as the board does, not `size-full`.
- `position: fixed` and `contain: layout` both repaint an element on its own
  pixel grid; anything at a fractional position then lands a pixel off.
