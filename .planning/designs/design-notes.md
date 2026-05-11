# Agents Tracing — Design System

A design system for **agent-tracing-dashboard**, a local, multi-source AI agent session tracing dashboard for **OpenClaw**, **Claude Code**, and **Codex**. The product replays each agent session turn-by-turn — user input, assistant response, tool/skill/subagent activity, token usage — in a single Next.js dashboard. All data stays on the user's machine.

> Aesthetic in one line: **Terminal × HUD hybrid** — modern dashboard layout with localized terminal / log aesthetics and lightweight HUD ornamentation (hud-clip corners, accent-color glows, grid + scanline backdrops).

---

## Source

|              |                                                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo         | `camtrik/agents-tracing-dashboard` (`main`)                                                                                                                |
| Stack        | Next.js 16 App Router · React 19 · Tailwind v4 (`@theme inline`) · shadcn/ui `radix-nova` preset · OKLCH tokens · lucide-react · Hono ingest service |
| Routes       | `/(tool-shell)/[tool]/{dashboard,sessions,activity}` for `tool ∈ {openclaw, claude-code, codex, all}`                                                     |
| Theme tokens | `app/globals.css` (`:root` light, `[data-theme="dark"]` dark)                                                                                            |
| Fonts        | JetBrains Mono (mono) · Inter (sans) — loaded via `next/font/google`                                                                                       |

This design system is a **standalone visual reference**; the original codebase is not bundled. To consult it, browse `camtrik/agents-tracing-dashboard` on GitHub.

---

## Surfaces (products)

The dashboard ships one application that morphs by data source. Each source is a "tool" with its own capabilities, nav set, and overview content; the chrome (header, sidebar, status bar, right rail) is shared.

| Tool id         | Label       | Capabilities                                            |
| --------------- | ----------- | ------------------------------------------------------- |
| `all`         | All Sources | aggregate sessions list, replay                         |
| `openclaw`    | OpenClaw    | overview + agents + cost + skills + activity + sessions |
| `claude-code` | Claude Code | overview + sessions + activity + subagents in replay    |
| `codex`       | Codex       | overview + sessions + activity                          |

The UI kit in `ui_kits/dashboard/` recreates the full shell + the two highest-value views:

- **Overview** — KPI bar, usage & cost, agents (OpenClaw only), top models, automations, starred sessions, timeline, project ranking
- **Session detail** — search, turn navigator, expandable turn timeline with tool / skill / subagent / thinking activity blocks

---

## Index

| File                    | What's in it                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `README.md`           | (this file) Overview, content fundamentals, visual foundations, iconography                |
| `colors_and_type.css` | Base + semantic CSS variables for both light/dark themes; ready to drop into any HTML mock |
| `SKILL.md`            | Agent-Skill-compatible front matter for downloading and using this system in Claude Code   |
| `assets/`             | Logos, favicon, brand mark, source icons (Claude/Codex/OpenClaw glyphs)                    |
| `fonts/`              | (empty — Inter & JetBrains Mono loaded via Google Fonts; flagged below)                   |
| `preview/`            | All Design-System-tab cards (typography, colors, spacing, components, brand)               |
| `ui_kits/dashboard/`  | Hi-fidelity React recreation of the dashboard shell, overview, and session detail          |

---

## Content fundamentals

### Voice and tone

- **Tool-developer voice.** Terse, technical, no marketing fluff. Reads like a CLI man page rendered in a HUD.
- **Second person is rare.** Most strings are status announcements about the system, not the user. (`INGEST ONLINE`, `NO SESSIONS`, `NOT FOUND`.) Imperative when the user needs to act: `ENSURE THE INGEST SERVICE IS RUNNING.` — uppercased as a directive.
- **English in the UI, bilingual in docs.** UI strings are English. README/spec/plan docs frequently mix Chinese + English. Code identifiers and commit messages stay English-only.
- **Sentences are short.** A clause, a noun phrase, a number. Avoid commas; favor stacked KV.

### Casing

- **ALL CAPS** for: section headings (`KPI OVERVIEW`, `INDEXED SESSIONS`), status pills (`LIVE`, `ABORTED`, `TRUNCATED`), button glyphs that act as labels (`PROTO v3`, `MEM 42.1MB`), and the brand wordmark (`AGENTS TRACING`).
- **Title Case** for human-readable product names: `OpenClaw`, `Claude Code`, `Codex`, `All Sources`.
- **lowercase** for prose body text inside cards: "sessions indexed from ingest", "j/k to navigate".
- **mono nums** (`tabular-nums`) for any number that can change at runtime.

