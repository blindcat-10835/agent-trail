---
name: Phase 8 — Quick Actions
type: context
phase: 08
created: 2026-05-02
---

# Phase 8: Quick Actions — CONTEXT

## Goal

Replace the PROVIDERS section in Overview's bottom 3-column layout with a QUICK ACTIONS panel.

## Locked Decisions

### 1. Features (5 actions)

| # | Action | Type | Confirmation | Implementation |
|---|--------|------|-------------|----------------|
| 1 | Restart OpenClaw | Shell command | **Yes** — "Restart OpenClaw? This will interrupt running tasks." | `POST /api/action/restart` → `exec('systemctl restart openclaw')` |
| 2 | Clear Cache | Frontend only | No | Clear dashboard snapshot cache + trigger data re-fetch |
| 3 | Update OpenClaw | Shell command | **Yes** — "Update OpenClaw? This may take a minute." | `POST /api/action/update` → `exec('npm update -g openclaw')` |
| 4 | Reconnect Gateway | Frontend only | No | Call existing reconnect logic in ws-client |
| 5 | View Gateway Settings | Read-only popup | N/A | Show WS URL + Token from `gateway-config.ts` |

### 2. Placement

- Replaces **PROVIDERS** section in Overview bottom 3-column grid
- Occupies 1/3 column width (left column)
- SKILLS and ACTIVITY sections remain unchanged

### 3. Layout

- **Vertical stack** of 5 buttons
- Section header: "QUICK ACTIONS"
- Follow existing `Section` component pattern from overview-tab.tsx

### 4. Interaction Pattern (from reference project)

- Button click → loading state (text changes, disabled, opacity 0.6)
- Shell command actions: `POST /api/action/{id}` → success/error toast
- Confirm dialog for Restart + Update before execution
- Clear Cache: clear local cache + `fetchDashboardData()` after 500ms
- Reconnect: call `wsClient.disconnect()` then reconnect
- Settings: modal/drawer showing read-only WS URL and token

### 5. Architecture

- **Same-machine assumption**: OVAO and OpenClaw run on the same host
- Shell commands executed via Next.js API routes (`app/api/action/*/route.ts`)
- Pattern consistent with existing `app/api/logs/route.ts` and `app/api/sessions/messages/route.ts`
- Toast notifications for success/error feedback

### 6. Visual Style

- Follow HUD/cyberpunk design system (existing tokens)
- Buttons use existing border/card/accent tokens
- Loading state: spinner or text change + disabled
- Danger actions (Restart, Update): subtle accent/destructive visual hint
- Section uses `Section` component from overview-tab.tsx

## Files to Create/Modify

### New files
- `app/api/action/restart/route.ts` — POST handler, exec systemctl restart
- `app/api/action/update/route.ts` — POST handler, exec npm update
- `components/dashboard/quick-actions.tsx` — Quick actions panel component

### Modify
- `components/dashboard/overview-tab.tsx` — Replace PROVIDERS section with QUICK ACTIONS

## Deferred

- Remote deployment support (Gateway RPC for actions)
- Agent management quick actions (restart agent, abort session, etc.)
- Cron management quick actions (trigger now, toggle)
- Docker actions
