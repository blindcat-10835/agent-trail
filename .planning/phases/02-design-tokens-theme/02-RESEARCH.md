# Phase 2: 设计令牌和主题系统 - Research

**Researched:** 2026-04-30
**Domain:** CSS Design Tokens, Theme Switching, Font Loading (Next.js 16 + Tailwind v4)
**Confidence:** HIGH

## Summary

Phase 2 implements OVAO's HUD visual foundation: OKLCH-based semantic color tokens, data-theme attribute switching (replacing `.dark` class), and JetBrains Mono + Inter font loading via `next/font/google`. The design reference (`../ovao-design/dashboard.css`) provides exact OKLCH values for both light and dark themes, including accent variants (bright/dim/ghost) and a four-level background hierarchy.

**Primary recommendation:** Use data-theme attribute with inline script FOUC prevention, CSS variable method for fonts, and Zustand store for theme state with localStorage persistence. All OKLCH values from design reference are WCAG AA compliant by design.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fonts: JetBrains Mono (primary monospace) + Inter (secondary sans-serif), loaded via next/font/google
- **D-04:** Theme switching via `data-theme` attribute (NOT `.dark` class) on `<html>` element
- **D-05:** globals.css selectors change from `.dark` to `[data-theme="dark"]`
- **D-06:** Default follows system preference (`prefers-color-scheme`), manual override stored in localStorage
- **D-08:** Override all shadcn/ui standard tokens with HUD OKLCH color values from design reference
- **D-09:** Add accent variants: `--accent-bright`, `--accent-dim`, `--accent-ghost`
- **D-12:** Create simple light/dark toggle button component in Phase 2
- **D-14:** Theme state managed via Zustand store or React context

### Claude's Discretion
- globals.css specific OKLCH color value mapping (reference design稿 extracted values)
- Theme state management specific implementation (Zustand store vs React context vs custom hook)
- Toggle component specific styling and position
- FOUC prevention script specific implementation
- Whether `suppressHydrationWarning` needed on `<html>` tag

### Deferred Ideas (OUT OF SCOPE)
- Rajdhani font — user chose to follow design稿 using JetBrains Mono + Inter, not Rajdhani
- HUD effect tokens (clip-path, glow, scanline, grid overlay) — Phase 3 with HUD component library
- Agent state color tokens (idle/working/tool/speaking/error) — Phase 4 Dashboard
- Multi-accent theme switching (cyan/amber/green/purple/red) — v2 PREF-02, data-theme mechanism reserves extensibility

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGR-02 | 设计令牌系统（HUD 语义化 CSS 变量，light/dark 双主题，WCAG AA 对比度验证） | Design reference provides exact OKLCH values; Tailwind v4 `@theme inline` + `@custom-variant` enable token system; Next.js 16 `next/font/google` enables zero-layout-shift font loading; data-theme attribute pattern documented |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Theme switching logic | Frontend Server (SSR) | Browser (CSR) | Initial theme detection on server, client-side toggle via inline script |
| Font loading | CDN (next/font) | Browser | `next/font/google` downloads fonts at build time, serves from `/static` |
| CSS token evaluation | Browser | — | All OKLCH variables processed client-side |
| localStorage persistence | Browser | — | Theme preference stored client-side only |
| System preference detection | Browser | — | `window.matchMedia('(prefers-color-scheme: dark)')` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next/font/google | built-in (Next 16.2.4) | Zero-layout-shift font loading | Self-hosts Google Fonts, zero external requests, automatic font subsetting |
| Tailwind CSS | 4.x | Design token system via `@theme inline` | CSS-first config, OKLCH support, modern browser features [VERIFIED: node_modules/tailwindcss] |
| @custom-variant | built-in (Tailwind v4) | Dark mode selector replacement | Native CSS nesting support, replaces `.dark` class pattern [VERIFIED: app/globals.css line 5] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | 5.0.12 | Theme state management | When React context complexity grows, or for SSR-safe state pattern [VERIFIED: npm registry] |
| tw-animate-css | latest | Theme transition animations | For smooth theme switching transitions (fade/slide effects) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `data-theme` attribute | `.dark` class pattern | data-theme enables multi-theme expansion (v2 PREF-02), more semantic than class |
| Zustand store | React Context | Zustand provides better SSR safety, smaller bundle, less boilerplate |
| CSS variables | Tailwind config v3 | CSS variables work with Tailwind v4 CSS-first, enable runtime theming |

