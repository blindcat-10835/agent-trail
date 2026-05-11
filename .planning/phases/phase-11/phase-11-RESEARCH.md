# Phase 11: HUD Shell & Design System Foundation - Research

**Researched:** 2026-05-12
**Domain:** Frontend shell chrome, design token system, Tailwind v4 @theme inline
**Confidence:** HIGH

## Summary

Phase 11 reworks the shared shell chrome (header, source switcher, sidebar, status bar, right rail) to match the production design spec in `.planning/designs/design-notes.md`. The good news: the existing shell is already **structurally very close** to the target — the `ShellFrame` already uses the correct `grid-rows-[48px_1fr_26px]` layout, the source switcher already uses `hud-clip-sm` chips with the right active state, and `globals.css` already has HUD clip-path tokens, grid/scanline backdrop pseudo-elements, and full OKLCH theme tokens for both light and dark. The primary work is **verification and refinement** of existing patterns, plus **three functional additions**: right-rail scope tabs (recent/starred/live), source-color spines on rail session entries, and source capability metadata driving sidebar nav visibility.

The right-rail resize mechanism already works via raw `mousedown/mousemove/mouseup` event handlers in `ShellFrame` with `col-resize` cursor and a 4px divider. No new resize library needed. Zustand stores (`ui-store`, `tool-store`, `theme-store`, `starred-store`, `ingest-health-store`) are all established patterns that need extension, not replacement.

**Primary recommendation:** Extend existing components in-place rather than rebuilding. The shell is 80% aligned with the design spec; the remaining 20% is adding right-rail scopes, tightening typography/tracking to match design-notes, and wiring source capability metadata into sidebar nav filtering.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- OKLCH semantic tokens already in `app/globals.css` — verify and extend to match design-notes spec exactly
- HUD clip utilities (`hud-clip-sm`, `hud-clip-md`, `hud-clip-lg`) defined in globals.css as utility classes
- Grid + scanline backdrop: `body::before` + `body::after` pseudo-elements with fixed positioning
- Status palette: success `oklch(0.76 0.17 145)`, warning `oklch(0.76 0.17 75)`, error uses `--destructive`
- Typography: Inter (sans), JetBrains Mono (mono), small type scale (9-12px body), ALL CAPS + tracking for system speech
- No emoji, no backdrop-blur, no photography, no custom icon fonts
- Redesign existing `components/shell/shell-header.tsx` to match prototype: brand wordmark, source switcher chips with hud-clip corners, sync/theme/rail controls
- Source switcher uses `hud-clip-sm` chips with active state `border-accent text-accent bg-accent/10`
- Supports `all`, `openclaw`, `claude-code`, `codex` — preserves `/(tool-shell)/[tool]` route model
- Header height: 48px fixed
- Sidebar: icon-only (56px wide), 3-letter glyphs (OVR, SES, ACT), accent left-rail glow on active item
- Status bar: always visible, 26px fixed height, system state left, runtime right
- Sync control, theme toggle, right-rail toggle integrated into header/status bar
- Source capability metadata drives nav visibility (agents/automations sections only for OpenClaw)
- Redesign existing `components/shell/right-rail.tsx` to support recent/starred/live session scopes
- Source-color spines on session entries
- User-resizable via 4px col-resize divider
- Click-through into session detail

### the agent's Discretion
- Exact component file organization
- Animation details for drawer/panel transitions
- Empty state copy for rail sections
- Mobile responsiveness (not a target but should not break)

