---
name: tailwind-theme
description: Tailwind v4 CSS-first theming for YouDemo — the indigo-500 accent system, red/destructive semantics, theme tokens and custom animations in layout.css, and the dark-mode toggle. Load when styling any component, picking a colour or class, adding an animation, defining a theme token, or touching layout.css / +layout.svelte.
---

# Tailwind v4 theming

**Tailwind utility classes are always preferred over hand-written CSS.**
Configuration is CSS-first — there is no `tailwind.config.js`.

All theme configuration lives in **`src/routes/layout.css`** (not `app.css`),
imported by `src/routes/+layout.svelte`. `.storybook/preview.ts` imports the same
file so stories render with the real tokens.

## Accent colour: indigo-500

`indigo-500` is the primary accent for the entire application.

| Element                     | Class                                          |
| --------------------------- | ---------------------------------------------- |
| Primary action buttons      | `bg-indigo-500 hover:bg-indigo-600 text-white` |
| Active frame cell in Editor | `ring-2 ring-indigo-500 bg-indigo-500/30`      |
| Cut button active state     | `bg-indigo-500 text-white`                     |
| Progress bars               | `accent-indigo-500` or `bg-indigo-500`         |
| Playhead line               | `bg-indigo-500`                                |
| Webcam bubble border        | `border-2 border-indigo-500`                   |
| Countdown number            | `text-indigo-500`                              |
| Play/pause flash icon       | `text-indigo-500`                              |
| MonitorPlay brand icon      | `text-indigo-500`                              |

**Use the literal `indigo-500` utilities — not `bg-primary`.** `layout.css` sets
`--color-primary: #6366f1` early in its `@theme inline` block but reassigns
`--color-primary: var(--primary)` later in the same block, so `bg-primary`
resolves to the shadcn primary (warm near-black in light mode, near-white in
dark), not indigo. Only `--ring` is genuinely indigo — the focus ring.

## Selection / destructive colour: red

When frames are selected for deletion in the Editor, red signals destructive
intent:

| Element              | Class                               |
| -------------------- | ----------------------------------- |
| Selected frame cells | `ring-2 ring-red-500 bg-red-500/20` |
| Delete button        | shadcn `destructive` variant        |

What stays red/destructive: Discard button · Mute button (when muted) · Cam-off
button (when disabled) · Delete button in Editor · selected frames in edit mode ·
REC dot.

## Theme tokens

`layout.css` layers, in order:

1. `@import` — `tailwindcss`, `tw-animate-css`, `shadcn-svelte/tailwind.css`,
   `@fontsource-variable/inter`
2. `@custom-variant dark (&:is(.dark *))` and `@plugin '@tailwindcss/typography'`
3. `:root` — light mode. A **warm "sandy" palette**: neutrals carry a low-chroma
   warm hue (~83) in oklch so surfaces read ivory/beige rather than clinical grey.
4. `.dark` — dark mode, neutral greys.
5. `@theme inline` — maps the CSS custom properties to `--color-*` tokens so
   Tailwind generates the utilities, plus `--font-sans: 'Inter Variable'` and the
   `--radius-*` scale derived from `--radius: 0.625rem`.
6. `@theme` — custom animations (below).
7. `@layer base` — global border/ring, `bg-background text-foreground` on body,
   `font-sans` on html.

There is a non-standard `--success` token (and `--color-success`) alongside the
shadcn defaults; the `success` button variant used by `BlurControl` depends on it.

## Custom animations

Registered as v4 theme tokens so `animate-*` utilities are generated and the
linter recognises them — this is how animation is done here, **not** hand-written
CSS classes:

| Token                | Utility              | Used by                              |
| -------------------- | -------------------- | ------------------------------------ |
| `--animate-ping-once` | `animate-ping-once` | play/pause flash icon                |
| `--animate-rec-pulse` | `animate-rec-pulse` | REC dot                              |
| `--animate-deplete`   | `animate-deplete`   | countdown ring (`stroke-dashoffset`) |

To add one: define `--animate-<name>` plus its `@keyframes` **inside** the
`@theme` block in `layout.css`.

## Dark mode

- Default is dark — `src/app.html` ships `<html lang="en" class="dark">`.
- The toggle lives in the top bar of `src/routes/+layout.svelte` (`Sun`/`Moon`,
  ghost icon button).
- Implementation: `$effect` toggles `class="dark"` on
  `document.documentElement` and writes `localStorage` key **`ydTheme`**
  (`'dark'` | `'light'`). See the `persistence` skill for the key convention.
- In Storybook the theme is driven by the toolbar switcher, which applies `dark`
  to `<html>` — story shells must not hard-code a `dark` class. See `testing`.

## No hand-written CSS

Never write raw CSS when a Tailwind class exists. The only acceptable exceptions:

- `@theme` / `:root` / `.dark` token definitions in `layout.css`
- SVG-specific properties with no Tailwind equivalent