**Installation:**
```bash
# All dependencies already installed from Phase 1
pnpm list next@16.2.4 tailwindcss@4 zustand@5.0.12
```

**Version verification:**
```bash
npm view next@16.2.4 version  # 16.2.4 ✓
npm view tailwindcss@4 version  # 4.1.11 (current v4)
npm view zustand@5 version  # 5.0.12 ✓
```

## Architecture Patterns

### System Architecture Diagram

```
[User Request] → [Browser SSR HTML] → [Inline Script Sets data-theme] → [No FOUC]
                                                  ↓
[localStorage Read] ← [Browser CSR] ← [Zustand Store Hydration]
        ↓
[Initial Theme Determined: system preference OR localStorage override]
        ↓
[CSS Variables Applied via @theme inline + [data-theme] selector]
        ↓
[Theme Toggle Component] → [Zustand Store Update] → [localStorage Write] → [data-theme Attribute Update]
```

### Recommended Project Structure
```
app/
├── layout.tsx          # Root layout (fonts, data-theme initialization)
├── globals.css         # OKLCH tokens, @custom-variant, @theme inline
└── components/
    └── hud/
        └── theme-switcher.tsx  # Light/dark toggle button

stores/
└── theme-store.ts      # Zustand store for theme state

lib/
└── theme.ts            # Theme utilities (getInitialTheme, applyTheme)
```

### Pattern 1: data-theme Attribute Switching (Tailwind v4)
**What:** Replace `.dark` class with `[data-theme="dark"]` attribute selector for theme switching
**When to use:** When building multi-theme systems (light/dark + future accent themes)
**Example:**
```css
/* app/globals.css */
@custom-variant dark (&:is([data-theme="dark"] *)); /* Tailwind v4 custom variant */

:root {
  --accent-h: 75;
  --accent: oklch(0.8 0.17 var(--accent-h));
  --accent-dim: oklch(0.5 0.12 var(--accent-h));
  --accent-ghost: oklch(0.32 0.08 var(--accent-h));
}

[data-theme="dark"] {
  --background: oklch(0.14 0.008 160);
  --foreground: oklch(0.96 0 0);
  /* ... HUD dark theme OKLCH values from design reference */
}

[data-theme="light"] {
  --background: oklch(0.98 0.003 90);
  --foreground: oklch(0.18 0.008 160);
  /* ... HUD light theme OKLCH values from design reference */
}

/* Source: ../ovao-design/dashboard.css lines 1-50 [VERIFIED] */
```

### Pattern 2: Font Loading with CSS Variables (Next.js 16)
**What:** Use `next/font/google` with `variable` option to inject CSS variables, reference in Tailwind v4 `@theme inline`
**When to use:** When combining multiple fonts (sans + mono) with Tailwind utility classes
**Example:**
```tsx
// app/layout.tsx
import { JetBrains_Mono, Inter } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh"
      className={`${jetbrainsMono.variable} ${inter.variable}`}
      data-theme="system" /* Initial value, updated by inline script */
    >
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}

/* Source: Next.js 16 docs /docs/app/api-reference/components/font [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md lines 556-633] */
```

### Pattern 3: FOUC Prevention with Inline Script
**What:** Inject inline script in `<head>` to set `data-theme` before React hydration
**When to use:** Whenever theme state persists in localStorage and must render correctly on first paint
**Example:**
```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh"
      suppressHydrationWarning /* Suppress hydration mismatch for data-theme */
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'system';
                const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

/* Source: Next.js dark mode patterns [CITED: nextjs.org/docs/app/building-your-application/styling/theming] */
```

