# Phase 1: Trace Contract & Brownfield Reset - Research

**Researched:** 2026-05-06
**Domain:** TypeScript trace data model, fixture testing, brownfield documentation migration
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational data model for the entire agent-tracing-dashboard. The core deliverable is a canonical TypeScript trace contract (`types/trace.ts`) that defines Source, Session, Turn, Message, ToolCall, SkillUse, Subagent, Activity, TokenUsage, and Timing metadata. This contract must remain independent of the existing Gateway types, be portable enough to compare with agentsview fixtures, and support three distinct agent sources (OpenClaw, Claude Code, Codex) that have fundamentally different logging formats.

The phase also creates a fixture corpus with golden expected outputs, implements a minimal parser validation function, and completes a brownfield reset from OVAO to agent-tracing-dashboard in documentation and visible labels only (no component/route renames). The existing OpenClaw overview capabilities are categorized as either "Gateway-exclusive" or "file-replaceable" to preserve contracts while enabling future file-based replay.

**Primary recommendation:** Define the trace contract as a single-file TypeScript module with strict type discipline, use vitest for fixture-based golden testing, and treat the agentsview Go implementation as a behavioral reference rather than a direct port.

## Architectural Responsibility Map

| Capability                      | Primary Tier      | Secondary Tier | Rationale                                                      |
| ------------------------------- | ----------------- | -------------- | -------------------------------------------------------------- |
| Trace contract type definitions | Frontend / Client | Shared types   | Canonical model consumed by frontend and future ingest service |
| Fixture corpus storage          | File system       | —             | Static test data, reference implementations                    |
| Parser validation logic         | API / Backend     | —             | Pure functions processing JSONL → canonical model             |
| Documentation migration         | Project           | —             | Planning docs, project instructions                            |
| Source status taxonomy          | API / Backend     | Frontend       | Dual ingest/gateway status model                               |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Trace contract placed in `types/trace.ts`, parallel to `gateway/types.ts` and `gateway/adapter-types.ts`
- **D-02:** All trace types in single file `trace.ts` for global visibility
- **D-03:** TypeScript naming conventions (camelCase, union types, interface inheritance)
- **D-04:** Trace contract completely independent from Gateway types
- **D-05:** Gateway migration deferred to later phase
- **D-06:** Fixtures from agentsview `internal/parser/testdata/` plus local OpenClaw sessions
- **D-07:** Fixture format: raw JSONL + golden expected JSON (canonical TraceSession)
- **D-08:** Minimum 2 fixtures per source (normal conversation + tool call session)
- **D-09:** Rename scope: documentation and visible labels only (no component/route renames)
- **D-10:** Delete old `.planning/phases/`, `debug/`, `quick/`, `ui-reviews/` files
- **D-11:** Preserve OVAO cyberpunk HUD design language
- **D-12:** Categorize OpenClaw overview capabilities by dependency source
- **D-13:** Gateway-exclusive capabilities "preserved but isolated"
- **D-14:** Dual-status model: `ingestStatus` + `gatewayStatus` per source
- **D-15:** Phase 1 validation: minimal `parseFixture(filePath) → TraceSession` pure function + tests

### Claude's Discretion

- Trace.ts internal type structure design (field granularity, union types vs enums, optional field strategy)
- Fixture file naming conventions and directory structure
- Preserved capabilities list detailed format

### Deferred Ideas (OUT OF SCOPE)

- Gateway migration path
- Ingest service directory structure design
- Testing framework selection (vitest / jest) — decided during Phase 1 implementation
- Component/route renames — Phase 4 frontend architecture refactor

## Phase Requirements

