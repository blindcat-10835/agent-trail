# Pitfalls Research

**Domain:** Cyberpunk HUD Dashboard with Next.js 16 + Tailwind v4 + shadcn/ui
**Researched:** 2026-04-30
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Animation Performance Death Spiral

**What goes wrong:**
Multiple CSS animations (scanlines, grid overlays, glow effects, pulsing elements) running simultaneously cause janky scrolling, delayed interactions, and battery drain. Frame rates drop below 30fps on mid-range devices.

**Why it happens:**
Developers treat CSS animations as "free" and layer them without considering:
- `will-change` property creates new compositing layers for each animated element
- `box-shadow` animations trigger expensive repaints
- Scanline overlays using `background-position` animate full viewport
- Glow effects with `filter: drop-shadow` affect entire element subtree
- Multiple animations compound GPU memory usage

**How to avoid:**
```css
/* ✅ GOOD: Animate transform/opacity only */
.hud-card {
  will-change: transform, opacity;
  transition: transform 0.2s ease;
}

/* ❌ BAD: Animate expensive properties */
.hud-card {
  will-change: box-shadow, filter; /* Triggers repaint */
  animation: glow-pulse 2s infinite; /* Recomputes shadows */
}
```

**Use `transform` and `opacity` for animations — they're compositing-only.**
**Batch animations using CSS containment with `content-visibility: auto`.**
**Use `prefers-reduced-motion` media query to disable animations entirely.**

**Warning signs:**
- Chrome DevTools Performance panel shows long (50ms+) painting tasks
- Scrolling feels "heavy" or delayed
- Browser task manager shows high GPU memory usage
- Lighthouse Performance score < 80

**Phase to address:**
M1 (Scaffolding & Design Tokens) — establish animation patterns and performance budgets before building pages.

---

### Pitfall 2: WCAG Contrast Violations with Neon Aesthetics

**What goes wrong:**
Neon cyan/magenta on dark backgrounds fail WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text). Screen reader users can't read critical data, and low-vision users struggle with luminance contrast.

**Why it happens:**
Cyberpunk aesthetic prioritizes visual impact over accessibility:
- Neon colors (`#00ffff`, `ff00ff`) have low luminance
- Dark backgrounds (`#0a0a0a`) reduce perceived contrast
- Glow effects reduce effective contrast by adding lightness
- Text shadows intended for "readability" actually blur edges

**How to avoid:**
```css
/* ✅ GOOD: Semantic tokens with contrast-checked values */
:root {
  --color-text-primary: #e0e0e0; /* 16:1 on #0a0a0a */
  --color-text-secondary: #a0a0a0; /* 7:1 on #0a0a0a */
  --color-accent-primary: #00d9ff; /* 4.6:1 on #0a0a0a — meets AA */
}

/* ❌ BAD: Pure neon without contrast adjustment */
.hud-text {
  color: #00ffff; /* 2.1:1 on #0a0a0a — fails WCAG AA */
}
```

**Use a contrast checker tool during design token creation.**
**Test both light and dark themes — neon on light backgrounds is worse.**
**Provide a "high contrast" theme variant for accessibility.**

**Warning signs:**
- Axe DevTools or Lighthouse flags contrast violations
- Manual testing with Windows High Contrast Mode breaks the UI
- Users report readability issues in bright environments
- Color blindness simulators show indistinguishable states

**Phase to address:**
M1 (Scaffolding & Design Tokens) — validate contrast ratios before locking in semantic tokens.

---

### Pitfall 3: Tailwind v4 Configuration Migration Breaking Changes

**What goes wrong:**
Tailwind v3's `tailwind.config.js` doesn't work in v4. Custom theme values, plugins, and preset configurations break silently. Build fails with cryptic "CSS import" errors.

**Why it happens:**
Tailwind v4 is CSS-first, not config-first:
- `@theme` directive replaces `tailwind.config.js`
- No `theme.extend` — CSS variables define custom values
- Built-in values changed (e.g., spacing scale)
- Plugin API changed completely
- JIT is now the only mode

**How to avoid:**
```css
/* ✅ GOOD: Tailwind v4 CSS-first config */
@import "tailwindcss";

@theme {
  --color-neon-cyan: #00d9ff;
  --font-hud: "Rajdhani", sans-serif;
  --animate-scanline: scanline 8s linear infinite;
}

/* ❌ BAD: Tailwind v3 config (won't work in v4) */
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        neonCyan: '#00d9ff',
      },
    },
  },
}
```

**Read the Tailwind v4 upgrade guide before starting.**
**Use `@theme` for all custom values.**
**Migrate plugins to vanilla CSS or wait for v4-compatible alternatives.**

