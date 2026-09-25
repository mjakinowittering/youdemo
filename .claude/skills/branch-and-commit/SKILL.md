---
name: branch-and-commit
description: How work is branched, committed, pushed and turned into a PR in this repo — a branch cut off `develop` as the first step of an approved plan, a short imperative subject plus a bulleted commit body, and a PR offered into `develop` (never `master`) once a branch is pushed. Load before creating a branch, staging or writing a commit message, or pushing / running `gh pr create`.
---

# Branch and commit

Reload this skill at each step rather than working from memory of an earlier load.

## Branch — before the first edit

Cut it **right after a plan is approved**, before any file is touched — off an
up-to-date `develop`, never `master` or whatever is checked out:

```
git switch develop && git pull --ff-only && git switch -c <prefix>/<description>
```

**Every plan starts from `develop` — never stack a branch on another.** If the
previous plan's branch is still checked out or unmerged, switch back to `develop`
anyway. If the new plan needs that unmerged work, stop and ask — its PR should merge
into `develop` first.

- **Prefix** — `bug/` for something already built that doesn't behave as intended,
  whether a user or only a developer would notice; `feature/` for work not yet
  built, plus the decisions and chores that go with it. From a README Todo item the
  **list decides**: `### Bugs` → `bug/`, `### Features` → `feature/`; a selection
  spanning both takes `feature/`.
- **Description** — kebab-case, 5–8 words, subsystem + change. No item numbers or
  ticket refs. One branch per plan.
- **Check `git status` first.** Unrelated uncommitted work is the user's call — ask
  rather than carrying it along. Stay on the current branch only when resuming the
  same plan; a new plan always gets a new branch.
- **No plan, no branch.** A README Todo or docs edit the user asked for directly stays
  on the current branch, uncommitted.

```
bug/blur-assets-404-under-pages-base
feature/export-filename-pattern
```

## Commit — last

Only once the work is done and `npm run check`, `npm test` and `npm run lint` pass. A
failure already recorded under README `### Bugs` doesn't block, but name it in the
handover; any other failure does.

- **Stage the work's own files by path**, then show `git status --short`. Use
  `git add -A` only when nothing else is uncommitted; name anything left unstaged.
- **Hand the message over** — the user commits unless they ask you to. If you commit,
  end with the `Co-Authored-By` trailer. There is no git pre-commit hook. Claude's
  PostToolUse hook runs `npm run format` after every edit, but only `npm run lint`
  runs ESLint and catches files edited outside Claude — it is on you to have run it.

The message: a short imperative subject, a blank line, a bulleted body.

```
Name exports youdemo-YYYY-MM-DD-HHMMSS.webm in local time

- Moves filename building out of Done.svelte into exportFilename()
  in utils.ts, so it is pure and unit-tested in tests/utils.spec.ts
- Uses local time rather than UTC so the stamp matches the clock
  the user sees when they download
- Adds seconds, so two exports on the same day no longer collide
```

- **Subject** — sentence case, under 72 chars, no full stop; says what changed and
  where. It describes the work that landed, not an item's title.
- **Body** — 3–6 bullets wrapped at 72 (continuations indented two spaces), no full
  stops, no nesting. Lead with the change; add the _why_ the diff can't show. Skip the
  body only when the subject is the whole story.
- From a Todo item, end with `Closes the "<item title>" todo.`

## Push and PR

Push only when asked: `git push -u origin <branch>`. Then **offer** a PR into
`develop` once — "Pushed `<branch>`. Open a PR into `develop`?" — and wait (skip the
offer if the user already asked for the PR).

GitHub's default branch is `master`, so **always pass `--base develop`**:

```
gh pr create --base develop --head <branch> --title "<subject>" --body "<bullets>"
```

Use the commit subject as the title and its bullets as the body, ending with the
`🤖 Generated with [Claude Code]` line. Print `#<n> → develop: <url>` afterwards so a
wrong base shows at once; fix one with `gh pr edit <n> --base develop`. `master` is a
valid base only when the user says so.

Never merge, rebase, squash, amend or rewrite published history on the user's behalf.