| ID       | Description                                                                                                                            | Research Support                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| FOUND-01 | Project docs, navigation labels, and default entry points use agent-tracing-dashboard semantics                                        | Brownfield reset strategy, documentation migration path                          |
| FOUND-02 | Unified Trace Contract with Source, Session, Turn, Message, ToolCall, SkillUse, Subagent, Activity, TokenUsage, Timing                 | agentsview Go types as behavioral reference, TypeScript type system capabilities |
| FOUND-03 | Fixture corpus for OpenClaw, Claude Code, Codex with golden canonical output                                                           | agentsview testdata structure, JSONL parsing patterns                            |
| FOUND-04 | Preserve existing OpenClaw Gateway live overview capabilities                                                                          | Gateway type analysis, capability categorization framework                       |
| FOUND-05 | Frontend source-aware empty/error/config states distinguishing not installed, not configured, no sessions, read failure, parse failure | Dual-status model design (ingest + gateway)                                      |

## Standard Stack

### Core

| Library    | Version            | Purpose                                          | Why Standard                                                      |
| ---------- | ------------------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| TypeScript | 5.x (from ovao)    | Type system for trace contract                   | Project already uses TS 5, strict mode enabled                    |
| vitest     | latest             | Testing framework for fixture-based golden tests | [ASSUMED] Faster than Jest, native ESM support, better watch mode |
| Node.js    | 24.14.0 (verified) | Runtime for fixture parsing                      | Already installed, matches ovao requirements                      |

### Supporting

| Library       | Version  | Purpose                              | When to Use                                           |
| ------------- | -------- | ------------------------------------ | ----------------------------------------------------- |
| ` readline` | built-in | JSONL line-by-line parsing           | Standard Node.js module for streaming file processing |
| `zod`       | latest   | Runtime schema validation (optional) | If validation beyond TypeScript types needed          |

### Alternatives Considered

| Instead of       | Could Use   | Tradeoff                                                                                                |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| vitest           | jest        | Jest is more established but slower; vitest has better ESM/TypeScript support                           |
| TypeScript types | JSON Schema | TS provides compile-time checking, JSON Schema enables runtime validation but requires more maintenance |

**Installation:**

```bash
# In project root (after package.json is created)
pnpm add -D vitest @types/node
```

**Version verification:**

```bash
npm view vitest version
# Verification pending: Web search unavailable, will verify during implementation
```

## Architecture Patterns

### System Architecture Diagram

```text
Phase 1 Data Flow (Fixture Validation)

Fixture Files (JSONL)
  ↓
parseFixture() pure function
  ↓
TraceSession (canonical TypeScript types)
  ↓
deepEqual comparison with golden JSON
  ↓
Test passes/fails

No services started. No database. No network calls.
```

### Recommended Project Structure

```
types/
  trace.ts              # NEW: Canonical trace contract
gateway/                # EXISTING: Preserved, not modified
  types.ts              # Gateway protocol types
  adapter-types.ts      # Dashboard display types
fixtures/               # NEW: Fixture corpus
  openclaw/
    conversation.jsonl  # Copied from agentsview or local session
    conversation.golden.json
    tool-call.jsonl
    tool-call.golden.json
  claude-code/
    valid_session.jsonl  # Copied from ../references/agentsview/internal/parser/testdata/claude/
    valid_session.golden.json
    tool_call_pending.jsonl
    tool_call_pending.golden.json
  codex/
    standard_session.jsonl  # Copied from ../references/agentsview/internal/parser/testdata/codex/
    standard_session.golden.json
    function_calls.jsonl
    function_calls.golden.json
lib/
  parseFixture.ts       # NEW: Minimal parser validator
tests/
  fixtures.test.ts      # NEW: Golden file tests
docs/
  preserved-capabilities.md  # NEW: OpenClaw overview capability inventory
```

### Pattern 1: Golden File Testing


**What:** Fixture-based tests where expected output is stored alongside input
**When to use:** Parser validation, contract verification, regression prevention
**Example:**

