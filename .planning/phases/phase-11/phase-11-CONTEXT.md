# Phase 11: HUD Shell & Design System Foundation - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the production visual foundation and shared chrome so every route can be rebuilt against the same source-aware HUD layout. The deliverable is a redesigned shell (header, source switcher, sidebar, status bar, right rail, theme system, grid/scanline backdrop, HUD clip utilities) that matches the design notes and draft prototype. Route pages are NOT redesigned in this phase — only the shared chrome and design token system.

Covers: UI-101, UI-102, UI-103, UI-104.

</domain>

<decisions>
## Implementation Decisions

### Design Token System (UI-101)
- OKLCH semantic tokens already in `app/globals.css` — verify and extend to match design-notes spec exactly
- HUD clip utilities (`hud-clip-sm`, `hud-clip-md`, `hud-clip-lg`) defined in globals.css as utility classes
- Grid + scanline backdrop: `body::before` + `body::after` pseudo-elements with fixed positioning
- Status palette: success `oklch(0.76 0.17 145)`, warning `oklch(0.76 0.17 75)`, error uses `--destructive`
- Typography: Inter (sans), JetBrains Mono (mono), small type scale (9-12px body), ALL CAPS + tracking for system speech
- No emoji, no backdrop-blur, no photography, no custom icon fonts

### Header & Source Switcher (UI-102)
- Redesign existing `components/shell/shell-header.tsx` to match prototype: brand wordmark, source switcher chips with hud-clip corners, sync/theme/rail controls
- Source switcher uses `hud-clip-sm` chips with active state `border-accent text-accent bg-accent/10`
- Supports `all`, `openclaw`, `claude-code`, `codex` — preserves `/(tool-shell)/[tool]` route model
- Header height: 48px fixed

### Sidebar, Status Bar & Controls (UI-103)
- Sidebar: icon-only (56px wide), 3-letter glyphs (OVR, SES, ACT), accent left-rail glow on active item
- Status bar: always visible, 26px fixed height, system state left, runtime right
- Sync control, theme toggle, right-rail toggle integrated into header/status bar
- Source capability metadata drives nav visibility (agents/automations sections only for OpenClaw)

### Right Rail (UI-104)
- Redesign existing `components/shell/right-rail.tsx` to support recent/starred/live session scopes
- Source-color spines on session entries
- User-resizable via 4px col-resize divider
- Click-through into session detail

### the agent's Discretion
- Exact component file organization
- Animation details for drawer/panel transitions
- Empty state copy for rail sections
- Mobile responsiveness (not a target but should not break)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/shell/shell-header.tsx` — current header with source switcher
- `components/shell/source-switcher.tsx` — current source switcher component
- `components/shell/sidebar-nav.tsx` — current sidebar
- `components/shell/shell-status-bar.tsx` — current status bar
- `components/shell/right-rail.tsx` — current right rail
- `components/shell/shell-frame.tsx` — current frame layout
- `components/hud/` — hud-panel, theme-toggle, ingest-health-overlay
- `app/globals.css` — existing theme tokens with OKLCH
- `app/(tool-shell)/[tool]/layout.tsx` — current tool layout
- `lib/agent-tools/` — source tool registry and adapter
- `stores/` — Zustand stores for starred sessions, source state
- `components/starred-store-init.tsx` — starred sessions hydration

### Established Patterns
- Next.js App Router with `(tool-shell)/[tool]` route group
- Zustand stores for client state
- BFF proxy pattern for data access
- `@/` path alias for imports
- Tailwind v4 with `@theme inline` in globals.css
- shadcn/ui radix-nova preset

### Integration Points
- `app/(tool-shell)/[tool]/layout.tsx` — wraps all tool pages with shell
- `lib/agent-tools/` — source capability metadata from Phase 10
- `stores/` — existing Zustand stores
- `ingest/api/overview.ts` — capabilities endpoint from Phase 10

</code_context>

<specifics>
## Specific Ideas

- Design authority is `.planning/designs/design-notes.md` and `.planning/designs/draft-design/`
- Shell fixed grid: `grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden`
- Header gradient hairline: `bg-gradient-to-r from-transparent via-accent to-transparent opacity-60`
- Status bar gradient hairline at top (40% opacity variant)
- HUD clip octagonal cuts for branded elements
- Active nav: 0.5px accent left-rail glow + `text-accent` + `bg-background`
- Right rail: draggable column with col-resize handle
- Source switcher: `hud-clip-sm` chips with `border-accent text-accent bg-accent/10` active state
- Grid backdrop: 48px cyan grid at `rgba(95, 212, 255, 0.028)`
- Scanline backdrop: 4px horizontal at `rgba(0, 0, 0, 0.06)`
- No new shadcn components needed — extend existing ones

</specifics>

<deferred>
## Deferred Ideas

- Overview v2 page content (Phase 12)
- Sessions table redesign (Phase 13)
- Session detail redesign (Phase 13)
- Activity page redesign
- Playwright tests for shell (Phase 14)
- Accessibility audit (Phase 14)

</deferred>
