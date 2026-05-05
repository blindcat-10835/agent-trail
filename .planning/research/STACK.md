# Technology Stack

**Project:** OVAO (OpenClaw Visual Agents Office)
**Researched:** 2026-04-30
**Overall confidence:** HIGH

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.2.4 | React framework with App Router | Latest stable, React 19 support, built-in font optimization, improved CSS handling |
| React | 19.2.4 | UI library | Latest stable, works with Next.js 16, Server Components support |
| TypeScript | 5.x | Type safety | Industry standard, excellent DX, caught in build-time |

### Styling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS framework | CSS-first configuration with `@import`, modern browser features, zero-runtime |
| tw-animate-css | latest | CSS animations | Replaces deprecated `tailwindcss-animate`, works with Tailwind v4 |
| shadcn/ui | latest | Component library foundation | Copy-paste components, full customization control, Tailwind v4 support |

### State & Data
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.12 | State management | Already in use, minimal boilerplate, TypeScript-first |
| WebSocket (ws) | 8.20.0 | Real-time data transport | Already in use, stable data layer connection to Gateway |

### Tooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Biome | latest | Linter + formatter | Replaces ESLint/Prettier, 10-100x faster, unified config, CSS support |
| pnpm | latest | Package manager | Efficient disk space usage, strict dependency management |

### Fonts
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| next/font/google | built-in | Font optimization | Automatic self-hosting, zero layout shift, privacy-friendly |
| Rajdhani | Google Font | Headings/display | Cyberpunk aesthetic, technical feel, excellent readability at small sizes |
| JetBrains Mono | Google Font | Code/data | Monospace for logs/terminal, excellent ligature support, designed for code |

## Installation

```bash
# Core (already installed)
pnpm add next@16.2.4 react@19.2.4 react-dom@19.2.4 zustand@5.0.12 ws@8.20.0

# Styling (already installed)
pnpm add -D tailwindcss@4 @tailwindcss/postcss@4

# Additions needed
pnpm add tw-animate-css  # CSS animations
pnpm add -D @biomejs/biome  # Linter/formatter
pnpm add -D @types/node@20 @types/react@19 @types/react-dom@19 @types/ws@8.18.1

# shadcn/ui CLI (init after project setup)
pnpm dlx shadcn@latest init
```

## Tailwind v4 CSS-First Configuration

**Confidence: HIGH**

Tailwind v4 introduces a breaking change from v3: **CSS-first configuration** using `@import` instead of JavaScript config files.

### Global CSS Structure

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

/* Custom variant for dark mode */
@custom-variant dark (&:is(.dark *));

/* Design tokens - HUD Cyberpunk Theme */
@theme inline {
  /* Semantic color tokens (mapping CSS vars to Tailwind colors) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* HUD-specific colors */
  --color-cyan: var(--cyan);
  --color-amber: var(--amber);
  --color-green: var(--green);
  --color-red: var(--red);

  /* Border radius - using clip-path instead, but keeping for shadcn components */
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  /* Spacing scale (can be customized if needed) */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}

/* Light mode tokens */
:root {
  --radius: 0.625rem;

  /* HUD Light Theme - High contrast, cool tones */
  --background: hsl(210 40% 96%);     /* Light blue-gray */
  --foreground: hsl(210 20% 15%);     /* Dark blue-gray */
  --card: hsl(210 40% 98%);
  --card-foreground: hsl(210 20% 15%);
  --primary: hsl(210 80% 50%);        /* Bright blue */
  --primary-foreground: hsl(0 0% 100%);
  --muted: hsl(210 30% 90%);
  --muted-foreground: hsl(210 15% 45%);
  --accent: hsl(210 70% 55%);
  --accent-foreground: hsl(0 0% 100%);
  --border: hsl(210 30% 80%);
  --input: hsl(210 30% 80%);
  --ring: hsl(210 80% 50%);

  /* HUD status colors - light mode */
  --cyan: hsl(192 95% 65%);   /* Working */
  --amber: hsl(35 95% 60%);   /* Speaking */
  --green: hsl(150 75% 45%);  /* Tool/Online */
  --red: hsl(350 85% 60%);    /* Error/Offline */
}