### Letter-spacing as semantic signal

The system uses generous tracking to mark "system speech":

- `tracking-[0.06em]` — sidebar nav labels
- `tracking-[0.12em]` — section headings, status-bar key-values
- `tracking-[0.14em]` — source switcher chips
- `tracking-[0.2em]` — small caps status labels (`ERROR`, `LIVE`, `INPUT`)
- `tracking-[0.3em]` — the brand wordmark only

Wider tracking = more "machine voice". Body copy and prose stays at default tracking.

### Punctuation and ornaments

- **Em-dash placeholder for empty values:** `—` instead of `0`, `N/A`, or `(empty)`. The KPI cards literally render `—` when no data is loaded.
- **Single Unicode glyphs as decoration:** `◆` (brand mark, accent dots), `▸` (list marker, agent footer), `⟳` `↻` (sync states), `«` `»` (rail toggles, drawer arrows), `⚠` `✕` (warning/error icons inside status bars), `↑` `↓` (token direction).
- **No emoji.** The codebase has zero — emoji would break the terminal feel.
- **No exclamation points.** No "Welcome!" "Done!" "Awesome!" — only `Copied!` as a transient micro-affordance.

### Example strings (lifted from the repo)

- `AGENTS TRACING` (brand wordmark, header)
- `KPI OVERVIEW` `INDEXED SESSIONS` `AGENTS` `SKILLS` `CRON` `ACTIVITY` (section heads)
- `NO SESSIONS · ENSURE OPENCLAW SESSIONS DIRECTORY IS CONFIGURED IN INGEST.` (empty state)
- `INGEST ONLINE` / `OFFLINE` / `RECONNECTING` (status bar pill)
- `INDEX LOCAL · PROTO v3 · CONN conn_8f2e · SCOPES workspace:* · agents:rw` (left status bar)
- `MEM 42.1MB · FPS 60 · SRC OPENCLAW · ◆ TRACE` (right status bar)
- `j/k to navigate` (keyboard hint, lowercase prose)
- `Turn 4 of 27` (mono, sentence case)

---

## Visual foundations

### Color

**OKLCH everywhere.** Theme tokens are defined in `app/globals.css` and bridged into Tailwind via `@theme inline`. Two themes: light (default `:root`) and dark (`[data-theme="dark"]`).

The single hue carrying the brand is the **accent**, with the H angle exposed as `--accent-h: 75` (yellow-green / chartreuse). Three accent steps:

- `--accent` `oklch(0.8 0.17 75)` — interactive, focused, brand mark
- `--accent-dim` `oklch(0.5 0.12 75)` — secondary accent surfaces
- `--accent-ghost` `oklch(0.32 0.08 75)` — large background blooms

Neutrals are warm-cool: light theme leans slightly green-warm (`hue 90`/`160`), dark theme leans cool (`hue 160`). There's a deliberate green tint to dark "card" backgrounds (`oklch(0.185 0.008 160)`) — they're not pure neutral.

**Status palette** (used inline in components, not exposed as semantic tokens — these are the literal OKLCHs found in source):

- Success / live: `oklch(0.76 0.17 145)` (green)
- Warning / pending: `oklch(0.76 0.17 75)` (amber)
- Parser warning: `oklch(0.76 0.17 55)` (orange)
- Error / destructive: `--destructive` `oklch(0.577 0.245 27)` light / `oklch(0.704 0.191 22)` dark

### Type

- **Sans (Inter)** — UI labels, headings, prose. Tracking adjusted by role (see "Letter-spacing as semantic signal" above).
- **Mono (JetBrains Mono)** — IDs, numbers, paths, model names, status-bar values, code blocks. Anywhere alignment or "this is data not prose" matters.
- **Type sizes lean small.** The codebase actively uses `text-[9px]`, `[10px]`, `[11px]`, `[12px]`. Most "body" text is 11–12px; status bar runs at 10px; the brand wordmark is 16px (`text-base`). This is a developer-density product and the type scale reflects that.
- **No `font-heading`.** `--font-heading` aliases `--font-sans` — there is no separate display family.

### Spacing and density