```typescript
// Source: agentsview Go testing patterns, adapted for TypeScript
import { describe, it, expect } from 'vitest'
import { parseFixture } from '@/lib/parseFixture'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('OpenClaw fixture parser', () => {
  it('parses conversation.jsonl to canonical TraceSession', () => {
    fixtureDir = 'fixtures/openclaw'
    input = readFileSync(join(fixtureDir, 'conversation.jsonl'), 'utf-8')
    expected = JSON.parse(readFileSync(join(fixtureDir, 'conversation.golden.json'), 'utf-8'))

    const result = parseFixture(input, 'openclaw')
    expect(result).toEqual(expected)
  })
})
```

### Pattern 2: Single-File Type Definition Module

**What:** All related types in one file with clear export structure
**When to use:** Tightly coupled type systems where developers need to see all types together
**Example:**

```typescript
// types/trace.ts
export type TraceSource = 'openclaw' | 'claude-code' | 'codex'

export interface TraceSource {
  type: TraceSource
  path: string
  ingestStatus: IngestStatus
  gatewayStatus?: GatewayStatus
}

export interface TraceSession {
  id: string
  source: TraceSource
  project: string
  startedAt: string | null
  endedAt: string | null
  turns: TraceTurn[]
  // ... other fields
}

export interface TraceTurn {
  id: string
  index: number
  userMessage: TraceMessage | null
  assistantMessages: TraceMessage[]
  activities: TraceActivity[]
  // ... other fields
}
```

### Anti-Patterns to Avoid

- **Don't create cyclic type dependencies:** Keep trace.ts independent from gateway/types.ts
- **Don't parse fixtures in tests:** Use pre-computed golden JSON for fast test execution
- **Don't mix Gateway protocol types:** Trace contract is canonical, Gateway is one source
- **Don't hardcode OVAO in new docs:** Use agent-tracing-dashboard branding
- **Don't rename components/routes:** Only change documentation and visible labels (D-09)

## Don't Hand-Roll

| Problem                    | Don't Build                 | Use Instead                            | Why                                                              |
| -------------------------- | --------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| JSONL line-by-line parsing | Custom string splitting     | Node.js `readline` module            | Handles edge cases (empty lines, varying encodings, large files) |
| Deep equality checks       | Custom recursive comparison | vitest's `toEqual()`                 | Well-tested, provides clear diff output                          |
| Path operations            | Manual string concatenation | Node.js `path` module                | Cross-platform compatible                                        |
| Type validation            | Custom runtime checks       | TypeScript compiler + optional `zod` | Compile-time safety is sufficient for Phase 1                    |

**Key insight:** Phase 1 is about defining contracts and validation, not building infrastructure. Use minimal, well-tested libraries for file I/O and testing.

## Runtime State Inventory

> Include this section for rename/refactor/migration phases only. Omit entirely for greenfield phases.

Phase 1 involves documentation/label migration (brownfield reset). This section identifies runtime state that may reference the old "OVAO" name.

| Category            | Items Found                                                                 | Action Required                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | None — project is frontend-only, no persistent data layer yet              | N/A                                                                                                                                                   |
| Live service config | `.ovao-config.json` — Gateway URL/Token config file name contains "ovao" | Code rename only: update `lib/gateway-config.ts` to read/write `.agent-tracing-config.json` (or keep old name if Gateway integration requires it) |
| OS-registered state | None — no OS-level integrations or scheduled tasks                         | N/A                                                                                                                                                   |
| Secrets/env vars    | `.env.local` may contain gateway references                               | Code rename only: update env var names if needed                                                                                                      |
| Build artifacts     | `.next/` build cache may contain OVAO references                          | Rebuild:`pnpm build` after documentation changes                                                                                                    |

**Additional consideration:** Browser `localStorage` or `sessionStorage` may cache OVAO-related data if the app has been run. This is user-side state that will clear after documentation updates and browser refresh.

## Common Pitfalls

### Pitfall 1: Trace Contract Coupled to Gateway Types

