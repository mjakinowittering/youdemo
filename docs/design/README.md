# YouDemo V2 design

The approved V2 design: how YouDemo looks and works after the redesign.

| Path                   | What it is                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference/`           | The boards: a `.png` and a standalone `.html` for every screen state and every component, plus `manifest.json`. **The source of truth for how it looks.** |
| `specs/foundations.md` | Colour, type, shape, controls, icons, motion, and how they map to Tailwind and shadcn                                                                     |
| `specs/journey.md`     | What changes in how the app works, screen by screen, with checks and the decisions taken                                                                  |
| `specs/screens.md`     | How each screen is assembled, band by band                                                                                                                |
| `specs/components.md`  | Every part, the shadcn primitive under it, and the Hugeicons it uses                                                                                      |
| `brand/`               | Favicon, app icons and the Open Graph image, ready to drop in, with where each goes (`brand/README.md`)                                                   |
| `tokens.json`          | The design tokens (from the YouDemo design system artifact)                                                                                               |

Precedence when they disagree: the reference boards, then `journey.md`, then the
other specs, then CLAUDE.md's existing conventions.

## Visual testing

`npm run compare` builds Storybook, opens every story the manifest names at the
board's size, and diffs it against the board's `.html` rendered on the same
machine (and against the exported `.png`). Output lands in `.compare/`: the
build's screenshot, a side-by-side, and a diff per board and per section, plus
`report.json`. It exits non-zero when any board or section differs by more than
0.1% (`COMPARE_MAX` overrides) or a story is missing.

The working loop for each screen or component:

1. Build or change the component until it renders the board's state from props.
2. Write its `Visual/Screens/<Name>` or `Visual/Components/<Name>` story, with
   one `data-compare="root"` element, its `data-section` bands and
   `data-compare-mask` on media (see `reference/README.md`).
3. `npm run compare -- <name>` and open `.compare/<name>-side.png`.
4. Fix and repeat until `vsHtml` is 0.00 for the board and every section.

## Status

- Light theme only; dark mode is separate, later work.
- The floating capture control was explored and dropped.
- Favicon, app icons and Open Graph image: see `brand/`.
