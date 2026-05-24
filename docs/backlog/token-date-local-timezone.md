---
type: fix
title: Token date calculation uses UTC instead of user local timezone
status: todo
priority: p2
created: 2026-05-25
branch:
worktree:
---

## Description

Token usage date grouping (e.g. daily cost bars, activity charts) currently uses UTC timestamps for day boundaries. This causes dates to be off by up to a day depending on the user's local timezone. Should use the user's local timezone for all date calculations.

## Acceptance criteria

- [ ] Date grouping for token usage respects the user's local timezone
- [ ] Works correctly for users in UTC+X and UTC-X timezones
