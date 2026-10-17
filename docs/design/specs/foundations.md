# Foundations

V2 is drawn in Matthew Akino-Wittering's own design language: a calm warm page,
everything raised outlined in ink and sitting on a hard ink edge, one tangerine
accent. **Light is the only theme for now.** Dark mode is a separate, later
piece of work.

Exact values live in `../tokens.json` and in every reference `.html`. This page
says how to use them.

## Colour

| Token          | Value                    | Use                                                                                                                                           |
| -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`         | `#f8f5ef`                | Page and every band that is not the stage: header, breadcrumb, timeline band, dock band, footer                                               |
| `sand`         | `#f7f0e3`                | The stage: where the screen preview, camera and video sit                                                                                     |
| `card`         | `#fdfbf7`                | Every raised surface: ghost buttons, dock, cards, dialogs, frames. Always outlined in `ink`                                                   |
| `ink`          | `#17151f`                | Headings, labels, button text, every outline and rule, every offset shadow, focus ring, icons                                                 |
| `muted`        | `#46434f`                | Body copy, captions, timecodes, meta                                                                                                          |
| `rule`         | `#e7e3dc`                | Decorative only: skeleton blocks                                                                                                              |
| `hairline`     | `#d9d6e0`                | Decorative only: dividers inside one card                                                                                                     |
| `accent`       | `#f07a2e`                | Tangerine: primary fills, progress fill, countdown arc, overview window edge, link underlines. **Never text**, never the only marker of state |
| `accent-tint`  | `#fde3cf`                | Overview bar's visible window; chosen menu row                                                                                                |
| `danger`       | `#b42318`                | Stop, Discard, Remove, cut markers, frames marked for removal, off toggles. Text-safe                                                         |
| `danger-tint`  | `#fbe4e1`                | Fill behind off toggles and frames marked for removal                                                                                         |
| `success-tint` | `#d8ecd5`                | Fill behind on toggles (Blur on) and the Exported notice                                                                                      |
| `rec`          | `#e5484d`                | The REC dot only                                                                                                                              |
| `scrim`        | `rgba(23, 21, 31, 0.45)` | Behind an alert dialog. No blur                                                                                                               |

Contrast, all measured: ink on base 16.6:1, sand 15.9:1, card 17.5:1, accent
6.5:1, every tint 14.5:1 or more. Muted on base 8.9:1, sand 8.5:1, card 9.3:1.
Danger on base 6.0:1, on danger-tint 5.4:1; card text on danger 6.4:1. Rec on
ink 4.6:1. Accent is 2.6:1 on base, which is why it is never text.

## Type

Figtree (`@fontsource-variable/figtree`) for everything, with tabular figures
(`font-variant-numeric: tabular-nums`) on the root so every number lines up. A
system monospace only inside Technical details.

| Style          | Size / line height | Weight | Tracking | Use                                                   |
| -------------- | ------------------ | ------ | -------- | ----------------------------------------------------- |
| `display`      | 40 / 1.15          | 800    | −0.03em  | Setup's one big heading                               |
| `screen-title` | 28 / 1.2           | 800    | −0.02em  | Every other screen heading (30px on the phone screen) |
| `dialog-title` | 22 / 1.3           | 800    | −0.02em  | Dialog titles, in-stage card titles                   |
| `row`          | 19 / 1.5           | 700    | −0.01em  | Status headings in cards, list rows                   |
| `lead`         | 18.5 / 1.5         | 400    | 0        | Paragraph under a screen title, `muted`               |
| `body`         | 16 / 1.5           | 400    | 0        | Everything else, `muted`                              |
| `button`       | 15 / 1.5           | 600    | 0        | Buttons and links. Large buttons 16 / 700             |
| `small`        | 14 / 1.5           | 400    | 0        | Hints, captions, timecodes                            |
| `meta`         | 12.5 / 1.5         | 700    | 0.06em   | Eyebrows and dialog labels, uppercase, `muted`        |
| `pill-label`   | 12 / 1             | 700    | 0.06em   | Pills, uppercase                                      |
| Wordmark       | 19                 | 800    | −0.02em  | "YouDemo" in the header, `ink`, no icon               |

## Shape and depth

- **Outlines**: 1.5px `ink` on buttons, cards, the dock, pills, video frames,
  timeline frames, dialogs, the progress bar and the overview bar.
- **Rules**: a 1.5px `ink` rule under the header and between every band.
- **Radii**: 10px buttons and video frames; 14px notices, menus, the dialog's
  details list; 16px cards and status lists; 20px the dock and dialogs; 8px
  timeline frames; full for pills, progress and the bubble.
- **Shadows are hard, never blurred**: buttons `0 4px 0 ink`, pressing to
  `0 2px 0 ink` as the button moves 2px down; small round buttons `0 2px 0 ink`;
  things floating over the stage (dialogs, in-stage cards) `8px 8px 0 ink`; the
  webcam bubble `4px 4px 0 ink`.
- **Buttons reserve their shadow**: every button has a 4px bottom margin so the
  shadow never overlaps what's below.

## Controls

- Minimum target 44px. Large buttons 52px.
- **Primary** `accent` fill, ink text. **Ghost** `card` fill. **Danger**
  `danger` fill, `card` text. **Danger ghost** `card` fill, `danger` text.
  **Icon** 44×44 with an `aria-label`. **Link** ink text with a 2.5px `accent`
  underline offset 4px, 4px on hover.
- **Disabled** is `base` fill, dashed `muted` outline, `muted` text, no shadow.
  Never faded with opacity.
- **Pressed toggle** (Trim): `ink` fill, `card` text.
- **Focus**: 2px solid `ink` outline, offset 2px, on everything focusable.

## Icons

Hugeicons Free (`@hugeicons/core-free-icons` with `@hugeicons/svelte`), Stroke
Rounded, stroke 1.5, `currentColor`. 20px in buttons, 18px in links and the dock
chevrons, 22–24px in list rows, 48px for the Error screen's alert. The names
used are listed in `components.md`.

## Motion

Small and functional: the 2px button press; skeletons pulsing (opacity 1 to
0.55, 1.4s); the countdown arc draining once a second; Export and Discard
sliding down and fading (200ms) when trim starts. Everything stops under
`prefers-reduced-motion: reduce`.

## Mapping to Tailwind v4

`layout.css` keeps CLAUDE.md's rule of no hand-written CSS outside `@theme`.
Declare the tokens in `@theme` so they become utilities. Several design names
(`card`, `muted`, `accent`) already mean something else in shadcn (`muted` and
`accent` are shadcn background fills), so give the design tokens their own
prefix to avoid collisions, for example `--color-yd-base`, `--color-yd-sand`,
`--color-yd-card`, `--color-yd-ink`, `--color-yd-muted`, `--color-yd-accent`,
`--color-yd-accent-tint`, `--color-yd-danger`, `--color-yd-danger-tint`,
`--color-yd-success-tint`, `--color-yd-rec`, `--shadow-offset`,
`--shadow-offset-press`, `--shadow-panel`, and the radii. Then point shadcn's
own variables at them so the primitives pick the palette up: `--background` →
base, `--foreground` → ink, `--card` / `--popover` → card, `--primary` →
tangerine with `--primary-foreground` → ink, `--destructive` → danger,
`--border` / `--input` / `--ring` → ink, `--muted-foreground` → muted,
`--accent` (shadcn's hover fill) → accent-tint. Remove the `.dark` block; dark
mode comes back as its own design.
