---
name: todo-review
description: Work through the `## Todo` section in README.md and its two lists — `### Bugs` (something already built that doesn't behave as intended) and `### Features` (work not yet built, plus the decisions and chores that go with it). Pick one or more items and plan them together, write a new item into the right list, or prune items that are already done or redundant. Load when the user runs `/todo-review`, or asks to review the todo list, pick up a todo or a bug, add to the features or bugs, or clear out stale ones.
---

# Todo review

`README.md`'s final `## Todo` section holds two lists:

- **`### Bugs`** — something **already built** that doesn't behave as intended.
  Whether a user would notice it or only a developer makes no difference: a
  silent recording and a stale README instruction are both bugs.
- **`### Features`** — work **not yet built**, plus the decisions ("a decision to
  make, not a commitment") and project chores that go with it.

The split is built-but-broken versus not-yet-built, not who it is for. This skill
shows the list, then **plans**, **adds** or **prunes**. It never implements —
planning ends at an approved plan. Every mode spans both lists and leaves both `###`
headings in place, even empty.

Inside each list, related items sit under a `####` **theme heading** — "Editor",
"Capture", "Deployment". The themes are part of
the shape: an item goes under the theme it belongs to, a new theme is added only when
nothing existing fits, and a theme emptied by a removal goes with it. The `###`
headings always stay.

## 1 — Read and show the list

Each top-level `- [ ]` bullet is one item. Continuations are indented six spaces,
and some items carry sub-bullets at four — all of that belongs to the parent item,
not to a new one. (Prettier wraps Markdown at 80 columns, so don't hand-wrap —
`npx prettier --write README.md` does it.) Number items `1..N` **straight through both lists** — Bugs first,
Features continuing — so a number needs no list name. Ignore `- [x]` unless asked.

Print a **digest** under `## Bugs` / `## Features` headings (`(none)` if a list is
empty), each `####` theme as a bold line above its items: per item, a **bold one-line
headline**, then two to four plain sentences on what exists and what falls short,
then — only where the item has one — `_Fix:_`, `_Out of scope:_`,
`**Open decision:**`, `_Depends on:_ <number>`. Prefer plain words to identifiers.

- **Flag work in flight** — uncommitted files or a branch named after an item mean
  it's partly underway; say so on that item.
- **Close with natural groupings** — one line on which items would plan well together
  and why (shared files, a dependency), across lists if they fit. Adjacent numbers
  are a hint only, and only within a list: two items either side of the
  Bugs/Features boundary are neighbours by accident.

Then ask with AskUserQuestion (header `Mode`): **Plan item(s)**, **Add an item**, or
**Prune the list**.

## 2a — Plan item(s)

**Choosing.** Ask for a number, or several (`3, 7`) — the list outgrows
AskUserQuestion's four options. An argument skips both questions: a number, a list or
range (`3,7` / `3 7` / `2-4`, deduped, planned in list order), or a description (match
it and confirm; list every match if several). Numbers outside `1..N` are a typo — say
which and ask again.

**Unrelated selection?** Say once that it will read as separate workstreams and offer
to plan separately; accept the answer. A bug and a feature in one area are a natural
pair — undoing deleted frames and a quick trim both live in the Editor's cut model.

**Before plan mode:** re-read each item's full text (it names files, lines, and what
already exists). With several items, find **overlap** (one shared edit), **ordering**
(one unblocks or moots another) and **conflict** (ask which wins). Load the matching
project skills from the CLAUDE.md index.

**Name the session** — hand over one pasteable line and carry on without waiting:

```
/rename Editor undo deletes + quick trim
```

About 40 characters, sentence case, describing the work — no item numbers, no `Todo`
prefix. For several items, name what they share.

**Name the branch** under `branch-and-commit`'s rules (Bugs → `bug/`, Features →
`feature/`) and write it into the plan.

**`EnterPlanMode`**, then: verify every cited path and claim against the code — report
and drop a stale item rather than planning on it (re-emit `/rename` if that changes the
name); explore the surrounding patterns; ask AskUserQuestion only on forks the code
can't settle.

