---
status: partial
phase: 04-multi-source-frontend-shell-session-explorer
source: [04-VERIFICATION.md]
started: 2026-05-06T17:00:00.000Z
updated: 2026-05-06T17:00:00.000Z
---

# Phase 4 Human Verification

## Current Test

[awaiting human testing]

## Tests

### 1. Source switcher visual rendering and URL transition
expected: Header shows ALL / OPENCLAW / CLAUDE:CODE / CODEX tabs. Clicking changes URL to /[tool]/dashboard when the target supports the current section, otherwise to that tool's default route.
result: [pending]

### 2. OpenClaw dashboard skeleton renders all 6 sections
expected: /openclaw/dashboard shows KPI bar, Agents grid, Sessions list, Skills, Cron, Activity — all with Phase 6+ placeholders.
result: [pending]

### 3. Session Explorer table displays per-tool columns with correct status badges
expected: OpenClaw shows 4 columns (agent/channel/model/updated), Claude/Codex shows 5 (with PROJECT). Status badges: LIVE green pulse, IDL gray, ABT red, ERR red.
result: [pending]

### 4. Session row click opens detail in right rail
expected: Clicking a session row opens detail panel in right rail with session metadata.
result: [pending]

### 5. Sidebar nav changes per tool capability
expected: OpenClaw sidebar shows OVR/AGT/USD/SKL/ACT/SES. Claude/Codex sidebar shows only OVR/SES (AGT/USD/SKL hidden via CapabilityGate).
result: [pending]

### 6. Legacy redirects return 307
expected: /dashboard → /openclaw/dashboard, /sessions → /openclaw/sessions, etc.
result: [pending]

### 7. Aggregate ALL shell shows cross-source sessions with source badges
expected: / redirects to /all/dashboard. /all/dashboard shows shell chrome plus all 3 ingest-backed sources' sessions merged with OPENCLAW/CLAUDE:CODE/CODEX source badges. The ALL scope is not an ingest API source.
result: [pending]

### 8. GatewayBootstrap only runs for OpenClaw
expected: Gateway WebSocket connects only when viewing /openclaw/* pages. Claude/Codex pages show no Gateway indicator.
result: [pending]

## Agent-Assisted Runtime Checks

### 2026-05-07 audit fixes
result: passed
notes: Browser verification confirmed `/` redirects to `/all/dashboard`; `/all/dashboard` renders header, source switcher, sidebar, right rail, status bar, ALL SESSIONS table, and source badges with 0 console errors. `/openclaw/dashboard` remained healthy with 0 console errors. Next.js MCP `get_errors` returned no config or session errors.

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
