# Backlog

Tactical work items for this project — bugs, refactors, small features. One file per item.

For **strategic** planning (milestones, phases) see `.planning/` and the GSD workflow. This backlog is the layer below: discrete pieces of work that fit into a single worktree / branch.

## Layout

```
docs/backlog/
├── README.md                       (this file)
├── <slug>.md                       (active items: status = todo | wip | review | done)
└── _done/<version>/<slug>.md       (archived after a release ships)
```

Each item is a markdown file with YAML frontmatter. Filename (minus `.md`) is the **slug** — used as the stable ID and as the branch suffix when work starts.

## Frontmatter schema

```yaml
---
type: feat                # feat | fix | refactor | chore | docs
title: Filter by project  # human-readable title (one line)
status: todo              # todo | wip | review | done | wontfix
priority: p2              # p0 (now) | p1 (this cycle) | p2 (soon) | p3 (nice-to-have)
created: 2026-05-21       # YYYY-MM-DD when added
branch:                   # populated by /worktree-flow when work starts
worktree:                 # populated by /worktree-flow when work starts
---
```

After frontmatter, the body is free-form markdown. Suggested sections (use what's useful, skip what isn't):

- `## Description` — context, what & why
- `## Acceptance criteria` — checklist of done-ness
- `## Related` — links to other items, files, PRs, issues

## Status semantics

| Status     | Meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `todo`     | Captured but not started. Default for new items.                        |
| `wip`      | Work in progress. A worktree exists; `branch` and `worktree` are set.   |
| `review`   | Implementation done, awaiting merge or external review                  |
| `done`     | Merged into main. Will be archived on next release.                     |
| `wontfix`  | Decided not to do. Stays for history; explain why in body.              |

## How the skills interact

- **`/backlog`** — add, list, show, update items by hand
- **`/worktree-flow new <slug>`** — read an item, create the matching branch & worktree, mark it `wip`
- **`/worktree-flow cleanup`** — when removing a merged worktree, mark the linked item `done`
- **`/ship-release`** — at release time, list all `done` items in the release notes and move their files into `_done/<version>/`

## Conventions

- One concern per item — if it's growing tentacles, split it. Items are easier to ship if they fit one worktree.
- Title in title case, short. Body for nuance.
- Slugs are short kebab-case nouns (`filter-by-project`, not `add-filter-functionality-for-projects`).
- Priority is a quick-sort signal, not a contract. `p0` should be rare.
- Don't delete items — move to `_done/` or set `wontfix`. The history is useful.