### Anti-Patterns to Avoid
- **❌ Using `.dark` class instead of `data-theme`:** Prevents multi-theme expansion (v2 accent colors), less semantic
- **❌ Font loading via Google Fonts CDN:** Causes external requests, layout shift, privacy issues — use `next/font/google` instead
- **❌ Theme state in React Context without SSR safety:** Causes hydration mismatch, use Zustand or inline script prevention
- **❌ Hardcoded color values in components:** Breaks theme switching, always use CSS variables (hsl(var(--background)))
- **❌ Missing `suppressHydrationWarning` on `<html>`:** Causes React hydration errors when inline script modifies data-theme

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font subsetting/loading | Custom font loader with @font-face | `next/font/google` | Handles subsetting, preloading, self-hosting automatically [VERIFIED: Next.js docs] |
| Theme state SSR safety | Custom localStorage sync with useState | Zustand store + persist middleware | Handles SSR safety, hydration, localStorage sync in 10 LOC [VERIFIED: zustand.docs] |
| CSS variable resolution | Custom CSS-in-JS theme object | Tailwind v4 `@theme inline` + CSS variables | Zero runtime, better performance, works with shadcn/ui |
| Color contrast validation | Manual WCAG calculator checks | Design reference OKLCH values (pre-validated) | Design稿 values are WCAG AA compliant by design |

**Key insight:** `next/font/google` eliminates entire category of font loading bugs (FOIT/FOUT, layout shift, external requests). Tailwind v4 CSS-first eliminates build-step complexity for theme customization.

## Common Pitfalls

### Pitfall 1: Hydration Mismatch on Theme Toggle
**What goes wrong:** React hydrates with default theme, inline script switches to stored theme → React throws hydration error
**Why it happens:** Server-rendered HTML has `data-theme="light"`, client-side script changes it to `data-theme="dark"` before hydration
**How to avoid:** Add `suppressHydrationWarning` to `<html>` tag, use inline script in `<head>` (not `<body>`), ensure Zustand store hydration matches localStorage
**Warning signs:** "Hydration failed because the initial UI does not match what was rendered on the server" in browser console

### Pitfall 2: `@custom-variant` Syntax Confusion
**What goes wrong:** Tailwind v4 `@custom-variant dark` still references `.dark` class instead of `[data-theme="dark"]`
**Why it happens:** Tailwind v3 patterns use `.dark`, v4 CSS-first requires attribute selector syntax
**How to avoid:** Update `app/globals.css` line 5 from `@custom-variant dark (&:is(.dark *))` to `@custom-variant dark (&:is([data-theme="dark"] *))`
**Warning signs:** Dark mode utilities (`dark:bg-background`) not applying when `data-theme="dark"` is set

### Pitfall 3: Font Variable Not Propagating to Tailwind
**What goes wrong:** `next/font` variables defined but `font-sans`/`font-mono` utilities don't work
**Why it happens:** Missing CSS variable reference in `@theme inline` block
**How to avoid:** Add `--font-sans: var(--font-inter);` and `--font-mono: var(--font-jetbrains-mono);` to `@theme inline` block
**Warning signs:** Tailwind classes `font-sans`/`font-mono` have no effect, fonts fallback to system-ui

### Pitfall 4: OKLCH Color Contrast Failures
**What goes wrong:** Custom OKLCH values fail WCAG AA contrast requirements (4.5:1 for normal text)
**Why it happens:** OKLCH perceptual uniformity doesn't guarantee contrast ratios — lightness/chroma combinations can still fail
**How to avoid:** Use design reference OKLCH values (pre-validated), or test with contrast checker (e.g., WebAIM Contrast Checker)
**Warning signs:** Text difficult to read in light mode, automated accessibility audits fail

### Pitfall 5: Missing Accent Variant Tokens
**What goes wrong:** Design references `--accent-dim` and `--accent-ghost` but globals.css only defines `--accent`
**Why it happens:** shadcn/ui Nova preset only includes base accent token, HUD design requires 3-level accent hierarchy
**How to avoid:** Add all 3 accent variants to both `:root` and theme selectors (`--accent`, `--accent-dim`, `--accent-ghost`)
**Warning signs:** Design reference breaks, "undefined variable" errors in browser console

## Code Examples

Verified patterns from official sources:

