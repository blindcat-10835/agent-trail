# Session Filter & Star Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filter dropdown (group by, source filter, starred only, search) and star/unstar functionality to the right rail session list.

**Architecture:** Star data persisted server-side in SQLite via new ingest API endpoints, proxied through BFF. Star state managed in a Zustand store shared across components. Filter state managed locally in the right rail component. All filtering is client-side on loaded sessions (~500).

**Tech Stack:** Hono (ingest routes), SQLite (session_stars table), Next.js BFF proxy routes, Zustand (star store), React useState (filter state), Tailwind + shadcn tokens (UI).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `ingest/api/stars.ts` | Star REST endpoints (GET/POST/DELETE) |
| Create | `stores/starred-store.ts` | Zustand store for star state + server sync |
| Create | `components/sessions/session-filter-dropdown.tsx` | Filter dropdown panel component |
| Create | `app/api/agent-tools/[tool]/sessions/starred/route.ts` | BFF proxy for starred list |
| Create | `app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts` | BFF proxy for star/unstar |
| Modify | `ingest/db/index.ts` | Add migration step for session_stars table |
| Modify | `ingest/index.ts` | Register stars routes |
| Modify | `components/sessions/sessions-right-rail.tsx` | Integrate filter dropdown, star icon, group headers |

---

### Task 1: Add session_stars table migration

**Files:**
- Modify: `ingest/db/index.ts:136-241` (runMigrations function)

- [ ] **Step 1: Add migration step to `ingest/db/index.ts`**

Bump `targetVersion` from 7 to 8. Add a new migration step at the end of the `migrationSteps` array:

```typescript
const targetVersion = 8;
```

Add to the `migrationSteps` array after the last existing step:

```typescript
    {
      desc: 'Create session_stars table for starred sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS session_stars (
          session_id TEXT NOT NULL,
          starred_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (session_id)
        )
      `,
    },
```

- [ ] **Step 2: Verify migration applies**

Run: `pnpm dev` (start the app briefly to trigger migration)
Expected: Console log shows `✓ Create session_stars table for starred sessions` and `Migrations complete — schema at v8`.

- [ ] **Step 3: Commit**

```bash
git add ingest/db/index.ts
git commit -m "feat: add session_stars table migration"
```

---

### Task 2: Ingest star API endpoints

**Files:**
- Create: `ingest/api/stars.ts`
- Modify: `ingest/index.ts:12-16` (imports), `ingest/index.ts:80-82` (route mounting)

- [ ] **Step 1: Create `ingest/api/stars.ts`**

Follow the same Hono pattern as `ingest/api/agents.ts`:

```typescript
/**
 * Stars API Routes
 *
 * REST API endpoints for starring/unstarring sessions.
 * Star state is persisted in the session_stars SQLite table.
 */

import { Hono } from 'hono';
import { getDatabase } from '../db';

export const starsRoutes = new Hono();

// Validate session ID format (same pattern as sessions.ts)
function isValidSessionId(id: string): boolean {
  return /^[a-zA-Z0-9:\-_.]{1,256}$/.test(id);
}

// ============================================================================
// GET /api/v1/sessions/starred - List starred session IDs
// ============================================================================

starsRoutes.get('/api/v1/sessions/starred', (c) => {
  const db = getDatabase();

  const rows = db.prepare(
    'SELECT session_id FROM session_stars ORDER BY starred_at DESC',
  ).all() as { session_id: string }[];

  return c.json({
    session_ids: rows.map((r) => r.session_id),
  });
});

// ============================================================================
// POST /api/v1/sessions/:id/star - Star a session
// ============================================================================