- Grid is 4px / 8px. Common gaps: `gap-1`, `gap-2`, `gap-3`. Section vertical rhythm: `space-y-6`.
- Shell fixed grid: header `48px` / status bar `26px` / sidebar `56px`. Main is `minmax(0, 1fr)` with the right rail as a draggable column.
- Cards: `px-4 py-3.5` (KPI), `px-4 py-2.5` (turn card collapsed header).
- Status bar pads are tight: `px-3.5 h-6`.

### Borders, radii, shadows

- **Borders carry the burden.** Most cards use `border border-border` + `bg-card` rather than shadows. The system prefers crisp 1px boundaries over fills.
- **Radius is conservative.** `--radius: 0.625rem` (10px), scaled into `--radius-sm` (6px) through `--radius-4xl` (26px). Most components use small radii or none at all (status pills, KPI cells).
- **HUD clip-path corners replace rounding for branded elements.** `hud-clip-sm` (8px), `hud-clip-md` (14px), `hud-clip-lg` (20px) octagonal cuts. Used for: the brand glyph tile, source-switcher chips, header action buttons, agent cards, status badges. This is the single most distinctive visual signature.
- **Shadows are rare and small.** Only `shadow-sm` on expanded turn cards. No drop-shadow layers; the system uses borders and accent glows instead.
- **Glow utility:** `hud-glow` = `box-shadow: 0 0 12px var(--color-border), 0 0 24px rgba(95, 212, 255, 0.1);`. Used sparingly — also `text-shadow: 0 0 8px var(--color-accent)` on the `◆ TRACE` indicator and `0 0 8px <m.color>` on agent-card status edges.

### Backgrounds and texture

Both themes have a fixed full-viewport backdrop, set with two stacked `body::before` + `body::after` pseudo-elements:

- **Grid lines** — 48px × 48px cyan grid at very low alpha (`rgba(95, 212, 255, 0.028)`).
- **Scanlines** — 4px repeating horizontal lines at `rgba(0, 0, 0, 0.06)`.
  Both are `position: fixed; pointer-events: none;` and sit behind all content — they survive scroll and route changes.

Card backgrounds: solid `--card`. No gradients on cards. Header alone uses `bg-gradient-to-b from-card to-background`.

### Lines as decoration

The header and status bar both end in a gradient hairline: `bg-gradient-to-r from-transparent via-accent to-transparent opacity-60` (header bottom, 40% opacity on status-bar top). 1px tall, full-width. This is the system's "scanline" punctuation and should be reused for any high-level surface chrome.

### Interaction states

- **Hover:** muted-foreground → foreground; or border becomes `border-accent` + text becomes `text-accent` for interactive HUD buttons. Backgrounds: `hover:bg-accent/10`, `hover:bg-secondary/30`, `hover:bg-accent/5`.
- **Active:** `aria-expanded:bg-muted`, sometimes `translate-y-px` on buttons (from shadcn defaults).
- **Active nav item:** sidebar shows a 0.5px accent left-rail glow + `text-accent` + `bg-background`. The chip-style active state on the source switcher: `border-accent text-accent bg-accent/10`.
- **Disabled:** `opacity-50 cursor-not-allowed`, plus `disabled:opacity-30` on prev/next nav arrows.
- **Focus:** `focus-visible:ring-3 ring-ring/50` from shadcn primitives.

### Animation

- **Restraint.** No bouncing, no easings other than `transition-colors` and `transition-all duration-200`.
- **`animate-pulse`** on live status dots and pending tool indicators.
- **`animate-ping`** layered behind status dots for "LIVE" / "RUNNING" / "AWAITING USER".
- **`animate-spin`** on the loading spinner (`h-6 w-6 border-b-2 border-accent`).
- **Drawer animations** are explicit keyframes: `drawer-fade-in` (200ms opacity) and `drawer-slide-in` (24px X translate + opacity).
- The pre-existing `tw-animate-css` stylesheet is loaded but the codebase mostly uses Tailwind's stock utilities.

### Layout rules

- **Fixed full-viewport grid.** `grid grid-rows-[48px_1fr_26px] h-screen w-screen overflow-hidden`. The app does not scroll; only inner regions do.
- **Sidebar is icon-only (56px wide)** — labels are 3-letter glyphs (`OVR`, `SES`, `ACT`, `AGT`, `USD`, `SKL`).
- **Right rail is user-resizable** via a 4px hover-highlight col-resize divider.
- **Status bar always visible**, displays system state on the left (INDEX/PROTO/CONN/SCOPES) and runtime on the right (MEM/FPS/SRC/TRACE).

### Transparency and blur