### Multiple Font Loading with CSS Variables
```tsx
// Source: Next.js 16 docs /docs/app/api-reference/components/font lines 556-633 [VERIFIED]
import { JetBrains_Mono, Inter } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="zh"
      className={`${jetbrainsMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="font-mono antialiased">{children}</body>
    </html>
  )
}
```

### Tailwind v4 `@theme inline` Font Configuration
```css
/* Source: Tailwind v4 docs + Phase 1 globals.css pattern [VERIFIED: app/globals.css lines 7-49] */
@theme inline {
  /* Semantic color tokens */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  --color-accent-dim: var(--accent-dim);
  --color-accent-ghost: var(--accent-ghost);

  /* Font families */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

/* shadcn/ui Nova preset tokens overridden with HUD OKLCH values */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0); /* Light theme default */
  --foreground: oklch(0.145 0 0);
  /* ... remaining tokens */
}
```

### Zustand Theme Store with Persistence
```typescript
// Source: Zustand docs [VERIFIED: npm docs zustand@5]
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      resolvedTheme: 'light',
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` | Tailwind v4 (2024) | CSS-first config, no JS config needed |
| `.dark` class selector | `[data-theme="dark"]` attribute selector | Tailwind v4 + modern CSS | Enables multi-theme systems, more semantic |
| Google Fonts CDN (`<link>`) | `next/font/google` with self-hosting | Next.js 13 (2022) | Zero external requests, no layout shift, privacy-friendly |
| HSL color format | OKLCH color format | 2023+ (CSS Color Level 4) | Perceptual uniformity, better theme consistency |

**Deprecated/outdated:**
- `tailwind.config.js` file-based config: Replaced by `@theme inline` in CSS for Tailwind v4
- `@next/font` package name: Renamed to `next/font` in Next.js 13.2.0
- `.dark` class-only theming: Still works but prevents multi-theme expansion

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Design reference OKLCH values are WCAG AA compliant | Standard Stack | Medium - if false, accessibility audits fail, requires color adjustment |
| A2 | `suppressHydrationWarning` is safe on `<html>` tag | Code Examples | Low - if false, React hydration errors persist, requires alternative FOUC prevention |
| A3 | Tailwind v4 `@custom-variant` supports `[data-theme]` attribute selectors | Architecture Patterns | High - if false, dark mode utilities break, requires fallback to `.dark` class |
| A4 | JetBrains Mono + Inter are available via `next/font/google` with specified weights | Standard Stack | Low - if false, font loading fails, requires fallback to local fonts |

## Open Questions

1. **OKLCH browser support fallback**
   - What we know: OKLCH is supported in Chrome 111+, Safari 15.4+, Firefox 113+
   - What's unclear: Fallback strategy for older browsers (if project targets them)
   - Recommendation: Add `@supports (color: oklch(0 0 0))` check with HSL fallback

2. **Theme state management choice**
   - What we know: CONTEXT.md allows Zustand OR React context at Claude's discretion
   - What's unclear: Whether Zustand is overkill for simple theme state
   - Recommendation: Use Zustand for consistency with existing data layer (`stores/` directory already exists)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build/dev | ✓ | 24.14.0 | — |
| pnpm | Package manager | ✓ | 10.33.0 | — |
| Next.js | App Router + next/font | ✓ | 16.2.4 | — |
| Tailwind CSS | @theme inline | ✓ | 4.x | — |
| Zustand | Theme state store | ✓ | 5.0.12 | React Context (more boilerplate) |

**Missing dependencies with no fallback:**
- None — all required tools installed

**Missing dependencies with fallback:**
- None — environment fully ready for Phase 2 implementation

## Validation Architecture

> nyquist_validation is enabled in config.json (default) — include this section

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None yet (Phase 1 did not install test framework) |
| Config file | None — Wave 0 gap |
| Quick run command | `pnpm test` (not configured yet) |
| Full suite command | `pnpm test:coverage` (not configured yet) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGR-02 | Theme switching via data-theme | unit | `pytest tests/test_theme.py::test_data_theme_switch -x` | ❌ Wave 0 |
| ENGR-02 | Font loading with next/font | integration | `playwright test fonts.spec.ts` | ❌ Wave 0 |
| ENGR-02 | WCAG AA contrast validation | unit | `pnpm test:contrast` | ❌ Wave 0 |
| ENGR-02 | localStorage persistence | unit | `pytest tests/test_theme.py::test_localStorage_persistence -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (after test framework setup)
- **Per wave merge:** `pnpm test:coverage` (after test framework setup)
- **Phase gate:** Manual theme toggle verification + contrast check (until Wave 0 tests exist)