**What goes wrong:** Importing from `gateway/types.ts` creates tight coupling to OpenClaw-specific protocol, making it impossible to add Claude/Codex sources without breaking changes.
**Why it happens:** Gateway types are convenient and already define session/message concepts.
**How to avoid:** Define `types/trace.ts` as completely independent module. Use semantic names (TraceSession vs GatewaySession) that clearly signal different domains.
**Warning signs:** Import statements like `import { GatewaySession } from '@/gateway/types'` in trace.ts

### Pitfall 2: Fixture Files Too Clean

**What goes wrong:** Fixtures only cover happy path (complete sessions, well-formed JSON, no tool failures). Tests pass but parser fails on real-world messy logs.
**Why it happens:** Easy to copy the first clean fixture found; harder to curate edge cases.
**How to avoid:** Per D-08, each source must have at least 2 fixtures covering: (1) normal conversation, (2) session with tool calls. Future phases will add edge cases.
**Warning signs:** All fixtures have perfect JSON structure and complete sessions

### Pitfall 3: Golden JSON Manually Created

**What goes wrong:** Golden files are hand-written, not generated from actual parser output. Tests pass but golden format doesn't match real parser behavior.
**Why it happens:** Faster to write expected JSON by hand than implement parser first.
**How to avoid:** Per D-15, implement minimal `parseFixture()` function first, run it on fixtures, capture output as golden JSON, then write tests.
**Warning signs:** Golden JSON is suspiciously regular or lacks parser metadata fields

### Pitfall 4: Source Status Confusion

**What goes wrong:** Treating Gateway connection status as the only status, so Claude/Codex (no Gateway) can't express "configured but no sessions found."
**Why it happens:** Existing code only has Gateway status concept.
**How to avoid:** Per D-14, implement dual-status model: `ingestStatus` (installed/configured/empty/indexing/error/parser-warning) AND `gatewayStatus` (connected/disconnected/connecting/error).
**Warning signs:** Status enum doesn't have "empty" state, or assumes Gateway exists for all sources

### Pitfall 5: Test Framework Choice Not Validated

**What goes wrong:** Picking vitest or jest based on training data, but project's tooling (Next.js, pnpm, turbopack) may have conflicts or better alternatives.
**Why it happens:** Test framework selection [ASSUMED] without verification.
**How to avoid:** Verify framework compatibility with existing stack during implementation. Check if ovao/parent project has test framework already in use.
**Warning signs:** Unclear which test framework project uses, no test config files found

## Code Examples

Verified patterns from official sources:

### Canonical Trace Contract Structure

