---
name: worktree-flow
description: Create and manage feature/fix/refactor branches in isolated git worktrees under `.worktree/`. Use this skill whenever the user starts new work — new features, bug fixes, refactoring, dependency upgrades, doc updates — or asks to "开个分支", "新建 worktree", "branch off", "start work on X", "clean up merged branches", or anything that implies kicking off or wrapping up a unit of work. Also use when the user explicitly invokes `/worktree-flow`.
---

# Branch & Worktree Workflow

This project develops new work in **isolated git worktrees** under `.worktree/`, rather than switching branches in place. Each worktree is a separate working directory tied to its own branch, so the main checkout stays stable for testing, demos, or parallel sessions.

## Why worktrees

- The main checkout can keep running `pnpm dev` while feature work happens elsewhere
- Easy parallel exploration without `git stash` gymnastics
- Each worktree has its own `node_modules`, so dependency experiments don't bleed across branches
- `.worktree/` is gitignored, so the worktrees themselves never get committed

## Branch naming

All branches use a `type/short-description` form. Type comes from conventional commits and signals intent:

| Type       | When to use                                         | Example                       |
| ---------- | --------------------------------------------------- | ----------------------------- |
| `feat`     | New user-facing capability                          | `feat/sse-reconnect`          |
| `fix`      | Bug fix                                             | `fix/turn-replay-scroll`      |
| `refactor` | Restructuring without behavior change               | `refactor/parser-types`       |
| `chore`    | Tooling, deps, config, CI, build                    | `chore/upgrade-next-16`       |
| `docs`     | Documentation only                                  | `docs/api-reference`          |

Description is short kebab-case — 2-4 words, lowercase. Names that read clearly six months later beat clever abbreviations.

## Sub-actions

This skill handles three actions. Detect intent from the user's phrasing — if ambiguous, ask.

- **`new`** — create a worktree for a new branch (the most common case)
- **`list`** — show existing worktrees and their branches
- **`cleanup`** — find worktrees whose branches are already merged into main, confirm with user, remove them

---

## Action: new

Goal: create a fresh worktree at `.worktree/<type>-<desc>/` tracking branch `<type>/<desc>`, branched from up-to-date `main`. If the work corresponds to a backlog item, link them so the item gets auto-updated when the work merges.

### Step 1 — Resolve type and description (and optional backlog link)

Two ways the user can invoke this:

- **Linked to a backlog item:** the user references an existing slug, e.g. "start filter-by-project" or "/worktree-flow new filter-by-project". Check whether `docs/backlog/<slug>.md` exists. If it does, read its frontmatter — use `type` and the slug verbatim. No need to ask the user for those.
- **Ad-hoc:** the user describes the work without a backlog item, e.g. "fix branch for the turn replay scroll bug". Infer `type` and produce a kebab-case slug from the description. Aim for 2-4 meaningful words; drop articles.

If only a description is given but the user *might* mean an existing item, do a quick lookup before creating:

```bash
ls docs/backlog/ 2>/dev/null | grep -i <keyword>
```

If something matches, surface it: "There's an existing backlog item `<slug>` — link to that, or create a new branch?"

### Step 2 — Pre-flight checks

Run these in parallel:

```bash
git rev-parse --show-toplevel       # confirm we're in a repo
git branch --show-current           # what's currently checked out
git status --porcelain              # are there uncommitted changes
git worktree list                   # any existing worktrees
```

Then check whether the target branch already exists:

```bash
git rev-parse --verify --quiet <type>/<desc>
```

Decision tree:
- **Branch already exists locally** — ask the user: reuse it (worktree from existing branch) or pick a new name. Don't silently overwrite.
- **Worktree path `.worktree/<type>-<desc>` already exists** — refuse, suggest a different desc.
- **Current checkout has uncommitted changes on main** — that's fine; worktree creation doesn't touch the current checkout. Just note it.

### Step 3 — Sync main

We want the new branch to start from latest main, so fetch first:

```bash
git fetch origin main
```

We do **not** need to switch to main or pull into the current checkout — `git worktree add` can branch directly from `origin/main`. This keeps the user's current working directory untouched.

### Step 4 — Create the worktree

```bash
git worktree add .worktree/<type>-<desc> -b <type>/<desc> origin/main
```

If `.worktree/` doesn't exist yet, `git worktree add` creates it. Confirm it's in `.gitignore` (it should be — see project setup notes below).

### Step 5 — Install dependencies (offer, don't force)

A fresh worktree has no `node_modules`. Ask the user whether to install now:

```bash
cd .worktree/<type>-<desc> && pnpm install
```

For small doc/chore changes the user may skip this. Default recommendation: install for `feat`/`fix`/`refactor`, skip for `docs`/`chore`-config-only.

### Step 6 — Update the backlog item (if linked)

If this worktree links to a `docs/backlog/<slug>.md` item, update its frontmatter:

- `status: todo` → `status: wip`
- `branch: <type>/<desc>` (the branch you just created)
- `worktree: .worktree/<type>-<desc>` (the path you just created)
- `updated: <today>` (add field if missing)