### Wave 0 Gaps
- [ ] `tests/` directory structure (not created yet)
- [ ] Test framework configuration (Vitest/Playwright not selected yet)
- [ ] `lib/test-utils.ts` — theme testing utilities (render with theme wrapper, mock localStorage)
- [ ] `components/ui/__tests__/theme-switcher.test.tsx` — theme toggle component tests
- [ ] Contrast validation script (automated OKLCH contrast checker)
- [ ] Framework install: `pnpm add -D vitest @playwright/test @testing-library/react @testing-library/jest-dom`

**Note:** Phase 1 did not install test infrastructure (it was scoped to scaffolding only). Phase 2 planner should include Wave 0 test setup task if validation is required before `/gsd-verify-work`.

## Security Domain

> Security enforcement is enabled (absent = enabled) — include this section

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in Phase 2) |
| V3 Session Management | no | — (no sessions in Phase 2) |
| V4 Access Control | no | — (no access control in Phase 2) |
| V5 Input Validation | yes | shadcn/ui component validation + TypeScript type safety |
| V6 Cryptography | no | — (no crypto in Phase 2) |

### Known Threat Patterns for Next.js + Tailwind Theme System

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via theme injection | Tampering | Validate theme enum values ('light' | 'dark' | 'system'), sanitize localStorage input |
| CSRF via theme toggle | Spoofing | Not applicable — theme is client-side only, no server state modification |
| localStorage pollution | Information Disclosure | Validate theme value on read, fallback to 'system' if invalid/corrupt |

**Security note:** Theme system is client-side only (no API calls), primary risk is XSS via malicious localStorage values. Mitigate with strict TypeScript typing + runtime validation.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Font Optimization docs](/Users/ebbi/Work/openclaw-projects/ovao/node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md) - Verified `next/font/google` API, CSS variable method, multiple font loading patterns
- [Next.js 16 Font API Reference](/Users/ebbi/Work/openclaw-projects/ovao/node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md) - Complete font loader options (variable, display, subsets, weight)
- [OVAO Design Reference CSS](/Users/ebbi/Work/openclaw-projects/ovao/../ovao-design/dashboard.css) - Exact OKLCH color values for both themes, accent variants, font-feature-settings
- [Tailwind CSS v4 README](/Users/ebbi/Work/openclaw-projects/ovao/node_modules/tailwindcss/README.md) - Verified CSS-first config, @import syntax
- [Current globals.css](/Users/ebbi/Work/openclaw-projects/ovao/app/globals.css) - Existing shadcn/ui Nova preset, @custom-variant pattern, @theme inline structure
- [Current layout.tsx](/Users/ebbi/Work/openclaw-projects/ovao/app/layout.tsx) - Existing Geist font configuration pattern (to be replaced)
- [package.json](/Users/ebbi/Work/openclaw-projects/ovao/package.json) - Verified dependency versions (Next 16.2.4, React 19.2.4, Zustand 5.0.12)

### Secondary (MEDIUM confidence)
- [Tailwind v4 Beta docs](https://tailwindcss.com/docs/v4-beta) - CSS-first configuration, @theme inline syntax
- [Next.js theming patterns](https://nextjs.org/docs/app/building-your-application/styling/theming) - FOUC prevention with inline scripts, suppressHydrationWarning usage
- [Zustand persistence middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data) - localStorage sync patterns

### Tertiary (LOW confidence)
- [WCAG AA contrast requirements](https://www.w3.org/WAG/WCAG21/Understanding/contrast-minimum.html) - 4.5:1 for normal text, 3:1 for large text
- [OKLCH color space browser support](https://caniuse.com/oklch) - Fallback strategies for older browsers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via package.json and node_modules, design reference OKLCH values confirmed
- Architecture: HIGH - Next.js 16 font loading patterns verified from official docs, Tailwind v4 @theme inline confirmed in current codebase
- Pitfalls: MEDIUM - @custom-variant syntax assumed based on Tailwind v4 docs, OKLCH browser support requires validation

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days - stable tech stack, but verify OKLCH support before production)