**Warning signs:**
- Build errors mentioning "Cannot find module 'tailwindcss/config'"
- Custom classes not being generated
- Intellisense not recognizing custom values
- Changes to `tailwind.config.js` have no effect

**Phase to address:**
M1 (Scaffolding & Design Tokens) — configure Tailwind v4 correctly from the start, avoid v3 patterns.

---

### Pitfall 4: shadcn/ui Over-Customization Anti-Pattern

**What goes wrong:**
Deep customization of shadcn/ui components (overriding styles, wrapping in complex layout components) creates a fork that can't be updated. Breaking changes cascade when updating shadcn/ui.

**Why it happens:**
Developers treat shadcn/ui as a base library rather than copy-paste components:
- Override component styles using `!important` or deep selectors
- Wrap components in layout-specific containers
- Modify component internals directly
- Create custom variants by duplicating component code

**How to avoid:**
```tsx
// ✅ GOOD: Use shadcn/ui as-is with className props
import { Card } from "@/components/ui/card"

function HudCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="clip-path-polygon bg-neon-border">
      {children}
    </Card>
  )
}

// ❌ BAD: Override shadcn internals
import { Card } from "@/components/ui/card"
import styles from "./hud-card.module.css" // Overrides Card internals

function HudCard({ children }: { children: React.ReactNode }) {
  return <Card className={styles.overrideEverything}>{children}</Card>
}
```

**Accept shadcn/ui components as they are or copy and modify.**
**Use `className` and variant props for customization, not style overrides.**
**For radical changes, create new components rather than force shadcn/ui to fit.**

**Warning signs:**
- `!important` in component styles
- Deep selectors like `.card > div > span`
- Merge conflicts when updating shadcn/ui components
- Inability to use shadcn/ui theming system

**Phase to address:**
M1 (Scaffolding & Design Tokens) — decide which shadcn/ui components to use as-is vs. replace entirely.

---

### Pitfall 5: Next.js 16 Client Component Boundary Bleed

**What goes wrong:**
Accidentally converting Server Components to Client Components by importing client-only libraries (Zustand stores, browser APIs) in files without `'use client'`. Bundle size explodes, hydration errors occur, and server-side optimizations are lost.

**Why it happens:**
Next.js 16 App Router's boundary system is implicit:
- Adding `'use client'` to a file marks **all imports** as client-only
- Importing a Client Component into a Server Component is fine
- Importing a Server Component into a Client Component requires passing as `children` prop
- Zustand hooks require `'use client'` but are easy to use in Server Components by mistake

**How to avoid:**
```tsx
// ✅ GOOD: Client Component isolated to interactivity
'use client'

import { useAgentStore } from "@/stores/agent"

export function AgentStatus() {
  const agents = useAgentStore((state) => state.agents)
  return <div>{agents.length} agents</div>
}

// ❌ BAD: 'use client' on data-fetching component
'use client'

import { getAgents } from "@/lib/db" // Server-only code!

export default async function Page() {
  const agents = await getAgents() // 💥 Hydration error
  return <AgentList agents={agents} />
}
```

**Keep Server Components for data fetching and static content.**
**Only add `'use client'` to components that genuinely need interactivity.**
**Pass data from Server to Client Components via props (must be serializable).**
**Use Server Actions for mutations, not client-side state updates.**

**Warning signs:**
- Build warnings about "client-side modules in Server Components"
- Hydration errors in browser console
- Large client bundles despite having little interactivity
- `window is not defined` errors during build

**Phase to address:**
M1 (Scaffolding & Design Tokens) — establish patterns for Client/Server boundaries before building pages.

---

### Pitfall 6: Zustand Store Subscription Re-render Loops

**What goes wrong:**
Components re-render on every Zustand store change, even when the selected state hasn't changed. Performance degrades as stores grow, causing frame drops and input lag.

**Why it happens:**
Zustand's default comparison is strict equality (`===`) for selectors:
- Selecting objects/arrays creates new references on every update
- Multiple selectors in one component each trigger re-renders
- Store updates without memoization cascade through subscribers
- Shallow selectors still re-render when nested properties change

**How to avoid:**
```tsx
// ✅ GOOD: Atomic selectors with useShallow
import { useShallow } from "zustand/react/shallow"

function AgentList() {
  const { agents, loading } = useAgentStore(
    useShallow((state) => ({ agents: state.agents, loading: state.loading })),
  )
  // Only re-renders when agents OR loading changes
}

// ❌ BAD: Non-shallow comparison
function AgentList() {
  const { agents, loading } = useAgentStore((state) => ({
    agents: state.agents,
    loading: state.loading,
  }))
  // Re-renders on EVERY store change (new object reference)
}
```

