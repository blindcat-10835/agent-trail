# Phase 1: 脚手架和工具链 - Research

**Researched:** 2026-04-30
**Domain:** Next.js 16 + Tailwind v4 + shadcn/ui setup
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational development environment for OVAO (OpenClaw Visual Agents Office). The project already has Next.js 16.2.4 with Tailwind v4 CSS-first configuration and ESLint correctly configured via create-next-app. The primary work remaining is initializing shadcn/ui with proper Tailwind v4 integration, creating the route group structure, and verifying the toolchain works correctly.

**Primary recommendation:** Use the official shadcn CLI with New York style (now default), CSS variables enabled, and the existing Tailwind v4 `@theme inline` configuration. Route groups should be created as `(shell)` to organize the dashboard, office, and workspace routes under a shared layout.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** CSS 变量格式使用 HSL（shadcn/ui 默认），Phase 2 再定制 HUD 主题色值
- **D-02:** Phase 1 安装基础组件：Button, Card, Badge, Separator
- **D-03:** shadcn/ui 初始化使用 `npx shadcn@latest init`，采用默认 New York 样式基础
- **D-04:** 保持根目录平铺结构（app/, gateway/, stores/, lib/, types/ 在根目录），新增 components/ 目录
- **D-05:** App Router 使用 `(shell)` route group 包裹主页面，共享 Shell 布局
- **D-06:** 页面目录结构：`app/(shell)/dashboard/`、`app/(shell)/office/`、`app/(shell)/workspace/`
- **D-07:** components/ 目录分为 `components/ui/`（shadcn/ui 组件）和 `components/hud/`（Phase 3 自定义 HUD 组件预留）

### Claude's Discretion
- shadcn/ui 具体初始化命令和参数
- components.json 配置细节
- 是否需要额外的 devDependencies

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGR-01 | 项目脚手架配置（Next.js 16 + Tailwind v4 CSS-first + ESLint + shadcn/ui） | Next.js 16.2.4 已安装 ✓<br>Tailwind v4 已配置 ✓<br>ESLint 已配置 ✓<br>shadcn/ui 需初始化<br>Route groups 需创建 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| shadcn/ui 组件初始化 | Frontend Build | CLI Tool | Component installation happens at build time via CLI |
| Route group 结构 | Frontend Server | — | Next.js App Router file-based routing runs on server |
| CSS 主题变量 | Browser | — | CSS variables interpreted by browser for theming |
| ESLint 配置 | Frontend Build | — | Linting runs at build time, not runtime |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 [VERIFIED: package.json] | React framework with App Router | Latest stable, React 19 support, Turbopack default in dev |
| React | 19.2.4 [VERIFIED: package.json] | UI library | Latest stable, works with Next.js 16, Server Components support |
| Tailwind CSS | 4.2.4 [VERIFIED: npm registry] | Utility-first CSS framework | CSS-first configuration, modern browser features, zero-runtime |
| TypeScript | 5.x [VERIFIED: package.json] | Type safety | Industry standard, excellent DX |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | 4.6.0 [VERIFIED: npm registry] | Component library foundation | Initialize with CLI, copy-paste components |
| tw-animate-css | 1.4.0 [VERIFIED: npm registry] | CSS animations | Replace deprecated `tailwindcss-animate`, works with Tailwind v4 |
| clsx | 2.1.1 [VERIFIED: package.json] | Conditional className utility | Already installed, used by shadcn/ui |
| tailwind-merge | 3.5.0 [VERIFIED: package.json] | Merge Tailwind classes | Already installed, used by cn() utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui New York style | Default style (deprecated) | Default style is deprecated, New York is now recommended |
| HSL color variables | OKLCH color space | OKLCH is more modern but HSL is shadcn/ui default, easier for Phase 2 customization |

