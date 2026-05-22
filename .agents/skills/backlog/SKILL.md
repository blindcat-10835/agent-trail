---
name: backlog
description: Manage the project's tactical work-item backlog under `docs/backlog/` — add new items, list/filter active items by status or priority, show full details, update status or priority, and archive done items into `_done/<version>/` at release time. Use this skill whenever the user wants to capture a bug/refactor/feature idea, check what's outstanding ("what's left in v1?", "what bugs are open?", "show me all p0/p1 work"), update an item's status, or otherwise interact with the backlog. Also use when the user says "/backlog", "加到 backlog", "记一下这个 bug", "看看 backlog", "what's in the backlog", or after fixing/shipping something to mark it done. Read `docs/backlog/README.md` once at the start of any session to load the current schema.
---

# Backlog Workflow

Tactical work items live in `docs/backlog/` as one markdown file per item, with YAML frontmatter for machine-readable fields. The slug (filename minus `.md`) is the stable ID.

Read `docs/backlog/README.md` once per session — it has the canonical schema and status semantics. The notes below are about *how* to operate on items, not what they look like.

## Sub-actions

This skill exposes five sub-actions. Detect intent from the user's phrasing; if ambiguous, ask which one.

- **`add`** — capture a new item from a natural-language description
- **`list`** — show outstanding items, grouped or filtered
- **`show <slug>`** — print one item in full
- **`update <slug>`** — change frontmatter fields (status, priority, type, title)
- **`archive <version>`** — move all `status: done` items to `_done/<version>/` (called by `/ship-release`; rarely invoked directly)

---

## Action: add

Goal: capture a new item with minimum friction. The user is usually describing a problem mid-conversation — don't make them fill out a form.

### Step 1 — Extract the essentials from what the user said

From the user's prompt, infer:

- **`type`** — feat (new capability), fix (bug), refactor (restructure without behavior change), chore (deps/build/CI), docs
- **`title`** — short, English, title case. If the user spoke Chinese, translate the title to English (the body can stay in whatever language they used)
- **`priority`** — guess from urgency cues ("生产挂了" → p0, "什么时候有空" → p3); default p2
- **`slug`** — derived from title, kebab-case, 2-4 words

If the type or priority is genuinely unclear, ask one focused question. Don't ask for everything; default reasonable values.

### Step 2 — Check for duplicates

Before writing, check whether a similar item exists:

```bash
ls docs/backlog/*.md | xargs grep -l '<keyword>' 2>/dev/null
```

If something close already exists, tell the user and ask: append to existing, or create new anyway?

### Step 3 — Write the file

Use the schema from `docs/backlog/README.md`. Fill in:

- Required frontmatter: `type`, `title`, `status: todo`, `priority`, `created: <today>`
- Empty `branch:` / `worktree:` (populated later by `/worktree-flow`)
- Body sections: at minimum `## Description`. Add `## Acceptance criteria` if you can plausibly write 2-3 checkboxes from the user's description; otherwise leave it for them to flesh out later.

Use today's date in `YYYY-MM-DD` format. The user's environment provides today's date.

### Step 4 — Report

One line: "Added `docs/backlog/<slug>.md` (type, priority). To start work: `/worktree-flow new <slug>`."

Don't preview the whole file — the user can read the file if they want to.

---

## Action: list

Goal: show what's outstanding at a glance. Default view is grouped by status, sorted by priority within group.

### Step 1 — Collect

```bash
ls docs/backlog/*.md
```

