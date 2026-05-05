# Phase 1: Trace Contract & Brownfield Reset - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 6 new files, 3 documentation updates, 1 directory cleanup
**Analogs found:** 4 / 6 (67%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `types/trace.ts` | model | N/A (type definitions) | `gateway/types.ts` | exact |
| `fixtures/` directory | test-data | file-I/O | `../references/agentsview/internal/parser/testdata/` | exact |
| `lib/parseFixture.ts` | utility | transform | `gateway/event-parser.ts` | role-match |
| `tests/fixtures.test.ts` | test | request-response (test runner) | No analog | none |
| `docs/preserved-capabilities.md` | documentation | N/A | `.planning/REQUIREMENTS.md` | role-match |
| Documentation updates (PROJECT.md, AGENTS.md) | documentation | N/A | Existing files | exact |
| `.planning/` cleanup (old phases) | maintenance | N/A | N/A | N/A |

## Pattern Assignments

### `types/trace.ts` (model, type definitions)

**Analog:** `gateway/types.ts`

**Imports pattern** (lines 1-2):
```typescript
// No imports needed for pure type definitions
// Gateway types are completely independent (D-04)
```

**Type definition pattern** (lines 3-34):
```typescript
// Gateway uses clear union types and string literals
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

// Interface definitions with clear optional fields
export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

// Discriminated unions for response types
export interface GatewayResponseOk<T = unknown> {
  type: "res";
  id: string;
  ok: true;
  payload: T;
}

export interface GatewayResponseError {
  type: "res";
  id: string;
  ok: false;
  error: ErrorShape;
}

export type GatewayResponseFrame<T = unknown> = GatewayResponseOk<T> | GatewayResponseError;
```

**Naming conventions** (throughout file):
- Use TypeScript conventions (camelCase properties, PascalCase interfaces)
- String literal unions for enums (e.g., `"openclaw" | "claude-code" | "codex"`)
- Generic type parameters for payload flexibility (e.g., `<T = unknown>`)
- Optional fields with `?` for non-required data
- Use `Record<string, unknown>` for unstructured dictionaries

**Error handling pattern** (lines 127-131):
```typescript
// Gateway defines error shape explicitly
export interface ErrorShape {
  code: string;
  message: string;
  retryable?: boolean;
}
```

**Key insight for trace.ts:** Follow the same pattern but define trace-specific types:
- Source types: `'openclaw' | 'claude-code' | 'codex'`
- Status enums: use string literal unions
- Interface hierarchies: TraceSession → TraceTurn → TraceMessage → TraceActivity
- Discriminated unions for activity types (tool_call, skill_use, subagent_link, etc.)

---

### `fixtures/` directory (test-data, file-I/O)

**Analog:** `../references/agentsview/internal/parser/testdata/`

**Directory structure pattern**:
```text
testdata/
  claude/
    valid_session.jsonl
    tool_call_pending.jsonl
    truncated.jsonl
  codex/
    standard_session.jsonl
    function_calls.jsonl
    fc_args_1.jsonl
    fc_args_2.jsonl
```

**Fixture file pattern** (from `claude/valid_session.jsonl`):
```jsonl
{"type":"user","timestamp":"2024-01-01T10:00:00Z","message":{"content":"Fix the login bug"},"cwd":"/Users/alice/code/my-app"}
{"type":"assistant","timestamp":"2024-01-01T10:00:05Z","message":{"model":"claude-sonnet-4-20250514","content":[{"type":"text","text":"Looking at the auth module..."},{"type":"tool_use","id":"toolu_1","name":"Read","input":{"file_path":"src/auth.ts"}}],"usage":{"input_tokens":100,"output_tokens":50}}}
```

**Golden file pattern** (to be created):
- Each `*.jsonl` should have a corresponding `*.golden.json`
- Golden JSON contains the expected `TraceSession` output
- Test runs: `parseFixture(input.jsonl) → TraceSession` and deep equals with golden JSON

**Naming convention** (per D-07):
- `{source}-{scenario}.jsonl` (e.g., `openclaw-conversation.jsonl`, `claude-code-tool-call.jsonl`)
- `{source}-{scenario}.golden.json` for expected output

**Minimum fixtures per source** (per D-08):
1. Normal conversation (user + assistant messages only)
2. Tool call session (includes tool_use, tool_result events)

---

### `lib/parseFixture.ts` (utility, transform)

**Analog:** `gateway/event-parser.ts`

**Imports pattern** (from `gateway/event-parser.ts` lines 1-3):
```typescript
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { TraceSession } from '@/types/trace';
```

**Core parsing pattern** (adapted from `gateway/event-parser.ts` structure):
```typescript
// Gateway event-parser processes line-by-line events
// Apply same pattern to JSONL fixture parsing

export async function parseFixture(
  filePath: string,
  sourceType: 'openclaw' | 'claude-code' | 'codex'
): Promise<TraceSession> {
  const lines: string[] = [];

  // Read JSONL line by line (streaming for large files)
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      lines.push(line);
    }
  }

  // Parse based on source type
  // Phase 1: stub implementation returning minimal TraceSession
  // Phase 2-3: real parsers per source
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
  };
}
```

**Error handling pattern** (from `gateway/event-parser.ts`):
- Use try/catch for JSON parsing errors
- Skip malformed lines but count them in `parserMalformedLines`
- Log parse errors but don't throw (return partial session)

**File I/O pattern** (from `lib/gateway-config.ts` lines 1-4):
```typescript
import fs from "node:fs";
import path from "node:path";

// Always use absolute paths with path.join()
const CONFIG_PATH = path.join(process.cwd(), ".ovao-config.json");
```

---

### `tests/fixtures.test.ts` (test, request-response)

**Analog:** None — this is a new test file for the project

**Pattern from RESEARCH.md** (golden file testing example):
```typescript
import { describe, it, expect } from 'vitest'
import { parseFixture } from '@/lib/parseFixture'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('OpenClaw fixture parser', () => {
  it('parses conversation.jsonl to canonical TraceSession', () => {
    const fixtureDir = 'fixtures/openclaw'
    const input = readFileSync(join(fixtureDir, 'conversation.jsonl'), 'utf-8')
    const expected = JSON.parse(readFileSync(join(fixtureDir, 'conversation.golden.json'), 'utf-8'))

    const result = parseFixture(input, 'openclaw')
    expect(result).toEqual(expected)
  })
})
```

**Test structure pattern** (to follow):
```typescript
// Group tests by source type
describe('OpenClaw fixtures', () => {
  it('parses conversation session', () => { /* ... */ })
  it('parses tool call session', () => { /* ... */ })
})

describe('Claude Code fixtures', () => {
  it('parses valid session', () => { /* ... */ })
  it('parses tool call pending', () => { /* ... */ })
})

describe('Codex fixtures', () => {
  it('parses standard session', () => { /* ... */ })
  it('parses function calls', () => { /* ... */ })
})
```

**Assertion pattern**:
- Use `toEqual()` for deep equality with golden JSON
- Use `toMatchObject()` for partial matches (when testing specific fields)
- Test error cases: malformed JSONL, empty files, missing fields

---

### `docs/preserved-capabilities.md` (documentation, N/A)

**Analog:** `.planning/REQUIREMENTS.md`

**Documentation structure pattern** (from `REQUIREMENTS.md`):
```markdown
# Preserved Capabilities - OpenClaw Overview

**Last updated:** 2026-05-06
**Phase:** 1 - Trace Contract & Brownfield Reset

## Overview
[Summary of what this document tracks]

## Gateway-Exclusive Capabilities
[Capabilities that require Gateway connection]
- Agent live status
- Real-time activity stream
- Gateway connection health

## File-Replaceable Capabilities
[Capabilities that can work with local file parsing]
- Sessions list
- KPI metrics
- Skills inventory

## Dependency Mapping
[Table mapping each capability to its data source]
```

**Table pattern** (from `REQUIREMENTS.md`):
```markdown
| Capability | Data Source | Status | Notes |
|------------|-------------|--------|-------|
| Agent status | Gateway | Preserved | Requires WebSocket connection |
| Sessions list | File | Replaceable | Will use ingest service in Phase 2 |
```

---

### Documentation Updates (PROJECT.md, AGENTS.md)

**Analog:** Existing `PROJECT.md` and `AGENTS.md`

**Update pattern** (brownfield reset):
- Replace "OVAO" with "agent-tracing-dashboard" in visible text
- Keep cyberpunk HUD design language references (D-11)
- Update product positioning from single-source (OpenClaw) to multi-source
- Preserve Gateway capability references (mark as "current implementation")

**Search-and-replace scope** (per D-09):
- Documentation: `.planning/*.md`, `PROJECT.md`, `AGENTS.md`, `README.md`
- Visible labels: page titles, navigation text, headers
- NO component names, NO route paths, NO directory structure

---

### `.planning/` Cleanup (maintenance, N/A)

**Pattern:** Delete old phase artifacts per git status

**Files to delete** (from git status):
```bash
# Old phase directories (already deleted in current state)
.planning/phases/01-scaffolding-toolchain/
.planning/phases/02-design-tokens-theme/
.planning/phases/03-shell-layout-base-components/
.planning/phases/04-agent-dashboard/
.planning/phases/06-activity-console/
.planning/phases/07-sessions-dashboard/

# If debug/quick/ui-reviews exist in main branch:
.planning/debug/
.planning/quick/
.planning/ui-reviews/
```

**Cleanup command** (to be used in plan):
```bash
git rm -r .planning/phases/[old-phase-dirs]
git commit -m "chore(phase-1): remove old .planning phase artifacts"
```

---

## Shared Patterns

### TypeScript Type System

**Source:** `gateway/types.ts`, `gateway/adapter-types.ts`
**Apply to:** `types/trace.ts`

```typescript
// String literal unions for enums
export type TraceSource = 'openclaw' | 'claude-code' | 'codex'

// Discriminated unions for variant types
export type TraceActivity =
  | TraceToolCall
  | TraceSkillUse
  | TraceSubagentLink

// Optional fields with clear semantic meaning
export interface TraceSession {
  id: string
  source: TraceSource
  startedAt: string | null  // null if unknown
  endedAt: string | null
  // ...
}

// Generic type parameters for reusability
export interface GatewayResponseOk<T = unknown> {
  payload: T
}
```

### File I/O with Node.js Built-ins

**Source:** `lib/gateway-config.ts`
**Apply to:** `lib/parseFixture.ts`

```typescript
import fs from "node:fs";
import path from "node:path";

// Use path.join() for cross-platform compatibility
const CONFIG_PATH = path.join(process.cwd(), ".ovao-config.json");

// Use try/catch for file operations
try {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  // ...
} catch {
  return null;
}

// Atomic write pattern (for future reference)
const tmpPath = `${CONFIG_PATH}.tmp`;
fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
fs.renameSync(tmpPath, CONFIG_PATH);
```

### Streaming JSONL Parsing

**Source:** `gateway/event-parser.ts` (line-by-line event processing)
**Apply to:** `lib/parseFixture.ts`

```typescript
import { createInterface } from 'readline';
import { createReadStream } from 'fs';

const rl = createInterface({
  input: createReadStream(filePath),
  crlfDelay: Infinity  // Handle different line endings
});

for await (const line of rl) {
  if (line.trim()) {
    // Parse JSON line
    const obj = JSON.parse(line);
    // Process obj
  }
}
```

### Path Alias Imports

**Source:** All project files use `@/` alias
**Apply to:** All new files

```typescript
// Use @/ alias for project imports
import { TraceSession } from '@/types/trace'
import { parseFixture } from '@/lib/parseFixture'

// Don't use relative paths like:
// import { TraceSession } from '../../types/trace'
```

### Error Handling

**Source:** `gateway/types.ts` (ErrorShape), `lib/gateway-config.ts` (try/catch)
**Apply to:** `lib/parseFixture.ts`, error types in `types/trace.ts`

```typescript
// Define error shapes explicitly
export interface ErrorShape {
  code: string;
  message: string;
  retryable?: boolean;
}

// Use try/catch for I/O operations
try {
  const raw = fs.readFileSync(filePath, 'utf-8');
} catch (err) {
  // Handle error gracefully
  return null;
}

// For parseFixture, count errors but don't throw
metrics.parserMalformedLines++;
```

### Documentation Style

**Source:** `.planning/REQUIREMENTS.md`, `.planning/RESEARCH.md`
**Apply to:** `docs/preserved-capabilities.md`

```markdown
# Title

**Metadata:** Last updated, phase, status

## Overview
[High-level summary]

## Detailed Sections
[Use tables for structured data]
[Use code blocks for examples]
[Use bullet lists for enumeration]

## References
[Link to related files]
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/fixtures.test.ts` | test | request-response | No existing test framework in project |
| `vitest.config.ts` | config | N/A | No existing test config |

**Guidance for these files:**
- Use RESEARCH.md "Code Examples" section for test structure
- Use RESEARCH.md "Standard Stack" for vitest configuration
- Follow agentsview Go test patterns (behavioral reference) adapted to TypeScript/vitest

---

## Metadata

**Analog search scope:**
- `/gateway/*.ts` — Gateway protocol and adapter types
- `/lib/*.ts` — Utility functions and file I/O patterns
- `../references/agentsview/internal/parser/testdata/` — Fixture file structure
- `../references/agentsview/internal/parser/types.go` — Type definition patterns

**Files scanned:**
- `gateway/types.ts` (132 lines)
- `gateway/adapter-types.ts` (98 lines)
- `gateway/event-parser.ts` (referenced, not read in full)
- `lib/utils.ts` (7 lines)
- `lib/gateway-config.ts` (37 lines)
- `../references/agentsview/internal/parser/types.go` (first 100 lines)
- `../references/agentsview/internal/parser/testdata/claude/valid_session.jsonl` (5 lines)
- `../references/agentsview/internal/parser/testdata/codex/standard_session.jsonl` (4 lines)

**Pattern extraction date:** 2026-05-06
**Project location:** `/Users/ebbi/Work/ai-dashboard-projects/agents-tracing-dashboard`
