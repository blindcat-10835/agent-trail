---
phase: 12-overview-v2
reviewed: 2026-05-16T12:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - ingest/api/overview.ts
  - ingest/api/overview.test.ts
  - types/overview.ts
  - lib/agent-tools/client-hooks.tsx
  - app/api/agent-tools/[tool]/overview/automations/route.ts
  - components/overview/overview-automations.tsx
  - components/overview/overview-page.tsx
  - app/api/agent-tools/[tool]/overview/top-models/route.ts
  - components/overview/top-models-table.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 12: Code Review Report — Gap Closure (Plans 12-04, 12-05)

**Reviewed:** 2026-05-16
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the automation module (OVR-104) and token/cost toggle (OVR-103) gap closure implementations. The implementation is structurally sound: React hooks rules are respected (unconditional hook calls), SQL uses parameterized queries (no injection), types match across the stack, and capability gating follows the established agents module pattern exactly. The BFF proxy pattern (D-07) is correctly followed.

Three warnings found: the new automations BFF route perpetuates a fragile source-param passthrough pattern, the `sortBy` type is unsafely wide across 4 locations, and the sortBy ingest validation has no test coverage. Three info items: dead pre-existing code, missing edge-case test coverage for the new endpoint, and a minor import style issue.

No blockers found. The code is safe to ship with the warnings addressed in a follow-up.

## Warnings

### WR-01: BFF automations route passes raw client query string without stripping `source`

**File:** `app/api/agent-tools/[tool]/overview/automations/route.ts:28-31`
**Issue:** The BFF route concatenates raw client query string (`qs`) directly into the ingest URL. If a client sends `?source=evil`, the ingest URL becomes `/api/v1/overview/automations?source=openclaw&source=evil`. While current behavior is safe (URLSearchParams `.get()` returns the first value, so BFF's injected `source=openclaw` wins), this relies on parameter ordering rather than explicit sanitization. The codebase's own `buildSourceScopedSessionParams()` in `server-adapter.ts` explicitly deletes `source` from client queries with the comment: "Caller-provided `source` is intentionally ignored so URL query params cannot override the adapter-owned source boundary." This new route violates that established security principle.

Note: The existing agents BFF route has the same pattern, so this is a systemic concern — but the new automations route perpetuates it.

**Fix:**
```typescript
// Strip client-provided source before forwarding
const searchParams = new URLSearchParams(request.nextUrl.searchParams)
searchParams.delete('source')
const qs = searchParams.toString()
const data = await fetchIngest(
  `/api/v1/overview/automations?source=${toolId}${qs ? '&' + qs : ''}`,
  { cache: 'no-store' },
)
```

### WR-02: `sortBy` typed as bare `string` instead of union type across 4 locations

**File:** `lib/agent-tools/client-hooks.tsx:924`, `components/overview/top-models-table.tsx:26-27`, `components/overview/overview-page.tsx:41`
**Issue:** The `sortBy` parameter is typed as `string` in the hook (`useTopModels`), component props (`TopModelsTableProps`), and page state (`useState<string>`). This means TypeScript will accept any string value — including typos like `'token'` or `'costs'` — without error. The ingest endpoint validates at runtime and returns a 400, but this could be caught at compile time.

**Fix:**
```typescript
// In types/overview.ts (or inline):
export type SortMode = 'tokens' | 'cost'

// In client-hooks.tsx:
export function useTopModels(toolId: AgentToolId, window: TimeWindow, sortBy: SortMode = 'tokens') {

// In top-models-table.tsx:
interface TopModelsTableProps {
  // ...
  sortBy: SortMode
  onSortChange: (sortBy: SortMode) => void
}

// In overview-page.tsx:
const [modelSortBy, setModelSortBy] = useState<SortMode>('tokens')
```

### WR-03: No test coverage for sortBy parameter validation

**File:** `ingest/api/overview.test.ts`
**Issue:** Plan 12-05 added `sortBy` validation logic to the top-models ingest endpoint (`validSortBy = ['tokens', 'cost']` with 400 response for invalid values) and cost-aware sorting, but no test cases were added. The existing top-models tests only verify model names, token counts, source filtering, and limit. Missing test cases:
- `sortBy=cost` returns models sorted by cost (currently all null, so order unchanged)
- `sortBy=invalid` returns 400
- Default sortBy is 'tokens' when omitted

**Fix:** Add a describe block for sortBy behavior:
```typescript
describe('sortBy parameter', () => {
  it('returns 400 for invalid sortBy', async () => {
    const res = await app.request('/api/v1/overview/top-models?sortBy=invalid')
    expect(res.status).toBe(400)
  })
  it('defaults to tokens when sortBy is omitted', async () => {
    const res = await app.request('/api/v1/overview/top-models')
    expect(res.status).toBe(200)
    // Models ordered by total_tokens DESC
  })
  it('accepts sortBy=cost', async () => {
    const res = await app.request('/api/v1/overview/top-models?sortBy=cost')
    expect(res.status).toBe(200)
  })
})
```

## Info

### IN-01: Dead `validateSource()` function with confusing return type

**File:** `ingest/api/overview.ts:40-44`
**Issue:** The `validateSource` function is defined but never called anywhere in the file. It also has a type-unsafe pattern: `return undefined as any` to signal "invalid source." The codebase uses `isValidSource()` instead (a proper boolean predicate). This is pre-existing dead code, not introduced by these plans.

**Fix:** Remove the unused function entirely.

### IN-02: Automations endpoint missing from invalid-source edge case test

**File:** `ingest/api/overview.test.ts:683-697`
**Issue:** The edge case test at line 683 (`it('returns 400 for invalid source across endpoints', ...)`) lists 6 endpoints but does not include `/api/v1/overview/automations?source=bad`. The automations endpoint has its own individual tests for this, but the comprehensive edge case loop should include it for consistency.

**Fix:**
```typescript
const endpoints = [
  '/api/v1/overview/aggregates?source=bad',
  '/api/v1/overview/top-models?source=bad',
  '/api/v1/overview/top-projects?source=bad',
  '/api/v1/overview/starred?source=bad',
  '/api/v1/overview/timeline?source=bad',
  '/api/v1/overview/agents?source=bad',
  '/api/v1/overview/automations?source=bad',  // ← add
]
```

### IN-03: Duplicate import statements from same module

**File:** `components/overview/overview-automations.tsx:7-8`
**Issue:** Two separate `import type` statements from `@/types/overview` could be consolidated:
```typescript
import type { SourceCapabilitySet } from '@/types/overview'
import type { AutomationSummary } from '@/types/overview'
```

**Fix:**
```typescript
import type { SourceCapabilitySet, AutomationSummary } from '@/types/overview'
```

---

_Reviewed: 2026-05-16_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
