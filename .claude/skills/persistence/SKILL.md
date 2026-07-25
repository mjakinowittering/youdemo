---
name: persistence
description: Everything YouDemo stores in the browser — OPFS crash recovery via crashStore.ts, the deviceStore rune store, and the full inventory of yd* localStorage keys plus their naming convention. Load when adding or renaming a stored value, changing what survives a reset or reload, or working on crash recovery.
---

# Persistence

There is no backend. Three mechanisms, all best-effort — every one degrades
silently so a locked-down browser still runs the app.

## Storage key convention

Every `localStorage` / `sessionStorage` key must match `/^yd[A-Z][a-zA-Z0-9]*$/` —
`yd` prefix, immediately a capital, camelCase, no separators.

Valid: `ydTheme`, `ydWelcomed`, `ydWebcamDeviceId`.
Invalid: `theme`, `youdemo_welcomed`, `yd_theme`, `ydtheme`.

`/storage-audit` (`.claude/commands/storage-audit.md`) audits and fixes violations.

## Key inventory

| Key                | Written by                            | Value                          |
| ------------------ | ------------------------------------- | ------------------------------ |
| `ydTheme`          | `+layout.svelte`                      | `'dark'` \| `'light'`          |
| `ydWelcomed`       | `WelcomeModal.svelte`                 | `'true'` once dismissed        |
| `ydMicMuted`       | `+page.svelte`                        | `'true'` \| `'false'`          |
| `ydCamEnabled`     | `+page.svelte`                        | `'true'` \| `'false'`          |
| `ydBlurOn`         | `+page.svelte`                        | `'true'` \| `'false'`          |
| `ydBlurIntensity`  | `+page.svelte`                        | `'light'` \| `'default'` \| `'heavy'` |
| `ydWebcamDeviceId` | `deviceStore.svelte.ts`               | device id                      |
| `ydMicDeviceId`    | `deviceStore.svelte.ts`               | device id                      |

Everything here survives a **full reset** — that's the point of persisting it. See
the reset contract in `app-shell`.

Every read and write is wrapped (try/catch, or a `typeof localStorage ===
'undefined'` guard). Follow that pattern; `localStorage` throws in some privacy
modes.

## deviceStore (`src/lib/deviceStore.svelte.ts`)

A Svelte 5 rune store holding **only the selected device ids**:

```ts
deviceStore.webcamDeviceId  // string | null, persisted to ydWebcamDeviceId
deviceStore.micDeviceId     // string | null, persisted to ydMicDeviceId
```

Implemented as module-level `$state` behind getters/setters, so assignment
persists automatically. Read and written by `MicControl` / `CamControl` (see
`capture-screens`) and read by `+page.svelte` when acquiring streams.

**It does not hold `micMuted` or `camEnabled`.** Those, plus `blurOn` and
`blurIntensity`, are `$state` in `+page.svelte` persisted by an `$effect` — that
is where to look or add to.

## Crash recovery (`src/lib/crashStore.ts`)

Persists **every captured take** to the origin-private file system so a whole
recording — not just the last take — survives a tab/renderer crash or an
accidental reload. One file per take, `crash-recording-<index>.webm`, contiguous
indices from 0.

```ts
saveSegment(index, blob)  // write one take
loadSegments()            // read contiguous files back in order as Blob[]
clear()                   // remove all take files
```

`loadSegments()` stops at the first missing **or zero-byte** file, so a
half-written trailing take is dropped rather than corrupting the recovery.
`clear()` likewise walks until a removal fails.

Every call is try/catch-wrapped and returns a safe empty value. If OPFS is
unavailable or quota is exceeded, crash protection is skipped and the app works
normally — never let a storage failure surface to the user.

### Why per-take files

Rather than eagerly maintaining one combined file. Nothing is re-encoded on the
hot path: takes are stitched **once**, at Editor entry (the existing `stitching`
step). Re-stitching the whole recording on every Stop would cost generational
quality loss plus a wait proportional to total length, every time.

### Wiring in `+page.svelte`

| Moment                              | Call                                        |
| ----------------------------------- | ------------------------------------------- |
| Stop (`stopRecording`)              | `saveSegment(segments.length - 1, blob)`    |
| Browser check passes                | `loadSegments()` → if any, jump to Editor   |
| Export completes                    | `clear()`                                   |
| Full reset (`resetToSetup`)         | `clear()`                                   |

Recovery skips setup entirely: recovered takes become `segments` and
`goToEditor()` stitches them if there's more than one. Clearing on export and on
reset is deliberate — the recording has been downloaded or intentionally
discarded, so recovery is no longer wanted.

`tests/crashStore.spec.ts` covers this module.