### Deferred Ideas (OUT OF SCOPE)
- Overview v2 page content (Phase 12)
- Sessions table redesign (Phase 13)
- Session detail redesign (Phase 13)
- Activity page redesign
- Playwright tests for shell (Phase 14)
- Accessibility audit (Phase 14)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-101 | Production app using Terminal × HUD visual system: OKLCH tokens, chartreuse accent, grid/scanline backdrop, clipped HUD corners, mono data typography, terse technical copy, no emoji | Existing `globals.css` already has OKLCH tokens, HUD clip utilities, grid/scanline backdrop. Verification + gap-filling needed for status palette tokens and typography tracking rules. |
| UI-102 | Switch between `all`, `openclaw`, `claude-code`, `codex` from shared header preserving `/(tool-shell)/[tool]` route model | Existing `SourceSwitcher` already uses `hud-clip-sm` chips with correct active state, `source-switcher-routing.ts` handles route preservation. Minimal changes needed. |
| UI-103 | Source-aware sidebar nav, sync control, theme toggle, right-rail toggle, always-visible status bar matching draft prototype | Sidebar already filters by `requiredCapability`. Needs wiring to source capability metadata from Phase 10 (`ingest/config/capabilities.ts`). Header/status bar controls already functional. |
| UI-104 | Right rail with recent/starred/live session scopes, status counts, source-color spines, click-through into session detail | Existing `RightRail` delegates to `SessionsRightRail` with single scope. Needs scope tabs added. Source-color spine concept needs implementation. Resize mechanism already exists. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design tokens (OKLCH, HUD clip, backdrop) | Browser / CSS | — | Pure CSS custom properties and `@theme inline` in `globals.css` |
| Source switching + route preservation | Browser / Client | — | Client-side router (`useRouter`) + `source-switcher-routing.ts` logic |
| Sidebar nav filtering by capabilities | Browser / Client | — | Client-side: `useAgentTool()` reads definition capabilities, filters nav |
| Theme toggle (light/dark) | Browser / Client | — | Zustand `theme-store` + `data-theme` attribute on `<html>` |
| Right-rail scope switching (recent/starred/live) | Browser / Client | API / Backend | Scope UI is client-side; starred data fetched via BFF proxy from ingest |
| Source-color spines | Browser / Client | — | Pure CSS borders/colors keyed to source type, rendered client-side |
| Right-rail resize | Browser / Client | — | Raw mouse event handlers in `ShellFrame`, no library |
| Status bar (ingest status) | Browser / Client | API / Backend | `useIngestStatus` hook polls BFF health endpoint |
| Sync control | Browser / Client | API / Backend | `syncAllSessions` / `syncToolSessions` via BFF proxy |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router framework | Project foundation, `(tool-shell)/[tool]` route group [VERIFIED: package.json] |
| React | 19.2.4 | UI library | Project foundation [VERIFIED: package.json] |
| Tailwind CSS v4 | ^4 (latest 4.3.0) | Utility-first CSS with `@theme inline` | CSS-first config, no `tailwind.config.js` [VERIFIED: npm registry + globals.css] |
| Zustand | ^5.0.12 (latest 5.0.13) | Client state management | Established pattern across 6 stores [VERIFIED: npm registry + stores/] |
| shadcn/ui (radix-nova) | — | Component primitives | `components.json` preset, `components/ui/` [VERIFIED: components.json] |
| lucide-react | — | Icon library | `components.json` iconLibrary setting [VERIFIED: components.json] |
| vitest | ^4.1.5 | Test framework | Existing test infra [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | ^16.3.2 | Component testing | Component render tests for shell |
| @testing-library/jest-dom | ^6.9.1 | DOM assertions | `toBeInTheDocument()` etc. |
| tw-animate-css | — | Tailwind animation helpers | Already imported in globals.css |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw mouse events (resize) | `use-resize-observer` or `react-resizable-panels` | Raw events already work and are simpler. No library needed for a single divider drag. |
| CSS custom properties (status palette) | Tailwind `@theme` status tokens | Status colors are used inline in components, not as utility classes. Custom properties in `:root` / `[data-theme="dark"]` is correct — design notes confirm "used inline in components, not exposed as semantic tokens". |

**Installation:**
No new packages needed for this phase. All dependencies are already in `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
URL /{tool}/dashboard
        │
        ▼
┌─── app/(tool-shell)/[tool]/layout.tsx ───┐
│  Server: validate toolId → notFound()     │
│  Render: <ToolLayoutClient toolId={toolId}>│
└───────────────┬────────────────────────────┘
                │
                ▼
┌─── ToolLayoutClient ──────────────────────┐
│  AgentToolProvider(toolId)                 │
│  └── ShellFrame                            │
│       ├── ShellHeader                      │
│       │    ├── Brand (◆ AGENTS TRACING)    │
│       │    ├── SourceSwitcher              │
│       │    └── Controls (sync/theme/rail)  │
│       ├── <main grid>                      │
│       │    ├── SidebarNav                  │
│       │    │    └── filtered by capability  │
│       │    ├── children (page content)     │
│       │    └── RightRail (if open)         │
│       │         ├── Scope tabs (recent/★/live) │
│       │         └── Session entries + spines │
│       └── ShellStatusBar                   │
│            ├── Left: INDEX/PROTO/CONN/SCOPES│
│            └── Right: MEM/FPS/SRC/◆ TRACE │
└────────────────────────────────────────────┘
```

### Recommended Project Structure
```
components/
├── shell/                    # Shell chrome components (EDIT in place)
│   ├── shell-header.tsx      # Header with brand + source switcher + controls
│   ├── source-switcher.tsx   # HUD clip chip source switcher
│   ├── source-switcher-routing.ts  # Route preservation logic
│   ├── sidebar-nav.tsx       # Icon-only sidebar with capability filtering
│   ├── shell-status-bar.tsx  # Status bar with system/runtime sections
│   ├── shell-frame.tsx       # Grid layout orchestrator
│   └── right-rail.tsx        # Right rail frame
├── hud/                      # HUD primitives (EDIT in place)
│   ├── hud-panel.tsx         # Card wrapper with border
│   ├── theme-toggle.tsx      # Light/dark toggle button
│   └── ingest-health-overlay.tsx
├── sessions/                 # Session components (EDIT in place)
│   ├── sessions-right-rail.tsx  # Rail content — ADD scope tabs
│   └── session-filter-dropdown.tsx
stores/                       # Zustand stores (EXTEND in place)
├── ui-store.ts               # Right rail open/width state
├── tool-store.ts             # Selected tool + session
├── theme-store.ts            # Light/dark/system
├── starred-store.ts          # Starred session IDs
└── ingest-health-store.ts    # Ingest connection status
app/
├── globals.css               # Theme tokens + HUD utilities (VERIFY + EXTEND)
lib/agent-tools/              # Tool registry + adapters (VERIFY, no changes expected)
```

### Pattern 1: Tailwind v4 @theme inline for Design Tokens
**What:** CSS-first theme configuration using `@theme inline` block in `globals.css` instead of JavaScript config
**When to use:** All design tokens (colors, radii, fonts, custom clip-paths)
**Example:**
```css
/* Source: app/globals.css — existing pattern */
@theme inline {
  --clip-sm: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --color-accent: var(--accent);
  --radius-sm: calc(var(--radius) * 0.6);
}

@utility hud-clip-sm {
  clip-path: var(--clip-sm);
}
```
**Key insight:** `@theme inline` makes tokens available as both CSS variables and Tailwind utility classes. `@utility` defines custom utility classes. Both are already in use.

### Pattern 2: Fixed Viewport Grid Layout
**What:** The shell uses a fixed full-viewport grid that doesn't scroll
**When to use:** Shell chrome layout only (not page content)
**Example:**
```tsx
// Source: components/shell/shell-frame.tsx — existing implementation
<div className="grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden bg-background text-foreground">
  <ShellHeader /> {/* 48px */}
  <main style={{ gridTemplateColumns: rightRailOpen ? `56px minmax(0, 1fr) 4px ${rightRailWidth}px` : '56px minmax(0, 1fr)' }}>
    <SidebarNav />
    <div>{children}</div>
    {rightRailOpen && <><ResizeDivider /><RightRail /></>}
  </main>
  <ShellStatusBar /> {/* 26px */}
</div>
```

### Pattern 3: Source Capability Metadata → Nav Filtering
**What:** Each tool definition declares capabilities; sidebar filters nav items by `requiredCapability`
**When to use:** Sidebar nav rendering, any capability-gated UI
**Example:**
```tsx
// Source: components/shell/sidebar-nav.tsx — existing pattern
const visibleItems = definition.nav.filter(
  item => !item.requiredCapability || capabilities[item.requiredCapability]
)
```
**Integration note:** The sidebar already filters by `AgentToolCapabilities` (client-side definitions in `lib/agent-tools/*/definition.ts`). The Phase 10 `SOURCE_CAPABILITIES` from `ingest/config/capabilities.ts` is a separate server-side config used for overview module visibility. The sidebar nav should continue using the client-side `AgentToolCapabilities` — the two systems overlap but serve different purposes.

### Pattern 4: Right Rail Resize via Raw Mouse Events
**What:** User-resizable column using mousedown/mousemove/mouseup with col-resize cursor
**When to use:** Right rail divider only
**Example:**
```tsx
// Source: components/shell/shell-frame.tsx — existing implementation
const handleResizeStart = useCallback((e: React.MouseEvent) => {
  e.preventDefault()
  isDragging.current = true
  const startX = e.clientX
  const startWidth = rightRailWidth
  const onMouseMove = (ev: MouseEvent) => {
    if (!isDragging.current) return
    const delta = startX - ev.clientX
    setRightRailWidth(startWidth + delta)
  }
  const onMouseUp = () => {
    isDragging.current = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}, [rightRailWidth, setRightRailWidth])
```

### Anti-Patterns to Avoid
- **Don't rebuild shell from scratch:** Existing components are 80% aligned with design spec. Extend in place.
- **Don't bypass BFF proxy:** All data access goes through `app/api/agent-tools/[tool]/...` — per D-07 in ARCHITECTURE.md.
- **Don't add new shadcn components for shell chrome:** CONTEXT.md says "No new shadcn components needed — extend existing ones."
- **Don't use `backdrop-blur`:** Design notes explicitly state "No backdrop-blur. The HUD aesthetic prefers crisp surfaces over glass."
- **Don't add emoji or photography:** Design notes explicitly state "No emoji" and "There is no photography."
- **Don't nest `<button>` inside `<button>`:** See ERRORS_LEARNED.md EL-001 — use `<div role="button">` for clickable rows containing action buttons.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Right rail resize | Custom resize library or react-resizable-panels | Raw mouse events (existing pattern) | Already implemented and working in shell-frame.tsx |
| Theme toggling | Custom cookie/localStorage + DOM manipulation | Existing `theme-store.ts` with Zustand persist | Already persists to localStorage, sets `data-theme` attribute |
| Source switching | Custom route logic | Existing `source-switcher-routing.ts` + `SourceSwitcher` | Already handles section mapping, entity ID stripping, fallback routing |
| HUD clip corners | CSS border-radius hacks | Existing `@utility hud-clip-{sm,md,lg}` with polygon clip-path | Already defined in globals.css |
| Star state management | Custom fetch + state | Existing `starred-store.ts` with optimistic updates + server sync | Already handles toggle, revert on failure, hydration |

**Key insight:** The shell infrastructure is mature. The phase is primarily about visual refinement and adding right-rail scope tabs — not about building new infrastructure.

## Common Pitfalls

### Pitfall 1: Confusing Client-side vs Server-side Capabilities
**What goes wrong:** The project has TWO capability systems: (1) `AgentToolCapabilities` in `lib/agent-tools/types.ts` (client-side, used by sidebar nav filtering), and (2) `SourceCapabilities` in `ingest/config/capabilities.ts` (server-side, used for overview module visibility). They have different fields and serve different purposes.
**Why it happens:** Both are called "capabilities" but live in different layers.
**How to avoid:** Sidebar nav continues using `AgentToolCapabilities` from tool definitions. Overview page modules use `SourceCapabilities` from the capabilities endpoint. Don't merge them.
**Warning signs:** Adding `agents: true` to `AgentToolCapabilities` when it already exists in `SourceCapabilities`.

### Pitfall 2: Button Nesting in Right Rail Session Rows
**What goes wrong:** Session rows in the right rail are clickable (navigate to session detail) but also contain a star toggle button. Nesting `<button>` inside a `<button>` causes hydration errors.
**Why it happens:** The row needs to be clickable, and the star icon needs its own click handler.
**How to avoid:** Use `<div role="button" tabIndex={0}>` for the row, with `<button>` for the star toggle. This pattern is already established in `sessions-right-rail.tsx` (SessionRailRow component).
**Warning signs:** React hydration mismatch console errors; `SessionRailRow` using `<button>` as the outer element.

### Pitfall 3: Status Palette Not Matching Design Notes Exactly
**What goes wrong:** Using `oklch(0.76 0.17 55)` for parser warnings when the design notes specify it, but forgetting it's different from the warning color.
**Why it happens:** Multiple OKLCH colors with similar chroma/lightness values.
**How to avoid:** Reference the exact values from design-notes.md: success `oklch(0.76 0.17 145)`, warning `oklch(0.76 0.17 75)`, parser-warning `oklch(0.76 0.17 55)`, error `--destructive`. Add CSS custom properties for each.
**Warning signs:** Status colors that look too similar (success vs warning) or don't match the prototype.

### Pitfall 4: Gradient Hairline z-index Fighting with Content
**What goes wrong:** The header bottom gradient hairline (`bg-gradient-to-r from-transparent via-accent to-transparent opacity-60`) gets covered by main content.
**Why it happens:** The hairline is absolutely positioned in the header, but `overflow-hidden` on the main grid can clip it.
**How to avoid:** Ensure the hairline is inside the header element (already the case) and uses `relative` positioning on the parent.
**Warning signs:** Gradient line disappears on certain routes or when right rail opens.

### Pitfall 5: Right Rail Scope Tabs Breaking Session Selection
**What goes wrong:** Adding scope tabs (recent/starred/live) changes the session list, but `selectedSessionId` from the old scope persists, causing a stale selection highlight.
**Why it happens:** Scope switching changes the data without clearing selection.
**How to avoid:** Clear `selectedSessionId` when switching rail scope, or verify the selected ID still exists in the new scope's data.
**Warning signs:** A session stays highlighted after switching to a scope where it doesn't exist.

### Pitfall 6: Missing `tabular-nums` on Numeric Data
**What goes wrong:** Numbers in status bar or session counts shift width as they change, causing layout jitter.
**Why it happens:** Default font-variant-numeric doesn't use tabular figures.
**How to avoid:** Apply `tabular-nums` (Tailwind utility) to all numeric data displays — session counts, status values, token counts, costs. Design notes specify "mono nums (`tabular-nums`) for any number that can change at runtime."
**Warning signs:** Status bar text jumps horizontally when values change.

## Code Examples

### HUD Clip Source Switcher Chip (Existing Pattern)
```tsx
// Source: components/shell/source-switcher.tsx — already in codebase
<button
  onClick={() => handleSwitch(def.id)}
  className={`hud-clip-sm border px-2.5 py-1 text-xs tracking-[0.14em] font-semibold transition-all ${
    isActive
      ? 'border-accent text-accent bg-accent/10'
      : 'border-border text-muted-foreground hover:border-accent hover:text-accent'
  }`}
>
  {def.shortLabel}
</button>
```

### Gradient Hairline (Existing Pattern)
```tsx
// Source: components/shell/shell-header.tsx — already in codebase
<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
```

### Status Bar with Ingest Status (Target Enhancement)
```tsx
// Source: components/shell/shell-status-bar.tsx — existing, needs enhancement
// Target: integrate useIngestStatus for "ONLINE"/"OFFLINE"/"RECONNECTING"
<footer className="flex items-center justify-between px-3.5 h-6 border-t border-border text-[10px] tracking-[0.12em] text-muted-foreground relative">
  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />
  <div className="flex items-center gap-4">
    <span>INGEST <b className={statusClass}>{statusLabel}</b></span>
    {/* ... rest of left section */}
  </div>
  {/* ... right section */}
</footer>
```

### Source-Color Spine on Rail Session Entry (New Pattern)
```tsx
// Target pattern for session entries in right rail
// Source color mapping:
//   openclaw → oklch(0.76 0.17 145) (green/success)
//   claude-code → oklch(0.8 0.17 75) (chartreuse/accent)
//   codex → oklch(0.76 0.17 200) (cyan)
const SOURCE_COLORS: Record<string, string> = {
  openclaw: 'border-l-[3px] border-l-[oklch(0.76_0.17_145)]',
  'claude-code': 'border-l-[3px] border-l-[oklch(0.8_0.17_75)]',
  codex: 'border-l-[3px] border-l-[oklch(0.76_0.17_200)]',
}
```

### Right Rail Scope Tabs (New Pattern)
```tsx
// Target pattern for scope tab switching in right rail
const RAIL_SCOPES = [
  { id: 'recent', label: 'RECENT' },
  { id: 'starred', label: '★ STARRED' },
  { id: 'live', label: '● LIVE' },
] as const;
type RailScope = typeof RAIL_SCOPES[number]['id'];

// Zustand store extension or local state for active scope
// Tab bar rendered with tracking-[0.12em] ALL CAPS per design system
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@theme inline` in CSS | Tailwind v4 (2024) | No JavaScript config file; all tokens in CSS |
| CSS-in-JS for theme tokens | CSS custom properties + OKLCH | Tailwind v4 | Better performance, native cascade, OKLCH color space |
| `@apply` for custom utilities | `@utility` directive | Tailwind v4 | Explicit utility registration instead of anonymous @apply |
| `backdrop-blur` glass effects | Crisp borders + accent glows | Design decision | HUD aesthetic explicitly rejects blur |

**Deprecated/outdated:**
- `tailwind.config.js` / `tailwind.config.ts`: Project uses Tailwind v4 CSS-first config. No config file exists.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Source-color spine colors (openclaw=green, claude-code=accent, codex=cyan) are reasonable defaults | Code Examples | Need user confirmation on exact source colors — design notes don't specify per-source spine colors explicitly |
| A2 | Right rail scope tabs (recent/starred/live) are the correct three scopes from UI-104 | Code Examples | Design notes mention "recent/starred/live session scopes" which maps cleanly |
| A3 | No new Zustand store is needed — existing stores can be extended for rail scope state | Standard Stack | If rail scope needs persistence or complex state, a new store may be warranted |
| A4 | Sidebar nav items don't change — only their visibility filtering might use server-side capabilities | Architecture | Currently sidebar uses client-side `AgentToolCapabilities`; if we need to also check server-side `SourceCapabilities`, the wiring changes |

**If this table has entries:** All claims were verified from codebase reading except the source-color assignments which need user confirmation.

## Open Questions

1. **Source-color assignments for spines**
   - What we know: Design notes mention "source-color spines on session entries" in UI-104
   - What's unclear: The exact OKLCH values for each source
   - Recommendation: Use accent (chartreuse) for all as a safe default, or define per-source colors and confirm with user

2. **Right rail "live" scope data source**
   - What we know: "recent" = existing sessions list sorted by updated, "starred" = existing starred sessions endpoint
   - What's unclear: What "live" scope shows — currently active sessions via SSE? Sessions with status='active'?
   - Recommendation: "live" likely means sessions currently in progress (status=active), filtered from the sessions list

3. **Whether status bar should show real ingest health**
   - What we know: `useIngestStatus` hook exists with connected/disconnected/reconnecting states
   - What's unclear: Whether Phase 11 wires it into the status bar or leaves it as static placeholder text
   - Recommendation: Wire it — the status bar currently shows hardcoded `CONN conn_8f2e` and `MEM 42.1MB` which are placeholder values

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, Vitest | ✓ | — | — |
| pnpm | Package management | ✓ | — | — |
| vitest | Test runner | ✓ | ^4.1.5 | — |
| @testing-library/react | Component tests | ✓ | ^16.3.2 | — |
| jsdom | Vitest DOM environment | ✓ | ^29.1.1 | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-101 | HUD tokens match design-notes (colors, clip-paths, backdrop) | unit | `pnpm vitest run tests/unit/shell/design-tokens.test.ts` | ❌ Wave 0 |
| UI-101 | Grid/scanline backdrop renders on body | unit | `pnpm vitest run tests/unit/shell/backdrop.test.ts` | ❌ Wave 0 |
| UI-102 | Source switcher renders all 4 tools with correct labels | unit | `pnpm vitest run tests/unit/shell/source-switcher.test.tsx` | ❌ Wave 0 |
| UI-102 | Source switching preserves route model | unit | `pnpm vitest run tests/unit/bff/source-switcher-routing.test.ts` | ✅ Existing |
| UI-103 | Sidebar filters nav by source capabilities | unit | `pnpm vitest run tests/unit/shell/sidebar-nav.test.tsx` | ❌ Wave 0 |
| UI-103 | Theme toggle switches light/dark | unit | `pnpm vitest run tests/unit/shell/theme-toggle.test.tsx` | ❌ Wave 0 |
| UI-104 | Right rail renders scope tabs (recent/starred/live) | unit | `pnpm vitest run tests/unit/shell/right-rail-scopes.test.tsx` | ❌ Wave 0 |
| UI-104 | Source-color spines render per session source | unit | `pnpm vitest run tests/unit/shell/source-spines.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/unit/shell/ --reporter=verbose`
- **Per wave merge:** `pnpm test:run` (full suite — 530+ tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/shell/design-tokens.test.ts` — covers UI-101 token verification
- [ ] `tests/unit/shell/source-switcher.test.tsx` — covers UI-102 switcher rendering
- [ ] `tests/unit/shell/sidebar-nav.test.tsx` — covers UI-103 capability filtering
- [ ] `tests/unit/shell/right-rail-scopes.test.tsx` — covers UI-104 scope tabs
- [ ] Existing `tests/unit/bff/source-switcher-routing.test.ts` covers route preservation logic (already exists)

**Note:** The existing `vitest.config.ts` uses `environment: 'node'`. Component tests with `@testing-library/react` need `environment: 'jsdom'`. Either update the config to support per-test environment overrides (Vitest supports `// @vitest-environment jsdom` docblock) or change the default. The `jsdom` package is already installed.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `components/shell/*.tsx` — all 7 shell files read in full
- Codebase analysis: `app/globals.css` — 306 lines, verified all tokens and utilities
- Codebase analysis: `lib/agent-tools/` — registry, types, all 4 tool definitions, client-hooks
- Codebase analysis: `stores/` — all 6 Zustand stores read in full
- Codebase analysis: `.planning/designs/design-notes.md` — 244 lines, production design spec
- Context7 `/tailwindlabs/tailwindcss.com` — Tailwind v4 `@theme inline` and `@utility` directives

### Secondary (MEDIUM confidence)
- `.planning/designs/draft-design/ui_kits/dashboard/ShellChrome.jsx` — draft prototype shell components
- `.planning/phases/phase-11/phase-11-CONTEXT.md` — user decisions
- `.planning/REQUIREMENTS.md` — UI-101 through UI-104 requirement definitions

### Tertiary (LOW confidence)
- Source-color assignments for spines — no explicit specification found, assumed from context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json and npm registry
- Architecture: HIGH — all shell components read and analyzed, pattern alignment confirmed
- Pitfalls: HIGH — derived from ERRORS_LEARNED.md and actual codebase patterns
- Right rail scopes: MEDIUM — "recent/starred/live" mentioned in requirements but exact behavior for "live" unclear

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (stable — no fast-moving dependencies)