```typescript
// Source: agentsview Go types (internal/parser/types.go), adapted to TypeScript conventions

// Source type identifier
export type TraceSource = 'openclaw' | 'claude-code' | 'codex'

// Dual status model per D-14
export type IngestStatus =
  | 'installed'       // Source directory exists
  | 'configured'      // Source has valid config/env
  | 'empty'           // No sessions found
  | 'indexing'        // Active sync in progress
  | 'error'           // Sync/parse failed
  | 'parser-warning'  // Parsed with warnings

export type GatewayStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'error'

export interface TraceSource {
  type: TraceSource
  path: string
  ingestStatus: IngestStatus
  gatewayStatus?: GatewayStatus  // Only for OpenClaw
  lastSyncAt?: string
  sessionCount: number
}

// Session-level metadata
export interface TraceSession {
  id: string                    // Unique across all sources
  source: TraceSource
  project: string
  startedAt: string | null      // ISO 8601
  endedAt: string | null        // ISO 8601
  status: SessionStatus
  rootSessionId?: string        // For forks/subagents
  parentSessionId?: string      // For subagent relationships
  relationshipType?: 'root' | 'subagent' | 'fork' | 'continuation'
  metrics: SessionMetrics
  turns: TraceTurn[]
}

export type SessionStatus =
  | 'active'
  | 'idle'
  | 'aborted'
  | 'error'
  | 'unknown'

export interface SessionMetrics {
  messageCount: number
  userMessageCount: number
  totalTokens?: number
  hasToolCalls: boolean
  terminationStatus?: string
  parserMalformedLines: number
  isTruncated: boolean
}

// Turn: user input + assistant response + activities
export interface TraceTurn {
  id: string
  sessionId: string
  index: number
  userMessage: TraceMessage | null
  assistantMessages: TraceMessage[]
  activities: TraceActivity[]
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  tokenUsage?: TokenUsage
}

// Message base type
export interface TraceMessage {
  id: string
  ordinal: number
  role: 'user' | 'assistant' | 'system' | 'tool_result'
  content: string
  timestamp?: string
  model?: string
  tokenUsage?: TokenUsage
  sourceMetadata: SourceMetadata
}

// Activity union type
export type TraceActivity =
  | TraceToolCall
  | TraceSkillUse
  | TraceSubagentLink
  | TraceThinkingBlock
  | TraceSystemEvent

export interface TraceToolCall {
  type: 'tool_call'
  id: string                   // tool_use_id, toolCallId, or call_id
  name: string
  category: ToolCategory
  inputJson: string
  resultEvents: TraceToolResultEvent[]
  status: 'pending' | 'success' | 'error'
  error?: string
  durationMs?: number
}

export type ToolCategory =
  | 'Bash'
  | 'Edit'
  | 'Read'
  | 'Grep'
  | 'Task'
  | 'Agent'
  | 'Other'

export interface TraceToolResultEvent {
  type: 'result_event'
  timestamp?: string
  content: string
  isPartial: boolean
}

export interface TraceSkillUse {
  type: 'skill_use'
  name: string
  inputSummary: string
  result?: string
  status: 'success' | 'error'
}

export interface TraceSubagentLink {
  type: 'subagent_link'
  subagentSessionId: string
  subagentSource: TraceSource
  relationship: 'spawned' | 'attached'
}

export interface TraceThinkingBlock {
  type: 'thinking'
  content: string
  isRedacted: boolean
}

export interface TraceSystemEvent {
  type: 'system'
  subtype: string
  content: string
}

// Token usage normalized across sources
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

// Source provenance for debugging
export interface SourceMetadata {
  sourceType: TraceSource
  sourceFile: string
  sourceLine?: number
  sourceVersion?: string
  cwd?: string
  gitBranch?: string
}
```

### Minimal Fixture Parser

```typescript
// lib/parseFixture.ts
import { createInterface } from 'readline'
import { createReadStream } from 'fs'
import { TraceSession } from '@/types/trace'

export async function parseFixture(
  filePath: string,
  sourceType: 'openclaw' | 'claude-code' | 'codex'
): Promise<TraceSession> {
  const lines: string[] = []

  // Read JSONL line by line
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    if (line.trim()) {
      lines.push(line)
    }
  }

  // Parse based on source type
  // (Phase 1: stub implementation returning minimal TraceSession)
  // (Phase 2-3: real parsers per source)
  return {
    id: 'stub-session-id',
    source: sourceType,
    project: 'test-project',
    startedAt: null,
    endedAt: null,
    status: 'unknown',
    metrics: {
      messageCount: lines.length,
      userMessageCount: 0,
      hasToolCalls: false,
      terminationStatus: 'unknown',
      parserMalformedLines: 0,
      isTruncated: false
    },
    turns: []
  }
}
```

## State of the Art

| Old Approach                        | Current Approach                                   | When Changed | Impact                                             |
| ----------------------------------- | -------------------------------------------------- | ------------ | -------------------------------------------------- |
| Ad-hoc JSONL scanning in API routes | Canonical trace contract + source-specific parsers | Phase 1      | Enables multi-source support, reliable replay      |
| Gateway-only status                 | Dual ingest + gateway status model                 | Phase 1      | Claude/Codex can express state without Gateway     |
| Hand-written expected test outputs  | Golden file fixture testing                        | Phase 1      | Regression prevention, clear contract verification |
| OVAO branding (single-source focus) | agent-tracing-dashboard (multi-source)             | Phase 1      | Product positioning aligns with v1 scope           |

