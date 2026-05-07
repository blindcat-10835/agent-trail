# Phase 7: M1 residual dashboard bug fixes - Discussion Log

> **Audit trail only.** Decisions are captured in `07-CONTEXT.md`.

**Date:** 2026-05-07
**Source:** `.planning/2026-05-07-bugs-found-by-user-batch-1.md`
**Areas discussed:** user-provided bug batch, no additional interactive questions

## Captured Issues

| Issue | Decision |
| --- | --- |
| Source switch from session detail carries old session id | Drop source-scoped session id when switching tool |
| Session list currently renders in children | Move session list into persistent right rail |
| No selected session should show overview | `/[tool]/sessions` should render overview/statistics, while `sessions/[id]` renders detail |
| Duplicate React key `null` warnings in replay | Make replay keys deterministic even when ids are missing |
| Codex sessions not sorted/recent sessions missing | Fix Codex sync traversal and freshest-timestamp ordering |
| Header refresh does not pull correct sessions | Sync all sources and notify visible hooks to refetch |
| Session list lacks expected metadata | Compact rail row shows name, project, updated time, and tool |

## the agent's Discretion

- Use existing HUD styling.
- Keep implementation focused to the reported bugs.
- Add focused unit tests around modified behavior.

## Deferred Ideas

- agentsview full sidebar grouping, starred sessions, rename/delete context menus.