/* Dark mode tokens */
.dark {
  /* HUD Dark Theme - Deep space, neon accents */
  --background: hsl(210 30% 8%);      /* Deep blue-black */
  --foreground: hsl(210 20% 85%);     /* Light blue-gray */
  --card: hsl(210 25% 12%);
  --card-foreground: hsl(210 20% 85%);
  --primary: hsl(210 80% 55%);        /* Electric blue */
  --primary-foreground: hsl(210 30% 8%);
  --muted: hsl(210 25% 16%);
  --muted-foreground: hsl(210 15% 50%);
  --accent: hsl(210 75% 60%);
  --accent-foreground: hsl(210 30% 8%);
  --border: hsl(210 25% 25%);
  --input: hsl(210 25% 25%);
  --ring: hsl(210 80% 55%);

  /* HUD status colors - dark mode (more vibrant) */
  --cyan: hsl(192 100% 70%);  /* Working - neon cyan */
  --amber: hsl(35 100% 65%);   /* Speaking - amber glow */
  --green: hsl(150 85% 50%);   /* Tool/Online - neon green */
  --red: hsl(350 90% 65%);     /* Error/Offline - neon red */
}
```

### PostCSS Configuration

```javascript
// postcss.config.mjs (already configured)
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**Key changes from Tailwind v3:**
- ❌ No `tailwind.config.js` for basic customization
- ✅ Use `@import "tailwindcss"` in CSS
- ✅ Use `@theme inline` block in CSS for custom values
- ✅ CSS custom properties (`--var`) instead of JS config
- ✅ Modern browser features (CSS nesting, `@custom-variant`)

## shadcn/ui Customization Strategy

**Confidence: HIGH**

shadcn/ui is **not** a component library in the traditional sense — it's a collection of copy-paste components you own. This is perfect for our cyberpunk HUD theme.

### Initialization

```bash
# Initialize shadcn/ui (run after Tailwind v4 setup)
pnpm dlx shadcn@latest init

# Interactive prompts:
# - Style: Default
# - Base color: Slate (we'll override with HUD colors)
# - CSS variables: Yes
```

This creates:
- `components/ui/` directory with components
- `lib/utils.ts` with `cn()` helper
- Updates `app/globals.css` with theme tokens

### Theme Customization for Cyberpunk HUD

**Strategy:** Override shadcn's CSS variables instead of modifying component code.

```css
/* Add to app/globals.css after @theme block */

/* Clip-path tokens for HUD corners */
:root {
  --clip-sm: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --clip-md: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px));
  --clip-lg: polygon(0 20px, 20px 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0 calc(100% - 20px));
}

/* HUD utility classes */
@layer components {
  .hud-card {
    clip-path: var(--clip-md);
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    position: relative;
  }

  .hud-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 40%, hsl(var(--cyan) / 0.05) 50%, transparent 60%);
    pointer-events: none;
  }

  .hud-btn {
    clip-path: var(--clip-sm);
    border: 1px solid hsl(var(--border));
    transition: all 0.2s ease;
  }

  .hud-btn:hover {
    border-color: hsl(var(--cyan));
    color: hsl(var(--cyan));
    box-shadow: 0 0 12px hsl(var(--cyan) / 0.3);
  }

  .hud-text-glow {
    text-shadow: 0 0 12px currentColor;
  }

  .hud-border-glow {
    box-shadow: 0 0 8px hsl(var(--cyan) / 0.4), inset 0 0 8px hsl(var(--cyan) / 0.1);
  }
}
```

### Component Overrides

When you add a shadcn component:

```bash
pnpm dlx shadcn@latest add button card dialog
```

**DO NOT** modify `components/ui/` files directly. Instead:

```tsx
// app/components/hud-button.tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function HudButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn("hud-btn", className)}
      {...props}
    />
  )
}
```

**Why this approach:**
- ✅ Easy to update shadcn components (just copy-paste new version)
- ✅ Consistent HUD styling via wrapper components
- ✅ Keep shadcn/ui pristine for future upgrades
- ✅ TypeScript-safe with full type forwarding

### Custom Components Not from shadcn

Some HUD components won't exist in shadcn — build them from scratch:

```tsx
// app/components/scanline-overlay.tsx
export function ScanlineOverlay() {
  return (
    <>
      {/* Grid overlay */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="size-full"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--cyan) / 0.028) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--cyan) / 0.028) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Scanline effect */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)",
        }}
      />
    </>
  )
}
```

## Font Integration with Next.js 16

**Confidence: HIGH**

Next.js 16 + React 19 have excellent built-in font optimization via `next/font`. **No external requests to Google Fonts.**

### Root Layout Configuration

```tsx
// app/layout.tsx
import { Rajdhani, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Configure fonts
const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
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
      className={`${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-rajdhani antialiased">
        {children}
      </body>
    </html>
  )
}
```

### Tailwind Font Configuration

Add to your `@theme inline` block:

```css
@theme inline {
  /* ... other tokens ... */

  /* Font families */
  --font-family-sans: var(--font-rajdhani), system-ui, sans-serif;
  --font-family-mono: var(--font-mono), ui-monospace, monospace;
}
```

Now use in components:

```tsx
<div className="font-sans text-lg">Agent Dashboard</div>
<div className="font-mono text-sm">[LOG] Connection established</div>
```

**Why `next/font/google` instead of Google Fonts CDN:**
- ✅ Zero external requests (fonts self-hosted from `/static`)
- ✅ No layout shift (automatic font-size adjustment)
- ✅ Privacy-friendly (no requests to Google servers)
- ✅ Automatic font subsetting (smaller file sizes)
- ✅ Preload hints (fonts load early in critical path)

### Font Usage Guidelines

| Context | Font | Weight | Size | Line Height |
|---------|------|--------|------|-------------|
| Headings, titles | Rajdhani | 600-700 | 2xl-4xl | tight (1.1-1.2) |
| Body text, labels | Rajdhani | 400-500 | base-lg | normal (1.5-1.6) |
| Code, logs, data | JetBrains Mono | 400-500 | sm-base | normal (1.5) |
| Navigation | Rajdhani | 500-600 | xs-sm | normal (1.4) |

## CSS Animation Patterns

**Confidence: MEDIUM**

For cyberpunk HUD effects, use **pure CSS animations** (no heavy JS libraries needed).

### Built-in with tw-animate-css

```bash
pnpm add tw-animate-css
```

```css
@import "tw-animate-css";

/* Available animations */
<button className="animate-pulse">  /* Blink effect */
<button className="animate-spin">   /* Radar sweep */
<div className="animate-ping">     /* Ping animation */
```

### Custom HUD Animations

```css
/* Add to app/globals.css after @theme block */

@keyframes hud-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

@keyframes hud-sweep {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes hud-ping {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(2.4); opacity: 0; }
}

@keyframes hud-glow {
  0%, 100% { box-shadow: 0 0 8px hsl(var(--cyan) / 0.4); }
  50% { box-shadow: 0 0 20px hsl(var(--cyan) / 0.7); }
}