**Use atomic selectors (`state => state.value`) for single values.**
**Use `useShallow` for multiple state picks.**
**Avoid selecting entire objects when you only need nested properties.**
**Use `subscribe` for transient updates that shouldn't trigger re-renders.**

**Warning signs:**
- React DevTools Profiler shows frequent re-renders
- Store changes cause UI lag or stuttering
- Console warnings about "Too many re-renders"
- Performance improves significantly when disabling Zustand subscriptions

**Phase to address:**
M2 (Dashboard Page) — when integrating Zustand stores with UI components.

---

### Pitfall 7: Clip-Path Layout Overflow and Interaction Issues

**What goes wrong:**
Clip-path corners cut off interactive elements (buttons, inputs), create layout issues with positioned children, and cause hitbox mismatches where visible areas don't respond to clicks.

**Why it happens:**
`clip-path` affects visual rendering but not layout:
- Elements still occupy full rectangular space in layout
- Child elements position based on unclipped bounds
- `overflow: hidden` can't fix clip-path issues
- Interactive elements outside clip-path are still in DOM but invisible
- Border radius doesn't work with clip-path (must use `polygon` or `path`)

**How to avoid:**
```tsx
// ✅ GOOD: Padding + clip-path with contained children
function HudCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-1">
      <div className="clip-path-polygon bg-background border border-border">
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ❌ BAD: Clip-path cuts off button edges
function HudCard() {
  return (
    <div className="clip-path-polygon">
      <button className="absolute top-0 right-0">Close</button> {/* 💥 Cut off */}
    </div>
  )
}
```

**Add padding inside clipped elements to prevent content cutoff.**
**Avoid positioning children at clipped corners.**
**Use `inset` instead of absolute positioning for clipped containers.**
**Test hitboxes with DevTools — ensure interactive areas are fully visible.**

**Warning signs:**
- Buttons/inputs don't respond to clicks at edges
- Tooltips or popups are partially hidden
- Scrollbars appear inside clipped areas
- Layout shifts when clip-path is applied