For each file, parse frontmatter — at minimum: `type`, `title`, `status`, `priority`, `branch`. Treat `_done/` and `README.md` as out of scope (don't include).

A simple parse with `awk`/`grep` works for these fixed fields. If a file's frontmatter is malformed, surface it as a warning at the end of the listing — don't crash.

### Step 2 — Group and format

Default output: a compact table or grouped list. Aim for one line per item; the user is skimming.

```
WIP (1)
  p1  feat       filter-by-project              feat/filter-by-project

TODO — p0 (0)

TODO — p1 (2)
  p1  fix        session-list-search
  p1  refactor   source-labels-centralization

TODO — p2 (3)
  p2  fix        qoder-cost-extraction
  p2  fix        qoder-updated-time
  p2  refactor   package-size-optimization

REVIEW (0)
DONE — pending archive (0)
```

Skip empty sections only when listing the full backlog; if the user filtered explicitly (`/backlog list --priority p0`), show "(none)" for transparency.

### Step 3 — Filters

Honor common filters from natural language:

- by status: "show wip" / "what's todo" / "any done items pending archive"
- by priority: "p0 only" / "high priority"
- by type: "bugs" / "refactors"
- by source/area: search title + body (`grep -l`)

Multiple filters AND together.

---

## Action: show

```bash
cat docs/backlog/<slug>.md
```

Pretty-print: frontmatter as a small box, then the body markdown. Don't summarize — the user wants the full thing.

If the slug doesn't resolve, suggest near matches:

```bash
ls docs/backlog/ | grep -i <partial>
```

---

## Action: update

Goal: change one or more frontmatter fields. Common transitions:

- `todo → wip` — happens automatically via `/worktree-flow new`, rarely manual
- `wip → review` — manual when implementation is done but not merged
- `review → done` — manual or auto via `/worktree-flow cleanup`
- `* → wontfix` — manual decision; require a reason, add it to the body

### How to edit

Use the `Edit` tool to change frontmatter values in place. Preserve the exact YAML formatting — don't reorder keys or change quoting style.

If transitioning to `wontfix`, append a `## Why not` section to the body with the user's reason. If they didn't give one, ask.

If transitioning to `done` manually (not via worktree-flow), prompt the user to confirm the linked branch is merged. Don't silently mark things done.

Bump `updated:` field (add it if missing) to today's date on any change.

---

## Action: archive

Goal: move all `status: done` items into `_done/<version>/`. Typically invoked by `/ship-release` after a tag is pushed, or from `/worktree-flow cleanup` when the user opts to archive immediately.

### Step 1 — Confirm the target version

Check what version directories already exist:

```bash
ls docs/backlog/_done/ 2>/dev/null | sort -V
```

Find the latest version (highest semver). Then ask the user:

> "The latest archive directory is `docs/backlog/_done/<latest>/`. Archive done items there, or create a new version?"

Decision tree:
- **User confirms the existing version** — proceed directly with that version.
- **User wants a new version** — ask: "What version? (e.g., `v1.0.3`)" and use the supplied value.
- **No `_done/` directories exist yet** — ask: "No archive versions found yet. What version should I create? (e.g., `v1.0.0`)"

Don't proceed until the version is confirmed — archiving to the wrong directory is annoying to undo.

### Step 2 — Collect and move

```bash
mkdir -p docs/backlog/_done/<version>
```

For each `docs/backlog/*.md` (excluding README) with `status: done`:

```bash
git mv docs/backlog/<slug>.md docs/backlog/_done/<version>/<slug>.md
```

Use `git mv` (not plain `mv`) so the move is tracked cleanly in the release commit.

### Step 3 — Report

Report the count and the version: "Archived 3 items into `docs/backlog/_done/v1.0.8/`."

---

## How this skill interacts with the others

- `/worktree-flow new <slug>` reads a backlog item to derive type + title, then writes back `status: wip` + `branch` + `worktree` fields. If the slug doesn't match a backlog item, worktree-flow falls back to its plain `<type> <desc>` form (no backlog link).
- `/worktree-flow cleanup` detects merged worktrees; for each, if a backlog item links to that branch, set its `status` to `done` (but don't archive yet — that's release time).
- `/ship-release` lists `status: done` items in the release notes "Closed" section, then calls this skill's `archive` action after tagging.

## When to update items vs not

Update an item when the *outcome* changes (status, priority, scope). Don't churn the file just to reword a sentence — that's noise in git history. If the description is wrong, fix it; if you just thought of more context, add it under a `## Notes` section rather than rewriting Description.

## Anti-patterns to avoid

- **Don't bulk-add items.** If the user dumps a list of 10 ideas, ask which ones are real work items vs brainstorming. The backlog is for committed work, not a wishlist (use a separate doc for that).
- **Don't auto-close items based on commit message keywords** (e.g., "closes #X"). The link is via `branch` field, not commit text — that's more reliable.
- **Don't delete items.** Even if they're stale or duplicate, use `wontfix` with a reason. The file history is useful.
- **Don't move items to `_done/` outside a release.** Active `done` items are a useful signal of "what's queued for the next release."
- **Don't invent priorities.** p0 should be rare; resist the urge to mark everything p1.