@keyframes hud-scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@layer components {
  .animate-hud-blink { animation: hud-blink 2s ease-in-out infinite; }
  .animate-hud-sweep { animation: hud-sweep 4s linear infinite; }
  .animate-hud-ping { animation: hud-ping 2s ease-out infinite; }
  .animate-hud-glow { animation: hud-glow 3s ease-in-out infinite; }
  .animate-hud-scanline { animation: hud-scanline 8s linear infinite; }
}
```

### Performance Considerations

- ✅ **Use `transform` and `opacity`** (GPU-accelerated)
- ❌ **Avoid animating `width`/`height`/`top`/`left`** (reflows)
- ✅ **Prefer `will-change` for complex animations** (hint to browser)
- ✅ **Use `prefers-reduced-motion`** (accessibility)

```css
@media (prefers-reduced-motion: reduce) {
  .animate-hud-blink,
  .animate-hud-sweep,
  .animate-hud-glow {
    animation: none;
  }
}
```

### What NOT to Use

| Library | Why NOT to use |
|---------|----------------|
| framer-motion | Too heavy (200KB+), overkill for simple HUD animations |
| react-spring | Complex API, not needed for CSS animations |
| GSAP | Not tree-shakeable, large bundle size |
| auto-animate | Too magical, breaks with complex layouts |

**Stick to:** CSS transitions + `tw-animate-css` + custom `@keyframes`

## Biome Configuration

**Confidence: HIGH**

Biome replaces ESLint + Prettier with a unified, ultra-fast toolchain.

### Installation

```bash
pnpm add -D @biomejs/biome
```

### Configuration

```json
// biome.json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["node_modules", ".next", "out"]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 100,
    "attributePosition": "auto"
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "a11y": "warn",
      "complexity": "warn",
      "correctness": "error",
      "performance": "warn",
      "security": "error",
      "style": "warn",
      "suspicious": "warn"
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "es5",
      "semicolons": "asNeeded",
      "arrowParentheses": "asNeeded",
      "bracketSpacing": true,
      "bracketSameLine": false
    },
    "globals": ["React"]
  },
  "css": {
    "formatter": {
      "enabled": true
    },
    "parser": {
      "cssModules": true,
      "tailwindDirectives": true
    }
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "check": "biome check --write . && tsc --noEmit"
  }
}
```

### IDE Integration

**VS Code:**
```bash
code --install-extension biomejs.biome
```

**Settings:**
```json
{
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[css]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

**Why Biome over ESLint + Prettier:**
- ✅ **100x faster** (written in Rust)
- ✅ **Unified config** (no ESLint + Prettier conflicts)
- ✅ **CSS support** (formats Tailwind @theme blocks)
- ✅ **Auto-import organization** (built-in, no separate plugin)
- ✅ **Type-aware linting** (works with TS without extra config)

## Next.js 16 App Router Conventions

**Confidence: HIGH**

### Key Differences from Next.js 14

| Feature | Next.js 14 | Next.js 16 | Impact |
|---------|-----------|-----------|--------|
| React version | React 18 | React 19 | New JSX transform, no forwardRef needed |
| CSS imports | `@tailwindcss/v3` | `@import "tailwindcss"` | CSS-first config |
| Font handling | `next/font` | `next/font` (unchanged) | Same API |
| Server Components | Stable | Stable + improvements | Better streaming |
| Turbopack | Beta | Stable in dev | Faster dev server |

### Breaking Changes to Watch

**1. React 19 forwardRef removal**

shadcn/ui components for React 19 **no longer use forwardRef**:

```tsx
// OLD (React 18 + shadcn/ui)
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn(className)} {...props} />
  )
)
Button.displayName = "Button"

// NEW (React 19 + shadcn/ui)
function Button({ className, ...props }: ButtonProps) {
  return <button className={cn(className)} {...props} />
}
```

**Action:** When adding shadcn components, use the CLI — it auto-detects React version.

**2. Tailwind v4 CSS imports**

```tsx
// OLD (Tailwind v3)
import './globals.css'
// globals.css: @tailwind base; @tailwind components; @tailwind utilities;

// NEW (Tailwind v4)
import './globals.css'
// globals.css: @import "tailwindcss";
```

**3. Turbopack default in dev**

Next.js 16 uses Turbopack by default in development (`next dev --turbo`).

**Benefits:**
- 100x faster HMR
- Faster initial build
- Better error messages

**Caveats:**
- Some CSS-in-JS libraries may not work (not a concern — we use Tailwind)
- SWC minifier instead of Terso (usually transparent)

### App Router File Conventions

```
app/
├── layout.tsx          # Root layout (fonts, global CSS)
├── page.tsx            # Home page (/)
├── globals.css         # Global styles (Tailwind, theme tokens)
├── dashboard/
│   ├── layout.tsx      # Dashboard-specific layout
│   └── page.tsx        # /dashboard route
├── office/
│   └── page.tsx        # /office route
├── workspace/
│   └── [agentId]/
│       └── page.tsx    # /workspace/123 route
└── components/         # Co-located components (if small)
```

**Key rules:**
- ✅ `layout.tsx` wraps child routes
- ✅ `page.tsx` renders for a route
- ✅ `loading.tsx` shows instant loading skeleton (React Suspense)
- ✅ `error.tsx` catches errors in subtree
- ✅ `not-found.tsx` for 404s

### Server vs Client Components

**Default: Server Components** (`async` functions work)

```tsx
// app/dashboard/page.tsx (Server Component by default)
import { AgentGrid } from './agent-grid' // Must be Client Component if it uses useState

export default async function DashboardPage() {
  // Can fetch data directly here
  const agents = await fetchAgents()

  return <AgentGrid agents={agents} />
}
```

**Client Components** (interactive):

```tsx
// app/dashboard/agent-grid.tsx
'use client'

import { useState } from 'react'

export function AgentGrid({ agents }: { agents: Agent[] }) {
  const [filter, setFilter] = useState('all')

  return (
    <div>
      <button onClick={() => setFilter('active')}>Active</button>
      {/* ... */}
    </div>
  )
}
```

**Rule of thumb:**
- Use Server Components by default (faster, smaller bundles)
- Add `'use client'` only when needed (useState, useEffect, event handlers)
- Keep Client Components at leaves of component tree

### Data Fetching Patterns

```tsx
// Server Component - direct async/await
export default async function Page() {
  const data = await fetch('https://api.example.com/data').then(r => r.json())

  return <div>{data.name}</div>
}

// With revalidation
export const revalidate = 60 // Revalidate every 60s

export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }
  }).then(r => r.json())

  return <div>{data.name}</div>
}
```

**For OVAO:**
- WebSocket connection must be in **Client Component**
- Zustand stores work in **Client Components**
- Agent data fetched via WebSocket (not server fetch)

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Styling | Tailwind v4 | CSS-in-JS (styled-components, emotion) | Runtime overhead, larger bundles, harder to customize shadcn |
| Animations | CSS + tw-animate-css | framer-motion | 200KB+ for simple effects, overkill for HUD |
| Fonts | next/font/google | Google Fonts CDN | External requests, layout shift, privacy concerns |
| Linter | Biome | ESLint + Prettier | 100x slower, separate configs, conflicts |
| State | Zustand | Redux Toolkit | More boilerplate, overkill for UI state |
| Components | shadcn/ui | Chakra UI, MUI | Harder to customize theme, larger bundles, less control |

## Sources

### Primary Sources (HIGH confidence)
- [Next.js 16 Documentation](https://github.com/vercel/next.js/tree/canary/docs) - Official docs, accessed 2026-04-30
- [Tailwind CSS v4 Beta](https://tailwindcss.com/docs/v4-beta) - Official docs, verified CSS-first config
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4) - Official migration guide, verified React 19 changes
- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/) - Official config docs
- [OVAO Design Reference](../ovao-design/dashboard-hud.html) - Project design spec

### Context7 Sources (HIGH confidence)
- Next.js library ID: `/vercel/next.js` - Version 16.2.4 verified
- shadcn/ui library ID: `/llmstxt/ui_shadcn_llms_txt` - Latest Tailwind v4 patterns
- Verified font optimization via `next/font/google`
- Verified CSS import patterns for App Router

### Implementation Notes (MEDIUM confidence)
- Based on official documentation and Context7 verification
- All version numbers verified via package.json and official sources
- Code examples follow latest Next.js 16 + React 19 patterns
- Cyberpunk HUD design tokens derived from project's dashboard-hud.html reference

### Gaps Requiring Validation
- **Performance testing**: Tailwind v4 CSS-first config needs real-world testing
- **Browser support**: Verify OKLCH color space coverage in target browsers
- **Animation performance**: Test CSS animations on lower-end devices
- **Font loading**: Verify Rajdhani + JetBrains Mono render correctly across platforms

## Migration Checklist

When implementing this stack:

- [ ] Install Tailwind v4 + tw-animate-css
- [ ] Convert to CSS-first configuration (remove tailwind.config.js if exists)
- [ ] Set up HUD theme tokens in `app/globals.css`
- [ ] Initialize shadcn/ui with CLI
- [ ] Configure Rajdhani + JetBrains Mono via next/font
- [ ] Set up Biome (replace ESLint if present)
- [ ] Add custom HUD utility classes (clip-path, glow effects)
- [ ] Test scanline + grid overlay performance
- [ ] Verify light/dark mode color contrast
- [ ] Run `biome check --write .` to format codebase
- [ ] Test font loading (check network tab for zero external requests)
- [ ] Validate Tailwind v4 build output (check CSS bundle size)