Use the `Edit` tool to change those four fields in place. Don't reorder other keys.

If there's no backlog link, skip this step silently — don't lecture the user about creating one.

### Step 7 — Report and hand off

Tell the user:

1. The worktree path (absolute, copy-pasteable)
2. The branch name
3. How to enter it: `cd .worktree/<type>-<desc>` — and that they can start a fresh Claude Code session there if they want a clean working directory (`cd .worktree/<type>-<desc> && claude`)
4. If a backlog item was linked: one line mentioning it's now `wip`
5. That `.worktree/` is gitignored, so nothing here will leak into commits on main

Keep this short — three to six lines, not a wall of text.

---

## Action: list

```bash
git worktree list
```

Annotate each line with the branch's merge status into main:

```bash
git branch --merged main | sed 's/^[ *]*//' | grep -v '^main$'
```

Group output:

- **Main checkout** — repo root, branch `main`
- **Active worktrees** — under `.worktree/`, branch not yet merged
- **Already merged** — under `.worktree/`, branch is in `git branch --merged main`. Suggest the user run `cleanup` to remove these.

---

## Action: cleanup

Goal: safely remove worktrees whose branches are already merged into main. **Never** auto-delete; always show the list and require confirmation.

### Step 1 — Find candidates

```bash
git fetch origin main                       # ensure main is up to date
git worktree list --porcelain               # parse worktree paths + branches
git branch --merged main                    # branches fully merged into main
```

A candidate is a worktree whose:
- Path is under `.worktree/`
- Branch appears in `git branch --merged main`
- Has no uncommitted changes (`git -C <path> status --porcelain` is empty)

Skip and warn for any worktree with uncommitted/unpushed work — don't offer to delete those.

### Step 2 — Show and confirm

Present the candidates in a compact list:

```
Already merged into main, safe to remove:
  .worktree/feat-sse-reconnect    (feat/sse-reconnect)
  .worktree/fix-replay-scroll     (fix/turn-replay-scroll)

Skipped (uncommitted changes or unmerged):
  .worktree/refactor-parser-types — has uncommitted changes
```

Ask the user: remove all, pick specific ones, or cancel.

### Step 3 — Remove

For each confirmed candidate:

```bash
git worktree remove .worktree/<name>        # removes directory + worktree registration
git branch -d <type>/<desc>                  # removes local branch (safe -d, not -D)
```

If `git worktree remove` complains about untracked files (e.g. `node_modules`), use `--force` only after re-confirming with the user. `git branch -d` will refuse if the branch isn't fully merged — that's the right safety net; don't escalate to `-D` without an explicit user override.

### Step 4 — Mark linked backlog items as done

For each removed worktree, find any `docs/backlog/*.md` whose `branch:` frontmatter field matches the deleted branch. For each match, update the frontmatter:

- `status: wip` (or `review`) → `status: done`
- `updated: <today>`

Don't clear `branch:` / `worktree:` — they're useful audit trail for which branch shipped the item. The release skill will archive these `done` items at tag time.

If no items are linked, skip silently.

After this step, tell the user how many backlog items were marked done (just a count). Example: "Removed 2 worktrees, marked 1 backlog item done. Run `/ship-release` when you're ready to publish."

---

## Project setup notes (one-time, do automatically if missing)

The skill should self-heal these on first run:

- Ensure `.gitignore` contains `.worktree/` — if not, add it and tell the user
- Ensure `.worktree/` directory exists when needed (created automatically by `git worktree add`)

Don't commit the gitignore change yourself — show the diff and let the user decide whether to fold it into their next commit.

## Local Dev Gotcha

The user may ask you to run the worktree on two specific ports so they can inspect the changes in that worktree without conflicting with the main app already running elsewhere.

- When that happens, run the backend on the requested ingest port and run the frontend on the requested Next port, with the frontend pointing to the same `INGEST_PORT`.
- Prefer the explicit one-off commands below instead of `pnpm dev`, so you do not accidentally reuse the default `3000` / `8078` ports.
- On macOS, if the worktree hits native-addon `dlopen(...)` / Team ID issues, retry the same commands with the bundled Codex Node runtime instead of the system `node`.

Example:

```bash
INGEST_PORT=7002 /Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx ingest/index.ts
PORT=3002 INGEST_PORT=7002 /Users/ebbi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/next/dist/bin/next dev --webpack
```

- After boot, verify the exact ports the user asked for:

```bash
curl http://127.0.0.1:7002/health
curl -I http://127.0.0.1:3002
```

---

## Tone

- One-line confirmations for each step, not paragraphs
- Show actual commands you ran (the user can repeat them)
- When something needs the user's call (existing branch, dirty tree), surface it directly — don't bury it

## Anti-patterns to avoid

- Don't switch branches in the **main checkout** to create a feature branch — that defeats the point of worktrees
- Don't `git stash` the user's work to "clean up" before creating a worktree — worktrees are independent, no stash needed
- Don't run `pnpm install` without asking — it's the slowest step and not always needed
- Don't delete worktrees or branches without explicit confirmation, even if they look stale
- Don't use `git branch -D` unless the user explicitly asks for force-delete
