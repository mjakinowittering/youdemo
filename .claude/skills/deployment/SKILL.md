---
name: deployment
description: Building and shipping YouDemo to GitHub Pages — adapter-static config, the BASE_PATH/base-path rules, prerendering, the deploy workflow, static assets, and the meta/OpenGraph/Twitter Card tags in app.html. Load when changing the build, the workflow, asset paths, social preview tags, or debugging anything that works locally but 404s on Pages.
---

# Build & deployment

Static site, no backend, no SSR, hosted on GitHub Pages at
<https://mjakinowittering.github.io/youdemo/>.

## Configuration

`svelte.config.js`:

- `@sveltejs/adapter-static` with `fallback: '404.html'`
- `paths.base` from `process.env.BASE_PATH ?? ''`
- `compilerOptions.runes: true` for everything outside `node_modules`

`src/routes/+layout.ts`:

```ts
export const ssr = false;
export const prerender = true;
```

`prerender` matters — without it the root emits no `index.html` and Pages serves
a 404 for `/`.

## The base path rule

Pages serves the app from `/youdemo/`, not `/`. **Any runtime URL must go through
SvelteKit's `base`**, imported from `$app/paths`. `+page.svelte` passes it into
`createBlurProcessor` for exactly this reason — see `background-blur`.

A hard-coded absolute path works locally and 404s in production. That's the first
thing to check for a "works in dev" asset bug.

## Commands

| Command                | Effect                                                    |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                           |
| `npm run build`        | → `build/`, then runs `postbuild`                         |
| `npm run postbuild`    | `scripts/copy-mediapipe-wasm.js`                          |
| `npm run preview`      | serve the built output                                    |
| `npm run check`        | `svelte-kit sync` + `svelte-check`                        |
| `npm run lint`         | `prettier --check .` + `eslint .`                         |
| `npm run format`       | `prettier --write .` (also runs on every file write hook)  |

## Static assets

`static/` is copied verbatim to the build root:

- `robots.txt` — allows everything
- `youdemo.png` — the 2400×1260 social preview image
- `mediapipe/models/selfie_segmenter.tflite` — committed (244KB)

MediaPipe **WASM** is not committed; it is vendored at build time by `postbuild`
and served by a dev-only Vite middleware. Both paths are described in
`background-blur` — a new vendored asset needs updating in both places.

## Workflows

`.github/workflows/build-and-deploy.yml` — on push to `master` (and
`workflow_dispatch`). Configure Pages → install → `npm run check` → `npm test` →
`npm run build` with `BASE_PATH` from `configure-pages` → upload → deploy.
Concurrency group `pages` with `cancel-in-progress: false`.

`.github/workflows/ci.yml` — PR-only lint/check/test. See `testing`; its trigger
choice is deliberate and documented in the file.

Both cache `~/.npm` keyed on `package-lock.json` and cache Playwright Chromium.

## meta / OpenGraph (`src/app.html`)

`<html lang="en" class="dark">` — dark is the default theme, applied before any JS
runs so there's no flash. `+layout.svelte` then reconciles it with `ydTheme`.

The head carries a `description` plus a full social-preview set:

- `og:title`, `og:description`, `og:type`, `og:url`
- `og:image` (absolute URL to `youdemo.png`), `og:image:width` (2400),
  `og:image:height` (1260), `og:image:alt`
- `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`,
  `twitter:image`

The image URLs are **absolute** — required by crawlers, and the reason they're not
built from `base`. If the site ever moves, update all of them together with
`og:url`. The description text is duplicated across `description`,
`og:description`, `twitter:description` and the WelcomeModal body copy; keep them
in sync.

`<title>YouDemo</title>` in `app.html` is only the pre-hydration default —
`+page.svelte` owns the live title. See `app-shell`.
