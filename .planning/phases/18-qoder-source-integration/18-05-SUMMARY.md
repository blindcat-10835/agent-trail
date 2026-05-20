---
phase: 18-qoder-source-integration
plan: 05
subsystem: frontend-labels-cost-docs
tags: [pattern-a, pattern-h, qdr-104, qdr-105, qdr-107, qdr-109, qdr-110]

# Dependency graph
requires:
  - phase: 18-02
    provides: "TraceSource union includes 'qoder'; TypeScript enforces exhaustive SOURCE_LABELS"
  - phase: 18-04
    provides: "qoderDef registered in registry; qoderAdapter wired in all BFF routes"
provides:
  - "Frontend renders Qoder labels/colors in SourceSwitcher consumers (QDR-104)"
  - "Cost exclusion: COST_EXCLUDED_SOURCES in overview.ts; provider-grouping guard in model-pricing.ts (QDR-109)"
  - "D-06 part 2: SubagentBlock already source-agnostic — no code change needed (QDR-107)"
  - "D-06 part 3: SPAWNED badge added to TraceThread HUD header, source-agnostic via useAgentTool().href() (QDR-107)"
  - "Documentation: CONFIGURATION, API, services/ingest, ERRORS_LEARNED updated for Qoder (QDR-110)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern A: SOURCE_LABELS + SOURCE_COLORS map widening"
    - "Pattern H: Cost exclusion via COST_EXCLUDED_SOURCES positive whitelist"

key-files:
  created: []
  modified:
    - path: "components/overview/kpi-hero.tsx"
      provides: "SOURCE_LABELS includes qoder: 'QODER'"
    - path: "components/sessions/session-filter-dropdown.tsx"
      provides: "SOURCE_LABELS includes qoder: 'Qoder'"
    - path: "components/sessions/aggregate-sessions-view.tsx"
      provides: "Switch case for 'qoder' in source sort"
    - path: "components/overview/starred-sessions.tsx"
      provides: "SOURCE_COLORS + sourceLabel case for qoder"
    - path: "ingest/api/overview.ts"
      provides: "COST_EXCLUDED_SOURCES array; cost rollups exclude qoder"
    - path: "ingest/pricing/model-pricing.ts"
      provides: "Provider-grouping guard for ultimate/experts-ultimate"
    - path: "components/replay/trace-thread.tsx"
      provides: "SPAWNED badge for parentSessionId (D-06 part 3)"
    - path: "docs/CONFIGURATION.md"
      provides: "QODER_DB_PATH + qoder_db_paths documentation"
    - path: "docs/API.md"
      provides: "qoder in source list + discovery example"
    - path: "docs/services/ingest.md"
      provides: "Qoder SQLite parser section with fingerprint + cost exclusion"
    - path: "ERRORS_LEARNED.md"
      provides: "EL-007 credential hardline, EL-008 JSONL insufficient, EL-009 token double-counting, EL-010 product-tier keys"

decisions:
  - id: D-cost-exclusion
    choice: "Positive whitelist (COST_EXCLUDED_SOURCES array listing non-cost sources) rather than negative filter"
    rationale: "Safer default — new sources opt into cost by default rather than being accidentally included"
  - id: D-d06-part2
    choice: "Outcome (a) — SubagentBlock already source-agnostic"
    rationale: "grep confirmed no source literal in rendering predicate; uses useAgentTool().href() for source-scoped routing"
  - id: D-d06-part3
    choice: "Outcome (c) — created SPAWNED badge in TraceThread"
    rationale: "No existing parent back-link existed in session detail HUD header; added source-agnostic badge using useAgentTool().href()"
  - id: D-provider-grouping
    choice: "Guard in model-pricing.ts maps ultimate/experts-ultimate to null provider"
    rationale: "Prevents misattribution to Anthropic/OpenAI/Gemini; matches SPEC §9 acceptance"

deviations: []

# Task summary
tasks:
  - id: T-1
    name: "Frontend label/color (3 files) + cost exclusion + provider-grouping guard"
    status: complete
    commits: ["26696a7"]
  - id: T-2
    name: "Replay UI subagent-surface AUDIT (D-06 parts 2+3)"
    status: complete
    commits: ["3f8d2b8"]
    artifact: ".planning/phases/18-qoder-source-integration/18-05-replay-audit.md"
  - id: T-3
    name: "Wire D-06 parts 2+3 source-agnostically per audit"
    status: complete
    commits: ["1f5411c"]
    notes: "Part 2: outcome (a), no code change. Part 3: outcome (c), SPAWNED badge added to trace-thread.tsx"
  - id: T-4
    name: "Documentation — CONFIGURATION + API + services/ingest + ERRORS_LEARNED"
    status: complete
    commits: ["5fd074d"]

self-check:
  tsc: pass
  lint: pass
  existing-tests: pass
