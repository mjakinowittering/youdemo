# Storage Key Audit

Audit all `localStorage` and `sessionStorage` keys in this project for naming convention compliance, then offer to fix any violations.

## Convention

Every storage key must:
- Start with the prefix `yd`
- Be followed immediately by a capital letter
- Use camelCase throughout — no underscores, hyphens, or other separators

Valid examples: `ydTheme`, `ydWelcomed`, `ydWebcamDeviceId`

Invalid examples: `theme`, `youdemo_welcomed`, `screencast_webcamDeviceId`, `yd_theme`, `ydtheme`

## Steps

1. Grep `src/` for every `localStorage` and `sessionStorage` call — both `.getItem`, `.setItem`, `.removeItem`, and `.key`.
2. Also grep for any `const` or `let` variables whose name contains `STORAGE`, `KEY`, or `STORAGE_KEY` that are then passed to storage calls — resolve these to their string values.
3. Collect every unique key string used, noting the file path and line number for each occurrence.
4. Check each key against the convention regex: `/^yd[A-Z][a-zA-Z0-9]*$/`
5. Output two sections:
   - **Passing** — keys that already comply (file, line, key)
   - **Failing** — keys that violate the convention (file, line, current key, suggested replacement)
   - For the suggested replacement: strip any existing prefix (`yd`, `youdemo`, `screencast`, etc.) and separators, then re-capitalise as camelCase and prepend `yd`.
6. If there are violations, ask the user whether to fix them automatically.
7. If the user confirms, apply the renames:
   - Update every call site in `src/`
   - Update any constant declarations (e.g. `const STORAGE_KEY = '...'`)
   - Search CLAUDE.md for the old key strings and update those references too
8. Run `svelte-autofixer` on any `.svelte` files that were modified.
9. Report every file changed.