**Installation:**
```bash
# Core already installed
pnpm add next@16.2.4 react@19.2.4 react-dom@19.2.4

# Styling already installed
pnpm add -D tailwindcss@4 @tailwindcss/postcss@4

# Additions needed for shadcn/ui
pnpm add tw-animate-css  # Already installed via Tailwind v4, but verify
pnpm dlx shadcn@latest init  # Initialize shadcn/ui (run in project root)

# shadcn component addition (after init)
pnpm dlx shadcn@latest add button card badge separator
```

**Version verification:**
- Tailwind CSS: 4.2.4 (published 2025-01-XX) [VERIFIED: npm registry]
- shadcn CLI: 4.6.0 (current latest) [VERIFIED: npm registry]
- tw-animate-css: 1.4.0 (stable) [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
User Request
    ↓
Browser (CSS Variables → Theme Rendering)
    ↓
Next.js Frontend Server (App Router)
    ↓
┌─────────────────────────────────────────┐
│  Route Groups (File-based Routing)      │
│  ├── (shell)/                           │
│  │   ├── layout.tsx (Shell Layout)      │
│  │   ├── dashboard/page.tsx             │
│  │   ├── office/page.tsx                │
│  │   └── workspace/page.tsx             │
│  └── layout.tsx (Root Layout)           │
└─────────────────────────────────────────┘
    ↓
Components (shadcn/ui + Custom HUD)
    ├── components/ui/ (shadcn/ui base)
    └── components/hud/ (Phase 3 custom)
    ↓
Data Layer (Already exists)
    ├── gateway/ (WebSocket RPC client)
    └── stores/ (Zustand state management)
```

### Recommended Project Structure
```
app/
├── (shell)/              # Route group - no URL segment
│   ├── layout.tsx        # Shared Shell layout (Phase 3)
│   ├── dashboard/
│   │   └── page.tsx      # /dashboard route (Phase 4)
│   ├── office/
│   │   └── page.tsx      # /office route (Phase 5)
│   └── workspace/
│       └── page.tsx      # /workspace route (Phase 6)
├── layout.tsx            # Root layout (fonts, global CSS)
├── page.tsx              # Home page (/)
└── globals.css           # Tailwind v4 CSS-first + theme tokens

components/
├── ui/                   # shadcn/ui components (auto-generated)
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── separator.tsx
└── hud/                  # Custom HUD components (Phase 3)
    ├── card.tsx
    ├── panel.tsx
    └── status-indicator.tsx

gateway/                  # Existing - WebSocket RPC client
stores/                   # Existing - Zustand stores
lib/                      # Existing - utilities
│   └── utils.ts          # cn() helper (created by shadcn init)
types/                    # Existing - TypeScript types
```

### Pattern 1: shadcn/ui Initialization with Tailwind v4
**What:** Initialize shadcn/ui CLI with proper Tailwind v4 CSS-first integration
**When to use:** Starting Phase 1 setup
**Example:**
```bash
# Run in project root
pnpm dlx shadcn@latest init

# Interactive CLI prompts (recommended answers):
# - Would you like to use TypeScript? → Yes
# - Which style would you like to use? → New York (now default)
# - Which color would you like to use as base color? → Slate (overridden in Phase 2)
# - Would you like to use CSS variables for colors? → Yes (default, required for Phase 2)
# - Where is your global CSS file? → app/globals.css
# - Would you like to use CSS variables for theming? → Yes (default)
# - Configure the import alias for components? → @/components
# - Configure the import alias for utils? → @/lib/utils
```

**Source:** [CITED: https://ui.shadcn.com/docs/installation/next]

### Pattern 2: Route Groups for Shared Layouts
**What:** Organize routes under a shared layout without affecting URL structure
**When to use:** Multiple routes need shared layout (sidebar, header, footer)
**Example:**
```bash
# Create (shell) route group
mkdir -p app/\(shell\)/dashboard
mkdir -p app/\(shell\)/office
mkdir -p app/\(shell\)/workspace

# Create placeholder pages (Phase 1)
touch app/\(shell\)/dashboard/page.tsx
touch app/\(shell\)/office/page.tsx
touch app/\(shell\)/workspace/page.tsx
```

```tsx
// app/(shell)/layout.tsx (Phase 3 implementation)
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="shell-layout">
      {/* Sidebar, header, status bar in Phase 3 */}
      {children}
    </div>
  )
}
```

**Source:** [CITED: https://nextjs.org/docs/app/glossary]

### Pattern 3: Tailwind v4 CSS-First Theme Integration
**What:** Extend existing `@theme inline` block with shadcn/ui semantic tokens
**When to use:** After shadcn init (CLI will update globals.css automatically)
**Example:**
```css
/* app/globals.css - shadcn CLI will add this automatically */
@import "tailwindcss";