starsRoutes.post('/api/v1/sessions/:id/star', (c) => {
  const sessionId = c.req.param('id');

  if (!isValidSessionId(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }

  const db = getDatabase();

  db.prepare(
    'INSERT OR IGNORE INTO session_stars (session_id) VALUES (?)',
  ).run(sessionId);

  return c.json({ ok: true, session_id: sessionId });
});

// ============================================================================
// DELETE /api/v1/sessions/:id/star - Unstar a session
// ============================================================================

starsRoutes.delete('/api/v1/sessions/:id/star', (c) => {
  const sessionId = c.req.param('id');

  if (!isValidSessionId(sessionId)) {
    return c.json({ error: 'Invalid session ID format' }, 400);
  }

  const db = getDatabase();

  db.prepare('DELETE FROM session_stars WHERE session_id = ?').run(sessionId);

  return c.json({ ok: true, session_id: sessionId });
});
```

- [ ] **Step 2: Register stars routes in `ingest/index.ts`**

Add import at line 16 (after agents import):

```typescript
import { starsRoutes } from './api/stars.js';
```

Add route mounting at line 83 (after agentsRoutes):

```typescript
app.route('/', starsRoutes);
```

- [ ] **Step 3: Verify ingest starts and routes are accessible**

Run: `pnpm dev`
Expected: Ingest service starts. Test with curl:
```bash
curl http://localhost:8078/api/v1/sessions/starred
# Expected: {"session_ids":[]}
```

- [ ] **Step 4: Commit**

```bash
git add ingest/api/stars.ts ingest/index.ts
git commit -m "feat: add star API endpoints to ingest service"
```

---

### Task 3: BFF proxy routes for star

**Files:**
- Create: `app/api/agent-tools/[tool]/sessions/starred/route.ts`
- Create: `app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts`

- [ ] **Step 1: Create `app/api/agent-tools/[tool]/sessions/starred/route.ts`**

Follow the BFF proxy pattern from `app/api/agent-tools/[tool]/sessions/route.ts`. The starred route does NOT need source-scoping — stars are global across all sources.

```typescript
/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/starred
 *
 * Proxies starred session list from the ingest service.
 * Stars are global (not scoped to a specific tool source).
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'

const INGEST_PORT = process.env.INGEST_PORT || '8078'

export async function GET(_request: NextRequest) {
  try {
    const res = await fetch(`http://localhost:${INGEST_PORT}/api/v1/sessions/starred`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/agent-tools/[tool]/sessions/[sessionId]/star/route.ts`**

```typescript
/**
 * BFF API Proxy — POST/DELETE /api/agent-tools/[tool]/sessions/[sessionId]/star
 *
 * Proxies star/unstar requests to the ingest service.
 * Stars are global (not scoped to a specific tool source).
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'

const INGEST_PORT = process.env.INGEST_PORT || '8078'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params

  try {
    const res = await fetch(
      `http://localhost:${INGEST_PORT}/api/v1/sessions/${encodeURIComponent(sessionId)}/star`,
      { method: 'POST' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params

  try {
    const res = await fetch(
      `http://localhost:${INGEST_PORT}/api/v1/sessions/${encodeURIComponent(sessionId)}/star`,
      { method: 'DELETE' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify BFF routes proxy correctly**

Run: `pnpm dev`
Test:
```bash
# Through BFF proxy
curl http://localhost:3000/api/agent-tools/all/sessions/starred
# Expected: {"session_ids":[]}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/agent-tools/\[tool\]/sessions/starred/route.ts app/api/agent-tools/\[tool\]/sessions/\[sessionId\]/star/route.ts
git commit -m "feat: add BFF proxy routes for session star"
```

---

### Task 4: Zustand starred store

**Files:**
- Create: `stores/starred-store.ts`

- [ ] **Step 1: Create `stores/starred-store.ts`**

Follow the minimal Zustand pattern from `stores/tool-store.ts`:

```typescript
import { create } from 'zustand'

interface StarredState {
  ids: Set<string>
  loaded: boolean

  load: () => Promise<void>
  toggle: (sessionId: string) => void
  isStarred: (sessionId: string) => boolean
}

export const useStarredStore = create<StarredState>((set, get) => ({
  ids: new Set(),
  loaded: false,

  load: async () => {
    if (get().loaded) return
    try {
      const res = await fetch('/api/agent-tools/all/sessions/starred')
      if (!res.ok) return
      const data = await res.json()
      set({ ids: new Set(data.session_ids as string[]), loaded: true })
    } catch {
      // Silently ignore — stars are non-critical
    }
  },

  toggle: (sessionId: string) => {
    const { ids } = get()
    const isCurrentlyStarred = ids.has(sessionId)

    // Optimistic update
    const next = new Set(ids)
    if (isCurrentlyStarred) {
      next.delete(sessionId)
    } else {
      next.add(sessionId)
    }
    set({ ids: next })

    // Server sync (fire-and-forget, revert on failure)
    const method = isCurrentlyStarred ? 'DELETE' : 'POST'
    fetch(`/api/agent-tools/all/sessions/${encodeURIComponent(sessionId)}/star`, { method })
      .then((res) => {
        if (!res.ok) {
          // Revert on failure
          const revert = new Set(get().ids)
          if (isCurrentlyStarred) {
            revert.add(sessionId)
          } else {
            revert.delete(sessionId)
          }
          set({ ids: revert })
        }
      })
      .catch(() => {
        // Revert on network error
        const revert = new Set(get().ids)
        if (isCurrentlyStarred) {
          revert.add(sessionId)
        } else {
          revert.delete(sessionId)
        }
        set({ ids: revert })
      })
  },

  isStarred: (sessionId: string) => {
    return get().ids.has(sessionId)
  },
}))
```

- [ ] **Step 2: Initialize store on app load**

In `app/layout.tsx`, add a client component that loads the starred store on mount. Create `components/starred-store-init.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useStarredStore } from '@/stores/starred-store'

export function StarredStoreInit() {
  const load = useStarredStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  return null
}
```

Then add `<StarredStoreInit />` inside the `<body>` in `app/layout.tsx`, before `{children}`.

- [ ] **Step 3: Verify store loads starred IDs**

Run: `pnpm dev`. Open the app and check browser DevTools Network tab for a request to `/api/agent-tools/all/sessions/starred`. No errors should appear.

- [ ] **Step 4: Commit**

```bash
git add stores/starred-store.ts components/starred-store-init.tsx app/layout.tsx
git commit -m "feat: add starred Zustand store with optimistic server sync"
```

---

### Task 5: Filter dropdown component

**Files:**
- Create: `components/sessions/session-filter-dropdown.tsx`

- [ ] **Step 1: Create `components/sessions/session-filter-dropdown.tsx`**

This component receives filter state and callbacks as props (no internal state — the parent `sessions-right-rail.tsx` owns state). It uses the project's HUD style tokens.

```tsx
'use client'

import { useRef, useEffect, useState } from 'react'
import { TOOL_IDS } from '@/lib/agent-tools/registry'
import type { TraceSource } from '@/types/trace'
import { useStarredStore } from '@/stores/starred-store'

export type GroupMode = 'none' | 'agent' | 'project'

export interface SessionFilterState {
  groupMode: GroupMode
  sourceFilter: Set<TraceSource>
  starredOnly: boolean
  searchQuery: string
}

interface SessionFilterDropdownProps {
  filter: SessionFilterState
  onGroupModeChange: (mode: GroupMode) => void
  onSourceToggle: (source: TraceSource) => void
  onClearSources: () => void
  onStarredOnlyToggle: () => void
  onSearchChange: (query: string) => void
  onClearAll: () => void
}

const SOURCE_LABELS: Record<TraceSource, string> = {
  'claude-code': 'Claude Code',
  openclaw: 'OpenClaw',
  codex: 'Codex',
}

export function SessionFilterDropdown({
  filter,
  onGroupModeChange,
  onSourceToggle,
  onClearSources,
  onStarredOnlyToggle,
  onSearchChange,
  onClearAll,
}: SessionFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const starredCount = useStarredStore((s) => s.ids.size)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('click', onClickOutside, true)
    return () => document.removeEventListener('click', onClickOutside, true)
  }, [open])

  const hasActiveFilters =
    filter.groupMode !== 'none' ||
    filter.sourceFilter.size > 0 ||
    filter.starredOnly ||
    filter.searchQuery.length > 0

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-6 h-6 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Filters"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {hasActiveFilters && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-1 w-56 max-h-[min(560px,calc(100vh-128px))] overflow-y-auto overflow-x-hidden bg-background border border-border rounded-md shadow-lg p-2 z-50 animate-in fade-in-0 zoom-in-95 origin-top-right"
        >
          {/* Search */}
          <input
            type="text"
            placeholder="Search sessions..."
            value={filter.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-7 px-2 mb-1 text-xs bg-input border border-border rounded outline-none focus:border-ring placeholder:text-muted-foreground"
          />

          {/* Display */}
          <div className="pt-2 pb-1 border-t border-border mt-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Display
            </div>
            <FilterToggle
              active={filter.groupMode === 'agent'}
              onClick={() => onGroupModeChange(filter.groupMode === 'agent' ? 'none' : 'agent')}
            >
              Group by agent
            </FilterToggle>
            <FilterToggle
              active={filter.groupMode === 'project'}
              onClick={() => onGroupModeChange(filter.groupMode === 'project' ? 'none' : 'project')}
            >
              Group by project
            </FilterToggle>
          </div>

          {/* Starred */}
          <div className="pt-2 pb-1 border-t border-border mt-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Starred
            </div>
            <FilterToggle active={filter.starredOnly} onClick={onStarredOnlyToggle}>
              Starred only
              {starredCount > 0 && (
                <span className="ml-auto text-[9px] font-semibold text-amber-500">{starredCount}</span>
              )}
            </FilterToggle>
          </div>

          {/* Source */}
          <div className="pt-2 pb-1 border-t border-border mt-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Source
            </div>
            <SourceSelectRow
              label="All"
              selected={filter.sourceFilter.size === 0}
              onClick={onClearSources}
            />
            {TOOL_IDS.map((source) => (
              <SourceSelectRow
                key={source}
                label={SOURCE_LABELS[source]}
                selected={filter.sourceFilter.size === 0 || filter.sourceFilter.has(source)}
                onClick={() => onSourceToggle(source)}
              />
            ))}
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="block w-full px-2 py-1 mt-2 text-[10px] text-muted-foreground text-center border-t border-border pt-2 hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 w-full px-2 py-1 text-[11px] rounded transition-colors text-left ${
        active ? 'bg-muted text-green-500 font-medium' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 transition-colors ${
          active ? 'bg-green-500 border-green-500' : 'border-border'
        }`}
      />
      {children}
    </button>
  )
}

function SourceSelectRow({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 w-full px-2 py-0.5 text-[11px] rounded transition-colors text-left ${
        selected ? 'text-foreground font-medium' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
          selected ? 'bg-foreground border-foreground' : 'border-border'
        }`}
      >
        {selected && (
          <svg width="8" height="8" viewBox="0 0 16 16" fill="white">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/sessions/session-filter-dropdown.tsx
git commit -m "feat: add session filter dropdown component"
```

---

### Task 6: Integrate filter, star, and group by into right rail

**Files:**
- Modify: `components/sessions/sessions-right-rail.tsx`

This is the main integration task. It wires together the filter dropdown, star icon, group headers, and filter logic.

- [ ] **Step 1: Add imports to `sessions-right-rail.tsx`**

Add at the top of the file (after existing imports):

```typescript
import { useState, useMemo } from 'react'
import { useStarredStore } from '@/stores/starred-store'
import {
  SessionFilterDropdown,
  type SessionFilterState,
  type GroupMode,
} from './session-filter-dropdown'
import type { TraceSource } from '@/types/trace'
import { TOOL_IDS } from '@/lib/agent-tools/registry'
```

Note: `useState` and `useMemo` may already be imported. Merge if so. Remove `React.` prefixes if the file uses direct imports.

- [ ] **Step 2: Add filter state and logic to `SessionsRailContent`**

Inside `SessionsRailContent` (around line 146), add filter state before the existing code:

```typescript
const [filter, setFilter] = useState<SessionFilterState>({
  groupMode: 'none',
  sourceFilter: new Set(),
  starredOnly: false,
  searchQuery: '',
})
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
const starredIds = useStarredStore((s) => s.ids)
const starredToggle = useStarredStore((s) => s.toggle)
const starredIsStarred = useStarredStore((s) => s.isStarred)
```

- [ ] **Step 3: Add filter application logic with `useMemo`**

Add after the filter state, before the return statement:

```typescript
const filteredSessions = useMemo(() => {
  let result = sessions

  // Search filter
  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase()
    result = result.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.project && s.project.toLowerCase().includes(q)),
    )
  }

  // Source filter (empty set = show all)
  if (filter.sourceFilter.size > 0) {
    result = result.filter((s) => filter.sourceFilter.has(s.source))
  }

  // Starred only filter
  if (filter.starredOnly) {
    result = result.filter((s) => starredIds.has(s.id))
  }

  return result
}, [sessions, filter, starredIds])
```

- [ ] **Step 4: Add group by derivation with `useMemo`**

```typescript
interface GroupSection {
  label: string
  sessions: typeof sessions
}

const groupedSessions = useMemo(() => {
  if (filter.groupMode === 'none') {
    return null
  }

  const map = new Map<string, typeof sessions>()
  for (const s of filteredSessions) {
    const key = filter.groupMode === 'agent'
      ? (s.agentName || s.source)
      : (s.project || 'default')
    const list = map.get(key) || []
    list.push(s)
    map.set(key, list)
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, sessions]) => ({ label, sessions }))
}, [filteredSessions, filter.groupMode])
```

- [ ] **Step 5: Add filter callback handlers**

```typescript
const handleGroupModeChange = (mode: GroupMode) => {
  setFilter((prev) => ({ ...prev, groupMode: mode }))
  // Persist to localStorage
  try {
    localStorage.setItem('agents-tracing-group-mode', mode)
  } catch {}
}