**The plan** is one plan organised by the work — shared groundwork first — with each
step traceable to its item. It covers:

- **first step:** cut the branch off `develop` (`branch-and-commit`)
- what the user will see afterwards — as ASCII wireframes for any visible change,
  approved before the plan (`ascii-wireframes`) — and the files touched and what
  changes in each
- the CLAUDE.md rules it brushes against, and the tests (`testing`): a node spec in
  `tests/` for any new pure logic (`editorMath`, `utils`, `titles`), a story for any
  new or changed component, and `tests/crashStore.spec.ts` whenever OPFS recovery
  changes
- what's **out of scope** — each item's own fence still binds when planned with others
- **last step:** remove each completed item from its list and run
  `npx prettier --write README.md`

`ExitPlanMode`. Once approved, load `branch-and-commit` and cut the branch **before any
edit**.

**Closing the loop** is part of the work. Delete each finished item (with its
sub-bullets), and the `####` theme with it if that emptied one. A partly done item is
rewritten down to its remainder — and moved if the remainder now belongs in the other
list. Report the removals with the change. Then load `branch-and-commit` again to stage
and commit, ending the message with `Closes the "<item>" todo.` for each finished item.

## 2b — Add an item

Take the description (argument, or ask). **Investigate first**: the premise is often
half-built or different from how it looked. Write what the code says, and say so plainly
if the request's premise was wrong.

**Pick the list** by whether the thing exists yet, and say which and why. Something
built that misbehaves is a Bug however small its audience — a README step that no
longer matches the deploy workflow is a Bug, because the docs exist and mislead. Something that has
never existed is a Feature, chores and open decisions included. Split an item whose
broken half and unbuilt half could ship apart; if they can't, file it where the bulk
lands and note the rest. Ask if it's a genuine coin-flip.

House style, matching the existing entries:

- opens with an imperative — "Fix…", "Add…", "Style…", "Ship…", "Decide…", "Consider…"
- states **what exists** and **what's missing** ("the processor is created on first
  toggle, but nothing shows while the model and WASM download")
- cites files and symbols in backticks (`blurProcessor.ts`, `BlurControl.svelte`)
- names the fix when known, and fences the scope if it could read bigger than it is
  ("restores deleted frames only — not a general undo history")
- uses sub-bullets only for genuinely separate parts; plain tone — a note to a future
  reader, not a ticket

Write it under the right `####` theme in the right list — adding the theme only if
nothing existing fits — then run `npx prettier --write README.md`. Show it and name the
list and theme; if the user disagrees, just move it.

**No branch, no commit** — edit README in place and leave it for the user.

## 2c — Prune the list

Default scope is both lists; the user may name items (`/todo-review prune 3,7`) or a
list (`prune the bugs`). A named item is still only a candidate.

Check every candidate **against the code**, never memory. Remove only on evidence:

- **Done** — the files it names show the described state is now current.
- **Obsolete** — its target is gone, or a later decision (CLAUDE.md, a skill, another
  item) ruled it out; cite where.
- **Redundant** — another item covers it; say which. Compare **across** lists — a
  missing feature and the defect in its half-built predecessor are the commonest
  duplicate. Partial overlap usually means merging into the fuller entry.

Age and size are not reasons, and a "Decide whether…" item is doing its job until the
user rules on it. A **misfiled** item is live — offer to move it, don't prune it. Bugs
rot fastest (they get fixed in passing), but hold them to the same bar.

**Report before removing**: each candidate's number, reason and evidence (file and
line). The user decides item by item — AskUserQuestion with `multiSelect` for up to
four, otherwise a reply with numbers ("all", "none", `2, 5`). Confirm back any
selection that differs from your proposal. Nothing qualifies? Say so and change nothing.

Delete the confirmed items in full, drop any `####` theme that emptied, run
`npx prettier --write README.md` once, and show both lists renumbered — without
re-sorting the survivors. **No branch, no commit.**