**Deprecated/outdated:**

- Current `app/api/sessions/messages/route.ts` approach (last-30-lines scanning) — marked for replacement in Phase 2
- Single status model assuming Gateway exists — replaced by dual-status model (D-14)

## Assumptions Log

| #  | Claim                                                                     | Section                  | Risk if Wrong                                                          |
| -- | ------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| A1 | vitest is better than jest for this project                               | Standard Stack           | Test framework may have integration issues with Next.js/turbopack      |
| A2 | ovao/package.json can be copied/used as reference                         | Environment Availability | Project may need different dependencies or scripts                     |
| A3 | agentsview fixtures are compatible with TypeScript contract design        | Fixture Strategy         | Fixture format may require adjustment for TypeScript types             |
| A4 | `.ovao-config.json` can be renamed without breaking Gateway integration | Runtime State Inventory  | Gateway may hardcode old config file path                              |
| A5 | No existing test framework in project                                     | Validation Architecture  | May need to integrate with existing test setup instead of creating new |

## Open Questions

1. **Test framework compatibility**

   - What we know: vitest is recommended in research, but Next.js projects often use Jest
   - What's unclear: Whether ovao or parent project has existing test configuration
   - Recommendation: Check for existing `jest.config.*`, `vitest.config.*`, or test scripts in ovao/package.json before deciding
2. **Fixture sourcing for OpenClaw**

   - What we know: agentsview has Claude and Codex fixtures, but no OpenClaw fixtures
   - What's unclear: Where to get real OpenClaw session files (local machine vs reference implementation)
   - Recommendation: Check if user has local OpenClaw sessions in `~/.openclaw/agents/` or need to generate synthetic fixtures
3. **Config file rename impact**

   - What we know: `.ovao-config.json` contains Gateway URL/Token
   - What's unclear: Whether Gateway integration hardcodes this filename
   - Recommendation: Verify Gateway integration code before renaming config file

## Environment Availability

| Dependency           | Required By            | Available | Version        | Fallback                                         |
| -------------------- | ---------------------- | --------- | -------------- | ------------------------------------------------ |
| Node.js              | Fixture parsing, tests | ✓        | v24.14.0       | —                                               |
| pnpm                 | Package management     | ✓        | 10.33.0        | —                                               |
| TypeScript           | Type definitions       | ✓        | ~5.x (in ovao) | —                                               |
| vitest               | Testing framework      | ✗        | —             | Use Jest if already in project                   |
| agentsview reference | Fixture sourcing       | ✓        | —             | Local OpenClaw sessions if reference unavailable |

**Missing dependencies with no fallback:**

- None — all core dependencies available

**Missing dependencies with fallback:**

- vitest — fallback to Jest if project already uses it

## Validation Architecture

### Test Framework

| Property           | Value                                               |
| ------------------ | --------------------------------------------------- |
| Framework          | vitest (pending verification during implementation) |
| Config file        | `vitest.config.ts` (to be created)                |
| Quick run command  | `pnpm test`                                       |
| Full suite command | `pnpm test:all` (if separate test suites created) |

### Phase Requirements → Test Map

