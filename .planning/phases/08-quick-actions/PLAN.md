---
name: Phase 8 — Quick Actions
type: plan
phase: 08
status: ready
created: 2026-05-02
---

# Phase 8: Quick Actions — PLAN

## Overview

Replace PROVIDERS section in Overview with QUICK ACTIONS panel (5 vertical buttons).
CONTEXT.md at `.planning/phases/08-quick-actions/CONTEXT.md`.

## Wave 1: API Routes (independent, parallel)

### Task 08-01: Restart API route

**Create** `app/api/action/restart/route.ts`

- POST handler
- `exec('systemctl restart openclaw')`, fallback `systemctl --user restart openclaw`, fallback `systemctl --user restart openclaw-gateway`
- Return `{ success: true }` or `{ success: false, error: string }`
- Reference: `references/openclaw-dashboard-html/server.js:2233`

### Task 08-02: Update API route

**Create** `app/api/action/update/route.ts`

- POST handler
- `exec('npm update -g openclaw', { timeout: 120000 })`
- Return `{ success, output?, error? }`
- Reference: `references/openclaw-dashboard-html/server.js:2292`

## Wave 2: Component (depends on wave 1)

### Task 08-03: QuickActions component

**Create** `components/dashboard/quick-actions.tsx`

Client component with 5 action buttons in vertical stack:

1. **Restart OpenClaw** — `POST /api/action/restart`, confirm dialog, loading state
2. **Clear Cache** — call `clearDashboardSnapshot()` from `lib/dashboard-snapshot-cache.ts`, then `store.fetchDashboardData()` or `store.reconnect()`, no confirm
3. **Update OpenClaw** — `POST /api/action/update`, confirm dialog, loading state
4. **Reconnect Gateway** — call `store.reconnect()` from gateway-store, no confirm
5. **View Settings** — toggle a small read-only panel showing WS URL + Token from `readGatewayConfig()` via a new API route or from `NEXT_PUBLIC_GATEWAY_WS` env + read token from API

State per button:
- `idle` → `loading` → `success`/`error`
- Loading: show spinner, disable button, opacity 0.6
- Error/success: show inline feedback (no toast library installed — use simple inline text)

Props: none (self-contained, reads from store internally)

Key imports:
- `useGatewayStore` for `reconnect()`, `fetchDashboardData()`
- `clearDashboardSnapshot` from `lib/dashboard-snapshot-cache.ts`
- `readGatewayConfig` from `lib/gateway-config.ts` (need API route for client access)

### Task 08-03a: Gateway settings API route

**Create** `app/api/gateway-config/route.ts`

- GET handler, server-side only
- Read config via `readGatewayConfig()` from `lib/gateway-config.ts`
- Return `{ gatewayUrl, gatewayToken }` (token masked: show first 4 + last 4 chars)

## Wave 3: Integration (depends on wave 2)

### Task 08-04: Replace PROVIDERS with QUICK ACTIONS

**Modify** `components/dashboard/overview-tab.tsx`

- Remove PROVIDERS `Section` block (lines ~311-334)
- Remove `usageProviders` useMemo (line 77)
- Import `QuickActions` component
- Place `<QuickActions />` where PROVIDERS section was
- Section header: "QUICK ACTIONS" using existing `Section` component

## Verification

- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Overview page renders QUICK ACTIONS section (visual check)
- [ ] 5 buttons visible in vertical stack
- [ ] Restart/Update buttons show confirm before executing
- [ ] Clear Cache clears snapshot and refreshes data
- [ ] Reconnect triggers gateway reconnection
- [ ] Settings shows WS URL + masked token
