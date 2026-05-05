---
status: resolved
trigger: "Running `npm dev` and opening `/dashboard` causes an infinite render loop in the overview tab."
created: 2026-04-30T12:09:05+0800
updated: 2026-04-30T12:20:10+0800
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Confirmed. The composite P0 selectors returned fresh snapshot objects for unchanged inputs, and `OverviewTab` subscribed to one of those unstable snapshots through Zustand.
test: Re-run `/dashboard` after caching stable selector results in `stores/gateway/p0-selectors.ts`.
expecting: React 19 and Zustand 5 should stop reporting `getServerSnapshot` instability, and the overview tab should render without recursive updates.
next_action: session complete

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Visiting `/dashboard` should render the overview tab once and show current agent/session/alert metrics without repeated updates or crashes.
actual: Visiting `/dashboard` returns HTTP 200 but the page enters an infinite render loop, logs repeated browser warnings, and throws a maximum update depth error from `OverviewTab` rendered inside `DashboardLeftPanel`.
errors: "[browser] The result of getServerSnapshot should be cached to avoid an infinite loop" at `components/dashboard/overview-tab.tsx:14:63`; "[browser] Maximum update depth exceeded" and "Uncaught Error: Maximum update depth exceeded" while rendering `OverviewTab` from `components/dashboard/dashboard-left-panel.tsx:33:38`.
reproduction: Start the app with `npm dev`, open `http://localhost:3000/dashboard`, and let the default `overview` tab mount.
started: First observed on 2026-04-30 during local development. Whether it previously worked is unknown.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-30T12:20:10+0800
  checked: `stores/gateway/p0-selectors.ts` and `components/dashboard/overview-tab.tsx`
  found: `selectAlertsState` produced a new wrapper object for identical store input, and several selector branches also returned fresh empty arrays.
  implication: `useGatewayStore(selectAlertsState)` could not provide a stable external-store snapshot and triggered the render loop reported by React.

- timestamp: 2026-04-30T12:20:10+0800
  checked: Targeted ESLint and live `/dashboard` verification through Next.js runtime tools
  found: `./node_modules/.bin/eslint stores/gateway/p0-selectors.ts components/dashboard/overview-tab.tsx` passed, `get_errors` returned `{\"configErrors\":[],\"sessionErrors\":[]}`, and browser console output for `/dashboard` contained no warnings or errors after the fix.
  implication: The selector-layer change removed the runtime loop and left the touched dashboard files clean.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Composite P0 selectors returned fresh objects for unchanged store state, so `useGatewayStore(selectAlertsState)` violated React 19 and Zustand 5 snapshot-stability requirements and recursively re-rendered `OverviewTab`.
fix: Cached stable base, empty, and success selector results in `stores/gateway/p0-selectors.ts` so unchanged inputs reuse the same snapshot object, and removed the unused `Badge` import from `components/dashboard/overview-tab.tsx`.
verification: Targeted ESLint passed for the touched files, and a live `/dashboard` load through Next.js browser automation showed no `sessionErrors`, no browser warnings, and no browser errors.
files_changed:
  - stores/gateway/p0-selectors.ts
  - components/dashboard/overview-tab.tsx