| Req ID   | Behavior                                            | Test Type | Automated Command              | File Exists? |
| -------- | --------------------------------------------------- | --------- | ------------------------------ | ------------ |
| FOUND-01 | Documentation uses agent-tracing-dashboard branding | manual    | —                             | ❌ Wave 0    |
| FOUND-02 | Trace contract types compile without errors         | unit      | `pnpm tsc --noEmit`          | ❌ Wave 0    |
| FOUND-03 | Fixture parsing matches golden output               | unit      | `pnpm test fixtures.test.ts` | ❌ Wave 0    |
| FOUND-04 | Preserved capabilities documented                   | manual    | —                             | ❌ Wave 0    |
| FOUND-05 | Source status types support dual-status model       | unit      | `pnpm test types.test.ts`    | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm test` (run fixture tests)
- **Per wave merge:** `pnpm test:all` + manual verification of documentation changes
- **Phase gate:** All fixture tests passing + documentation review before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/fixtures.test.ts` — golden file tests for OpenClaw, Claude Code, Codex fixtures
- [ ] `lib/parseFixture.ts` — minimal parser validator
- [ ] `types/trace.ts` — canonical trace contract
- [ ] `docs/preserved-capabilities.md` — OpenClaw overview capability inventory
- [ ] `vitest.config.ts` or `jest.config.js` — test framework configuration
- [ ] Framework install: `pnpm add -D vitest` (or Jest if preferred)

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                              |
| --------------------- | ------- | ------------------------------------------------------------- |
| V2 Authentication     | no      | N/A — Phase 1 is data model, no auth yet                     |
| V3 Session Management | no      | N/A — No web sessions in Phase 1                             |
| V4 Access Control     | no      | N/A — No file I/O in Phase 1 (fixtures only)                 |
| V5 Input Validation   | yes     | TypeScript types + zod (optional) for fixture data validation |
| V6 Cryptography       | no      | N/A — No encryption in Phase 1                               |

### Known Threat Patterns for TypeScript Type System

| Pattern                                           | STRIDE    | Standard Mitigation                                           |
| ------------------------------------------------- | --------- | ------------------------------------------------------------- |
| Type confusion (fixture data doesn't match types) | Tampering | Strict TypeScript config, zod runtime validation (optional)   |
| Malformed JSONL causes parser crash               | DoS       | Try/catch in parseFixture, skip malformed lines, count errors |
| Fixture path traversal                            | Tampering | Hardcoded fixture paths, no user input in Phase 1             |

## Sources

### Primary (HIGH confidence)

- `../references/agentsview/internal/parser/types.go` [VERIFIED: file read] — Go type definitions for AgentType, AgentDef, Registry as behavioral reference
- `../references/agentsview/internal/parser/testdata/claude/*.jsonl` [VERIFIED: file read] — Claude Code fixture examples
- `../references/agentsview/internal/parser/testdata/codex/*.jsonl` [VERIFIED: file read] — Codex fixture examples
- `../references/agentsview/internal/db/schema.sql` [VERIFIED: file read] — SQLite schema showing sessions/messages/tool_calls structure
- `.planning/research/AGENTSVIEW-DATA-SCHEME.md` [VERIFIED: file read] — Data acquisition analysis
- `.planning/research/STACK.md` [VERIFIED: file read] — Technology stack research
- `.planning/research/PITFALLS.md` [VERIFIED: file read] — Domain pitfalls analysis
- `gateway/types.ts` [VERIFIED: file read] — Existing Gateway protocol types (for independence verification)
- `gateway/adapter-types.ts` [VERIFIED: file read] — Existing Dashboard display types (for independence verification)
- CLAUDE.md [VERIFIED: file read] — Project constraints and conventions

### Secondary (MEDIUM confidence)

- Node.js `readline` module documentation [CITED: nodejs.org docs] — Built-in module for JSONL parsing
- vitest documentation [CITED: vitest.dev] — Test framework features and configuration

### Tertiary (LOW confidence)

- Test framework comparison (vitest vs jest) [ASSUMED] — Web search unavailable, recommendation based on training data
- OpenClaw fixture availability [ASSUMED] — Assumes local OpenClaw sessions exist or can be created

## Metadata

**Confidence breakdown:**

- Standard stack: MEDIUM - vitest assumption needs verification, Node.js/pnpm verified
- Architecture: HIGH - based on verified agentsview reference and CONTEXT.md decisions
- Pitfalls: HIGH - derived from verified PITFALLS.md research and codebase analysis

**Research date:** 2026-05-06
**Valid until:** 30 days (stable domain, but test framework choice should be verified during implementation)