const handleSourceToggle = (source: TraceSource) => {
  setFilter((prev) => {
    const next = new Set(prev.sourceFilter)
    if (next.has(source)) {
      next.delete(source)
    } else {
      next.add(source)
    }
    // If all sources selected, treat as "all" (empty set)
    return { ...prev, sourceFilter: next.size === TOOL_IDS.length ? new Set() : next }
  })
}

const handleClearAll = () => {
  setFilter({
    groupMode: 'none',
    sourceFilter: new Set(),
    starredOnly: false,
    searchQuery: '',
  })
  try {
    localStorage.removeItem('agents-tracing-group-mode')
  } catch {}
}
```

- [ ] **Step 6: Add localStorage restore on mount**

Add a `useEffect` to restore `groupMode` from localStorage:

```typescript
useState(() => {
  // Restore groupMode from localStorage on first render
  try {
    const stored = localStorage.getItem('agents-tracing-group-mode')
    if (stored === 'agent' || stored === 'project') {
      setFilter((prev) => ({ ...prev, groupMode: stored }))
    }
  } catch {}
})
```

Note: Use the lazy initializer form of `useState` to read localStorage once on mount:

Replace the `filter` state initialization with:

```typescript
const [filter, setFilter] = useState<SessionFilterState>(() => {
  let groupMode: GroupMode = 'none'
  try {
    const stored = localStorage.getItem('agents-tracing-group-mode')
    if (stored === 'agent' || stored === 'project') groupMode = stored
  } catch {}
  return { groupMode, sourceFilter: new Set(), starredOnly: false, searchQuery: '' }
})
```

- [ ] **Step 7: Modify the header area to include filter dropdown**

In the header section (around lines 173-206), add the `SessionFilterDropdown` next to the existing refresh button. Find the header `div` and add the filter dropdown:

After the refresh button (the `RefreshCw` icon button), add:

```tsx
<SessionFilterDropdown
  filter={filter}
  onGroupModeChange={handleGroupModeChange}
  onSourceToggle={handleSourceToggle}
  onClearSources={() => setFilter((prev) => ({ ...prev, sourceFilter: new Set() }))}
  onStarredOnlyToggle={() => setFilter((prev) => ({ ...prev, starredOnly: !prev.starredOnly }))}
  onSearchChange={(q) => setFilter((prev) => ({ ...prev, searchQuery: q }))}
  onClearAll={handleClearAll}
