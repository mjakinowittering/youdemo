# Brand files: favicon, app icons, Open Graph image

The V2 favicon is a play button in the same family as matthewakinowittering's
site icon: card tile, 1.5px ink outline at 32px, a hard ink shadow down and
right, and one tangerine element (the play triangle). The canvas's V2 Brand page
holds the source boards: Favicon options (B chosen), Favicon sizes, App icon and
Open Graph.

| File                           | Size            | Where it goes                                 | Notes                                                                                                            |
| ------------------------------ | --------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `favicon.svg`                  | 16-unit drawing | `src/lib/assets/favicon.svg` (replace)        | The tab icon. Drawn on a 16-unit grid with whole-pixel edges, so it's crisp at 16 and 32 device px.              |
| `icon.svg`                     | 64-unit drawing | keep beside it as the source for larger sizes | Tile and shadow span 3.5–60.5, centred.                                                                          |
| `favicon.ico`                  | 16, 32, 48      | `static/favicon.ico`                          | PNG entries: 16 and 32 from `favicon.svg`, 48 from `icon.svg`. For browsers and tools that ask for /favicon.ico. |
| `favicon-32.png`               | 32              | `static/favicon-32.png`                       |                                                                                                                  |
| `apple-touch-icon.png`         | 180             | `static/apple-touch-icon.png`                 | `icon.svg` at 80% on solid `base` #f8f5ef, so iOS's rounded mask never clips the outline.                        |
| `icon-192.png`, `icon-512.png` | 192, 512        | `static/`                                     | Same treatment, for a web manifest if one is added.                                                              |
| `og-image.png`                 | 2400×1260       | `static/youdemo.png` (replace)                | The Open Graph board at 2×, as the current image is.                                                             |
| `og-image.html`                | 1200×630        | reference only                                | Standalone mark-up of the board. Uses `fonts/`.                                                                  |

Colours are hard-coded hex inside the SVGs (favicon files can't read CSS
variables): ink #17151f, card #fdfbf7, accent #f07a2e.

## Head tags

`src/routes/+layout.svelte` already imports `$lib/assets/favicon.svg` and emits
`<link rel="icon" href={favicon} />`. Keep that, add `type="image/svg+xml"` to
it, and add the other two to `src/app.html`'s `<head>`:

```html
<link rel="icon" href="%sveltekit.assets%/favicon.ico" sizes="32x32" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png" />
```

The Open Graph tags stay as they are (same URL, 2400×1260), except the alt text,
which now matches the image: `YouDemo: Record. Trim. Export.` Also remove
`class="dark"` from `<html>` (journey.md, Header).

## What changed on the Open Graph image

The small card with REC and Stop recording showed the floating control, which
was dropped. It's replaced by the Exported notice ("Exported. Saved to your
downloads."), which matches "Export." in the headline.