**Phase to address:**
M1 (Scaffolding & Design Tokens) — establish clip-path patterns and component templates.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline animation styles | Faster prototyping | Impossible to theme, hard to maintain | Never — use CSS variables from day one |
| `!important` overrides | Quick fixes for specificity | Cascade issues, can't override later | Only for third-party library overrides |
| Bypassing shadcn/ui theming | Faster component customization | Can't update shadcn/ui, loses design system benefits | Never — copy component instead |
| Global CSS for animations | Avoids prop drilling | Can't disable per-user, violates component isolation | Only for truly global effects (scanline overlay) |
| Skipping semantic tokens | Faster implementation | Can't theme, hard to maintain consistency | Never — semantic tokens prevent fragmentation |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Zustand + Next.js App Router** | Using Zustand stores in Server Components | Mark store-consuming components with `'use client'`, pass data via props |
| **WebSocket + React 19** | Storing WebSocket instance in React state | Use `useRef` for WebSocket, Zustand for messages |
| **shadcn/ui + custom themes** | Overriding component styles with global CSS | Use CSS variables, variant props, or copy and modify component |
| **Tailwind v4 + Next.js 16** | Using `tailwind.config.js` from v3 | Use `@theme` directive in CSS for all custom values |
| **Rajdhani font + Next.js** | Not using `next/font` for font optimization | Use `next/font/google` to avoid FOUT and reduce CLS |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Unthrottled WebSocket updates** | UI freezes, main thread blocked | Use `requestAnimationFrame` batching, update state less frequently | 10+ agents sending status every 100ms |
| **Scanline overlay on entire page** | Scroll jank, GPU memory spike | Use `pointer-events: none`, `will-change: transform`, restrict to viewport | Any animation on viewport-sized element |
| **Glow effects on every card** | Painting takes 50ms+, laggy interactions | Limit to active/hover states, use `box-shadow` instead of `filter: drop-shadow` | 20+ cards with glow on screen |
| **Real-time log streaming** | Browser hangs, memory leak | Virtualize logs (react-window), limit to last 1000 lines | 5000+ log entries in DOM |
| **Multiple grid overlays** | Layer compositing explosion | Use single overlay with `pointer-events: none`, avoid overlapping | 3+ grid layers on same element |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **WebSocket URL in client code** | Exposes internal gateway address | Use environment variables, validate connection server-side |
| **Agent commands without validation** | Code injection via agent RPC | Validate and sanitize all commands, use whitelist for allowed operations |
| **Local storage for sensitive data** | XSS attacks expose agent tokens | Use httpOnly cookies or secure server-side storage |
| **CORS misconfiguration** | Unauthorized WebSocket connections | Configure CORS strictly, validate origin on WebSocket handshake |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Animated backgrounds distract** | Can't focus on data, motion sickness | Make animations subtle, provide "reduce motion" option |
| **Neon colors everywhere** | Eye strain, hard to scan | Use neon for accents only, neutral colors for data |
| **Too much information density** | Cognitive overload, can't find issues | Progressive disclosure: summary → detail views |
| **HUD aesthetic over clarity** | Form over function, harder to use | Balance aesthetics with readability, test with real users |
| **No error states** | Users don't know what went wrong | Design error states for all failure modes (WebSocket disconnect, agent crash) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dual theme support:** Often missing light theme — verify both themes work with neon colors and contrast ratios
- [ ] **Reduced motion mode:** Often missing `prefers-reduced-motion` support — verify animations disable respectfully
- [ ] **WebSocket reconnection:** Often missing auto-reconnect logic — verify UI shows connection state
- [ ] **Keyboard navigation:** Often missing focus styles on clipped elements — verify all interactive elements are keyboard-accessible
- [ ] **Error boundaries:** Often missing error handling for component crashes — verify errors don't break entire app
- [ ] **Loading states:** Often missing skeleton screens — verify loading states match HUD aesthetic
- [ ] **Responsive layout:** Often missing mobile optimization — verify layout works at 1024px width (minimum)
- [ ] **Accessibility tree:** Often missing ARIA labels for custom HUD elements — verify screen readers can navigate

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Animation performance** | MEDIUM | Profile with Chrome DevTools, identify expensive properties, migrate to `transform`/`opacity`, add `content-visibility` |
| **Contrast violations** | LOW | Run Axe DevTools audit, adjust design token values, re-test with contrast checker |
| **Tailwind v4 migration** | HIGH | Rewrite all custom config to `@theme` CSS, test each custom value, remove v3 dependencies |
| **shadcn/ui over-customization** | HIGH | Revert to stock components, copy and modify instead of overriding, test component updates |
| **Client component bleed** | MEDIUM | Audit imports, add `'use client'` only where needed, extract client-only logic to separate files |
| **Zustand re-render loops** | LOW | Add `useShallow` to multi-selectors, use atomic selectors, profile with React DevTools |
| **Clip-path issues** | LOW | Add padding to clipped containers, avoid positioning at corners, test hitboxes |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Animation performance | M1 (Scaffolding & Design Tokens) | Lighthouse Performance score > 80, Chrome DevTools shows <16ms frame times |
| WCAG contrast violations | M1 (Scaffolding & Design Tokens) | Axe DevTools audit passes, manual contrast check with WebAIM Contrast Checker |
| Tailwind v4 migration | M1 (Scaffolding & Design Tokens) | Build succeeds, custom theme values work, no v3 config warnings |
| shadcn/ui customization | M1 (Scaffolding & Design Tokens) | Components update cleanly, no merge conflicts, theming works |
| Client component bleed | M1 (Scaffolding & Design Tokens) | No build warnings about client modules in Server Components, bundles under 100KB |
| Zustand re-render loops | M2 (Dashboard Page) | React DevTools Profiler shows minimal re-renders, no render loops |
| Clip-path layout issues | M1 (Scaffolding & Design Tokens) | All interactive elements fully visible, no hitbox mismatches, scrollbars work |

---

## Sources

- **Next.js 16 Server Components**: [Next.js Official Docs](https://nextjs.org/docs/app/getting-started/server-and-client-components) — HIGH confidence (official source)
- **Tailwind CSS v4 Beta**: [Tailwind CSS Official Docs](https://tailwindcss.com/docs/v4-beta) — HIGH confidence (official source)
- **Zustand Best Practices**: [Zustand GitHub Repository](https://github.com/pmndrs/zustand) — HIGH confidence (official source)
- **WCAG Contrast Requirements**: [W3C WCAG 2.1 Understanding](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) — HIGH confidence (official source)
- **CSS Animation Performance**: [Web.dev Performance Guide](https://web.dev/animations-guide/) — MEDIUM confidence (general best practices)
- **CSS Clip-path Issues**: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path) — HIGH confidence (official source)
- **shadcn/ui Customization**: Community experience and project constraints — MEDIUM confidence (pattern-based)
- **React 19 + Next.js 16 Integration**: Next.js documentation and AGENTS.md warning — HIGH confidence (official source)

---
*Pitfalls research for: Cyberpunk HUD Dashboard with Next.js 16 + Tailwind v4 + shadcn/ui*
*Researched: 2026-04-30*