/>
```

Make the header `div` have `position: relative` so the dropdown positions correctly.

- [ ] **Step 8: Replace `sessions.map()` with filter-aware rendering**

Replace the session list rendering (the `sessions.map()` call around lines 232-243) with logic that handles both flat and grouped views:

```tsx
{groupedSessions ? (
  // Grouped view
  groupedSessions.map((group) => (
    <div key={group.label}>
      <button
        onClick={() =>
          setCollapsedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(group.label)) next.delete(group.label)
            else next.add(group.label)
            return next
          })
        }
        className="w-full flex items-center gap-1 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={`transition-transform ${collapsedGroups.has(group.label) ? '' : 'rotate-90'}`}>
          ▶
        </span>
        {group.label} ({group.sessions.length})
      </button>
      {!collapsedGroups.has(group.label) &&
        group.sessions.map((session, i) => (
          <SessionRailRow
            key={session.id || `${session.source}-${i}`}
            session={session}
            isSelected={selectedSessionId === session.id}
            onSelect={handleSelect}
            isStarred={starredIsStarred(session.id)}
            onToggleStar={() => starredToggle(session.id)}
          />
        ))}
    </div>
  ))
) : (
  // Flat list
  filteredSessions.map((session, i) => (
    <SessionRailRow
      key={session.id || `${session.source}-${i}`}
      session={session}
      isSelected={selectedSessionId === session.id}
      onSelect={handleSelect}
      isStarred={starredIsStarred(session.id)}
      onToggleStar={() => starredToggle(session.id)}
    />
  ))
)}
```

- [ ] **Step 9: Add star icon to `SessionRailRow`**

Modify the `SessionRailRow` component to accept star props and render the star icon. Update its signature:

```typescript
function SessionRailRow({
  session,
  isSelected,
  onSelect,
  isStarred,
  onToggleStar,
}: {
  session: TraceSession
  isSelected: boolean
  onSelect: (session: TraceSession) => void
  isStarred: boolean
  onToggleStar: () => void
}) {
```

Add a star button as the last element inside the row button, after the relative time text:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation()
    onToggleStar()
  }}
  className={`flex-shrink-0 ml-1 text-sm transition-colors ${
    isStarred
      ? 'text-amber-500'
      : 'text-muted-foreground/30 hover:text-muted-foreground'
  }`}
  aria-label={isStarred ? 'Unstar session' : 'Star session'}
>
  {isStarred ? '★' : '☆'}
</button>
```

- [ ] **Step 10: Verify the full integration works**

Run: `pnpm dev`
Expected:
1. Right rail shows sessions with star icons on the right side
2. Filter button appears in header, clicking opens dropdown
3. Star icon toggles (persists on reload)
4. Group by agent/project shows collapsible group headers
5. Source filter filters sessions
6. Starred only shows only starred sessions
7. Search filters by session name/project

- [ ] **Step 11: Commit**

```bash
git add components/sessions/sessions-right-rail.tsx
git commit -m "feat: integrate filter dropdown, star icon, and group by into right rail"
```

---

### Task 7: Final verification and polish

**Files:**
- Potentially modify: `components/sessions/sessions-right-rail.tsx` (fixes)

- [ ] **Step 1: Test all filter combinations**

Manual test checklist:
- [ ] Flat session list (default, no filters)
- [ ] Group by agent — groups appear, collapsible
- [ ] Group by project — groups appear, collapsible
- [ ] Source filter — selecting one source filters correctly
- [ ] Source filter — deselecting all sources shows nothing
- [ ] Starred only — shows only starred sessions
- [ ] Search — filters by session name
- [ ] Search — filters by project name
- [ ] Combined filters — group by + source + starred
- [ ] Clear filters — resets everything
- [ ] Star persistence — reload page, stars still show
- [ ] Star toggle — star/unstar updates immediately

- [ ] **Step 2: Verify light and dark themes**

Both themes must look correct. Check contrast on:
- Star icon (☆ and ★)
- Filter dropdown background and borders
- Group header text
- Active filter indicators

- [ ] **Step 3: Fix any issues found during testing**

Apply fixes as needed.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "fix: polish session filter and star UI"
```