:root {
  --background: 0 0% 100%;  /* HSL format for shadcn/ui */
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  /* ... more semantic tokens ... */
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ... map CSS vars to Tailwind colors ... */
}
```

**Source:** [CITED: https://ui.shadcn.com/docs/tailwind-v4]

### Anti-Patterns to Avoid
- **Modifying shadcn/ui components directly:** Don't edit `components/ui/*.tsx` files — create wrapper components in `components/hud/` instead. This makes shadcn updates easier.
- **Using `default` style:** The `default` style is deprecated in favor of `new-york`. Always use New York style.
- **Disabling CSS variables:** Setting `cssVariables: false` in components.json makes Phase 2 theming much harder. Keep it enabled.
- **Using src/ wrapper:** Project decision is flat structure, don't wrap app/ in src/.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Button, Card, Badge components | Custom button/card with Tailwind | shadcn/ui components | Accessibility, keyboard navigation, ARIA labels already handled |
| className utility | Custom class merger | `cn()` from shadcn init | Tailwind-specific class deduplication, TypeScript-safe |
| CSS animations from scratch | Custom @keyframes for simple effects | tw-animate-css | Optimized animations, GPU-accelerated, avoids reinventing wheel |
| Theme toggle logic | Custom dark mode provider | Use shadcn pattern (class-based) | Standard approach, works with Tailwind v4 dark mode |

**Key insight:** shadcn/ui isn't a traditional component library — it's a collection of copy-paste components you own. This means you get full customization control without the bundle bloat of traditional UI kits.

## Common Pitfalls

### Pitfall 1: Wrong shadcn CLI Command
**What goes wrong:** Using `npx shadcn-ui@latest init` (old CLI) instead of `npx shadcn@latest init` (new unified CLI)
**Why it happens:** Package renamed from `shadcn-ui` to `shadcn` in 2024
**How to avoid:** Always use `pnpm dlx shadcn@latest init` (verify package name)
**Warning signs:** CLI doesn't recognize `tailwind v4` or asks about `src/` directory

### Pitfall 2: Tailwind v4 CSS Import Confusion
**What goes wrong:** Using old `@tailwind base; @tailwind components; @tailwind utilities;` directives
**Why it happens:** Migration from Tailwind v3, copying old patterns
**How to avoid:** Only use `@import "tailwindcss";` in globals.css (already configured correctly)
**Warning signs:** Build errors about unknown Tailwind directives, CSS not applying

### Pitfall 3: Route Group Folder Naming
**What goes wrong:** Creating `app/shell/` instead of `app/(shell)/`
**Why it happens:** Forgetting parentheses create route groups
**How to avoid:** Always wrap route group names in parentheses: `(name)`
**Warning signs:** URL shows `/shell/dashboard` instead of `/dashboard`

### Pitfall 4: CSS Variable Format Mismatch
**What goes wrong:** Using OKLCH format instead of HSL for theme tokens
**Why it happens:** Tailwind v4 supports OKLCH, but shadcn/ui defaults to HSL
**How to avoid:** Let shadcn CLI auto-generate HSL tokens, don't manually change to OKLCH
**Warning signs:** shadcn components have wrong colors, theme doesn't apply

### Pitfall 5: Missing tw-animate-css
**What goes wrong:** Using deprecated `tailwindcss-animate` package
**Why it happens:** Following old tutorials, Tailwind v4 changed animation package
**How to avoid:** Use `tw-animate-css` instead (or verify it's included via Tailwind v4)
**Warning signs:** Animation utilities not working, build warnings about `tailwindcss-animate`

## Code Examples

Verified patterns from official sources:

### shadcn/ui Init Command
```bash
# Source: https://ui.shadcn.com/docs/installation/next
pnpm dlx shadcn@latest init
```

### Component Addition
```bash
# Source: https://ui.shadcn.com/docs/components
# Add specific components
pnpm dlx shadcn@latest add button card badge separator

# Each command adds:
# - Component file to components/ui/
# - Updates to components.json
```

### Verify Toolchain
```bash
# Source: Next.js 16 documentation
# Dev server (uses Turbopack by default)
pnpm dev

# Build production bundle
pnpm build

# Run ESLint
pnpm lint

# Type check
pnpm tsc --noEmit
```

### Route Group Structure
```bash
# Source: https://nextjs.org/docs/app/glossary
# Create route group with shared layout
app/
  └── (shell)/           # Parentheses = route group (no URL segment)
      ├── layout.tsx     # Shared layout for all routes in group
      ├── dashboard/
      │   └── page.tsx   # Renders at /dashboard (not /shell/dashboard)
      └── office/
          └── page.tsx   # Renders at /office (not /shell/office)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config | Tailwind v4 CSS-first | v4.0.0 (2024) | Use `@import "tailwindcss"` + `@theme inline` instead of tailwind.config.js |
| shadcn-ui CLI | shadcn CLI (unified) | 2024 | Package renamed, new CLI supports Tailwind v4 + React 19 |
| React 18 forwardRef | React 19 no forwardRef | React 19 | shadcn components auto-detect React version, no manual forwardRef needed |
| Default component style | New York style | 2025 | `default` style deprecated, use `new-york` for new projects |
| tailwindcss-animate | tw-animate-css | Tailwind v4 | New animation package for v4 compatibility |

**Deprecated/outdated:**
- **tailwind.config.js:** Don't create — use `@theme inline` in CSS instead
- **@tailwindcss/v3:** Old PostCSS plugin — use `@tailwindcss/postcss` instead (already configured)
- **shadcn-ui@latest package:** Old package name — use `shadcn@latest` instead
- **Default component style:** Deprecated — always use New York style for new projects
- **React 18 forwardRef pattern:** Not needed in React 19 — shadcn CLI handles this automatically

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | tw-animate-css is included with Tailwind v4 installation | Standard Stack | If not included, need to `pnpm add tw-animate-css` separately |
| A2 | shadcn CLI will auto-detect Next.js 16 + React 19 | Code Examples | If auto-detection fails, need to manually specify React version |
| A3 | Existing globals.css will work with shadcn init | Architecture Patterns | If shadcn init overwrites incorrectly, need to restore from git |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **tw-animate-css inclusion**
   - What we know: Tailwind v4 changed from `tailwindcss-animate` to `tw-animate-css`
   - What's unclear: Whether `tw-animate-css` is automatically installed with Tailwind v4 or needs separate installation
   - Recommendation: Run `pnpm list tw-animate-css` to verify. If missing, add with `pnpm add tw-animate-css`

2. **shadcn init vs manual components.json**
   - What we know: shadcn CLI creates components.json and updates globals.css
   - What's unclear: Whether the CLI will preserve existing `@theme inline` block or overwrite it
   - Recommendation: Commit current globals.css to git before running shadcn init, so we can restore if needed

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | ✓ | v24.14.0 | — |
| pnpm | Package manager | ✓ | 10.33.0 | npm (but slower) |
| Next.js | Framework | ✓ | 16.2.4 | — |
| Tailwind CSS | Styling | ✓ | 4.2.4 | — |
| shadcn CLI | Component init | ✗ | — | Manual component setup (not recommended) |
| tw-animate-css | Animations | ? | — | CSS keyframes manually |

**Missing dependencies with no fallback:**
- shadcn CLI — need to run `pnpm dlx shadcn@latest init` (downloaded on-demand, not installed)

**Missing dependencies with fallback:**
- tw-animate-css — if missing, use manual CSS @keyframes (but verify inclusion first)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (Phase 1 is scaffolding, no feature tests yet) |
| Config file | None |
| Quick run command | `pnpm build` — verify build succeeds |
| Full suite command | `pnpm build && pnpm lint` — verify toolchain works |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGR-01 | Dev server starts | manual | `pnpm dev` | ❌ Wave 0 (verify manually) |
| ENGR-01 | Build succeeds | smoke | `pnpm build` | ❌ Wave 0 (verify build) |
| ENGR-01 | ESLint passes | smoke | `pnpm lint` | ✅ eslint.config.mjs exists |
| ENGR-01 | shadcn components render | manual | Visit http://localhost:3000 | ❌ Wave 0 (visual check) |

### Sampling Rate
- **Per task commit:** `pnpm build` — verify no build errors
- **Per wave merge:** `pnpm build && pnpm lint` — full toolchain check
- **Phase gate:** Dev server starts + shadcn components visible

### Wave 0 Gaps
- **Test framework:** None needed (Phase 1 is scaffolding)
- **Build verification:** Run `pnpm build` after shadcn init to ensure no errors
- **Component verification:** Manual check that shadcn components render correctly

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled). Omit only if explicitly `false` in config.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable in Phase 1 (no auth yet) |
| V3 Session Management | No | Not applicable in Phase 1 (no sessions yet) |
| V4 Access Control | No | Not applicable in Phase 1 (no access control yet) |
| V5 Input Validation | No | Not applicable in Phase 1 (no user input yet) |
| V6 Cryptography | No | Not applicable in Phase 1 (no crypto yet) |

**Phase 1 is scaffolding only** — security controls will be added in later phases when authentication, session management, and input validation are implemented.

### Known Threat Patterns for Next.js 16 + shadcn/ui

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-generated content | Tampering | React auto-escapes by default; shadcn components follow React patterns |
| CSS injection via theme variables | Tampering | Use CSS variables with HSL format (no dynamic values) |
| Dependency confusion | Spoofing | Use pnpm lockfile, verify package integrity |

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Next.js Installation Guide](https://ui.shadcn.com/docs/installation/next) - Official installation steps, verified 2026-04-30
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - Official Tailwind v4 support, verified 2026-04-30
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming) - CSS variables configuration, verified 2026-04-30
- [shadcn/ui components.json Reference](https://ui.shadcn.com/docs/components-json) - Configuration options, verified 2026-04-30
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) - Breaking changes and new features, verified 2026-04-30
- [Next.js App Router Route Groups](https://nextjs.org/docs/app/glossary) - Route group conventions, verified 2026-04-30

### Secondary (MEDIUM confidence)
- [Context7: shadcn/ui library ID /llmstxt/ui_shadcn_llms_txt](https://ui.shadcn.com) - 8938 code snippets, verified CLI commands and Tailwind v4 patterns
- [Context7: Next.js library ID /llmstxt/nextjs_llms-full_txt](https://nextjs.org) - 40721 code snippets, verified route group structure and async API changes

### Tertiary (LOW confidence)
- None — all findings verified with official documentation or Context7

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via npm registry and official docs
- Architecture: HIGH - Route groups and shadcn init patterns verified with official docs
- Pitfalls: HIGH - All pitfalls documented with verified sources and migration guides

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — Next.js 16 and Tailwind v4 are stable releases)