- No backdrop-blur. The HUD aesthetic prefers crisp surfaces over glass.
- Alpha is used to tint, never to layer translucent panels: `bg-accent/5`, `bg-accent/10`, `bg-secondary/20`, `bg-secondary/50`, `bg-destructive/10`, `bg-card/50`.

### Imagery

- **There is no photography.** The product has zero stock images. All "imagery" is generated: SVG glyphs, status pulses, lucide icons, the brand `◆`.
- If a UI ever needs a placeholder asset, render the brand mark or a HUD-clipped rectangle of `--accent-ghost`. Do not introduce stock photos.

---

## Iconography

### What ships in the codebase

- **lucide-react** is the icon library (declared in `components.json`, `iconLibrary: "lucide"`). Stroke icons at 1.5–2 stroke width, conventional sizes `w-2.5 h-2.5` through `w-5 h-5`. Concrete imports observed:
  - `Wrench` `Sparkles` `Bot` (activity badges: tool / skill / subagent)
  - `ChevronDown` `ChevronRight` `ChevronUp` (turn collapse)
  - `Copy` `Check` (clipboard action / confirmation)
  - `Search` `X` (search bar)
  - `Moon` `Sun` (theme toggle)
- **Unicode glyphs as iconography.** Heavily used in chrome where a single character is more honest than an SVG: `◆` (brand) · `▸` (list marker) · `↻` `⟳` (sync, plus pulsing variant) · `«` `»` (rail toggles) · `↑` `↓` (token usage direction) · `⚠` (truncated / parser warning) · `✕` (error) · `—` (empty placeholder) · `▪` (sidebar nav active marker, optional).
- **No emoji.** Verified across the repo — none in UI strings, none in copy. Do not introduce emoji.
- **No custom icon font.** The system relies entirely on lucide-react + Unicode.
- **No raster icons.** Everything is either an SVG (lucide) or a glyph.

### Logos / brand marks

The product has no formal logo lockup beyond the wordmark `AGENTS TRACING` paired with a `◆` glyph rendered inside a `hud-clip-sm` 28px accent tile. We've preserved this and added flat SVG variants in `assets/`:

- `assets/agents-tracing-logo.svg` — the full lockup
- `assets/brand-mark.svg` — the diamond tile alone
- `assets/source-openclaw.svg`, `assets/source-claude.svg`, `assets/source-codex.svg`, `assets/source-all.svg` — per-source mini glyphs used in the source switcher

### When you need a new icon

1. **Look at lucide-react first** (lucide.dev). Match the existing weight; never mix Material / Phosphor / Heroicons.
2. **Consider a Unicode glyph** — for boolean / binary indicators (◯ / ●), arrows, navigation marks. Cheaper and matches the HUD tone better than an SVG.
3. **Never hand-roll decorative SVG.** If a placeholder is needed, render the brand `◆` or a `hud-clip-md` rectangle.

### CDN

lucide-react is bundled via npm in the original repo. The HTML mocks in `preview/` and `ui_kits/` use lucide via `https://unpkg.com/lucide-static/font/` is **not** used — instead the mocks import individual lucide SVGs from `assets/lucide/` (a small curated subset). When a mock needs an icon not in `assets/lucide/`, copy it manually from `lucide.dev` and add it.

---

## Caveats

- **No font files shipped.** Inter and JetBrains Mono are loaded via Google Fonts in the original `next/font/google` setup; we recreate this with Google Fonts `@import` links rather than self-hosted TTFs. If you need offline-capable mocks, download the families to `fonts/` and update `colors_and_type.css` to point at them. Flagging this substitution.
- **UI kit covers the highest-value views, not every page.** Activity log, settings, the full session list with filter dropdown, and right-rail session info exist in the source but are not recreated as standalone JSX — they appear as cropped/inline elements within the shell mock.
- **No production data wiring.** All mock content is plausible-but-fake (session IDs, project names, costs). The shape matches the canonical `TraceTurn` / `TraceSession` types but the values are static.

---

## How to use this system

1. Drop `colors_and_type.css` into any HTML file. It defines both light and dark tokens; toggle with `data-theme="dark"` on `<html>`.
2. Use the `hud-clip-{sm,md,lg}` classes for the octagonal cut corners that define the HUD vocabulary.
3. Match the type roles: mono for data, sans for UI, ALL CAPS + tracking for system speech, em-dash for missing values.
4. Borrow patterns from `ui_kits/dashboard/index.html` — it's a working assembly of every chrome element.
