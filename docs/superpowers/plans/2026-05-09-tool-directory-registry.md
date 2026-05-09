# Tool Directory Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered hardcoded tool directory paths with a centralized Registry + layered config resolution (env var > config.json > defaults).

**Architecture:** New `ingest/config/tool-dirs.ts` defines a `TOOL_DIR_REGISTRY` array with per-tool metadata. `resolveToolDirs()` reads config file, applies env var overrides, falls back to defaults. Three `discoverXxxSources()` functions in `sources.ts` read resolved dirs instead of hardcoding paths.

**Tech Stack:** TypeScript, Node.js fs/path/os, vitest

**Spec:** `docs/superpowers/specs/2026-05-09-tool-directory-registry-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `ingest/config/tool-dirs.ts` | **Create** | Registry definition, config file loader, resolveToolDirs() |
| `ingest/config/index.ts` | Modify | Add toolDirs to IngestConfig, call resolveToolDirs() |
| `ingest/sync/sources.ts` | Modify | Discover functions read from dirs param, delete getSourcePath() |
| `ingest/sync/index.ts` | Modify | Update syncXxxSource() callers to pass dirs from config |
| `tests/unit/ingest/tool-dirs.test.ts` | **Create** | Unit tests for tool-dirs.ts |
| `tests/unit/ingest/sources.test.ts` | Modify | Update tests for new function signatures and env var names |

---

### Task 1: Create tool-dirs.ts with Registry and resolveToolDirs()

**Files:**
- Create: `ingest/config/tool-dirs.ts`
- Create: `tests/unit/ingest/tool-dirs.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/ingest/tool-dirs.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('os', () => ({
  default: { homedir: () => '/mock/home' },
  homedir: () => '/mock/home',
}));

// Mock fs to prevent real file reads
vi.mock('fs', () => ({
  default: { existsSync: () => false, readFileSync: () => '' },
  existsSync: () => false,
  readFileSync: () => '',
}));

import {
  TOOL_DIR_REGISTRY,
  resolveToolDirs,
  type ToolDirDef,
} from '@/ingest/config/tool-dirs';

describe('TOOL_DIR_REGISTRY', () => {
  it('should contain entries for all three source types', () => {
    const types = TOOL_DIR_REGISTRY.map((d) => d.type);
    expect(types).toContain('openclaw');
    expect(types).toContain('claude-code');
    expect(types).toContain('codex');
    expect(types).toHaveLength(3);
  });

  it('should have envVar, configKey, and defaultDirs on every entry', () => {
    for (const def of TOOL_DIR_REGISTRY) {
      expect(def.envVar).toBeTruthy();
      expect(def.configKey).toBeTruthy();
      expect(def.defaultDirs.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveToolDirs', () => {
  beforeEach(() => {
    delete process.env.OPENCLAW_DIR;
    delete process.env.CLAUDE_PROJECTS_DIR;
    delete process.env.CODEX_SESSIONS_DIR;
    delete process.env.AGENTS_TRACING_CONFIG;
  });

  it('should return defaults when no env vars or config file', () => {
    const dirs = resolveToolDirs();
    expect(dirs.get('openclaw')).toEqual(['/mock/home/.openclaw/agents']);
    expect(dirs.get('claude-code')).toEqual(['/mock/home/.claude/projects']);
    expect(dirs.get('codex')).toEqual(['/mock/home/.codex/sessions']);
  });

  it('should use env var override when set', () => {
    process.env.OPENCLAW_DIR = '/custom/openclaw';
    const dirs = resolveToolDirs();
    expect(dirs.get('openclaw')).toEqual(['/custom/openclaw']);
    // Others still default
    expect(dirs.get('claude-code')).toEqual(['/mock/home/.claude/projects']);
  });

  it('should use config file values when no env var', () => {
    const dirs = resolveToolDirs({
      openclaw_dirs: ['/config/openclaw1', '/config/openclaw2'],
    });
    expect(dirs.get('openclaw')).toEqual(['/config/openclaw1', '/config/openclaw2']);
  });

  it('should prefer env var over config file', () => {
    process.env.CLAUDE_PROJECTS_DIR = '/env/claude';
    const dirs = resolveToolDirs({
      claude_project_dirs: ['/config/claude'],
    });
    expect(dirs.get('claude-code')).toEqual(['/env/claude']);
  });

  it('should resolve relative config paths against homedir', () => {
    const dirs = resolveToolDirs({
      openclaw_dirs: ['.openclaw-alt/agents'],
    });
    expect(dirs.get('openclaw')).toEqual(['/mock/home/.openclaw-alt/agents']);
  });

  it('should keep absolute config paths as-is', () => {
    const dirs = resolveToolDirs({
      codex_sessions_dirs: ['/absolute/codex/sessions'],
    });
    expect(dirs.get('codex')).toEqual(['/absolute/codex/sessions']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/ingest/tool-dirs.test.ts`
Expected: FAIL — module `@/ingest/config/tool-dirs` does not exist

- [ ] **Step 3: Write the implementation**

```typescript
// ingest/config/tool-dirs.ts
/**
 * Tool Directory Registry
 *
 * Centralized tool directory definitions with layered config resolution.
 * Priority: environment variable > config.json > built-in defaults.
 *
 * @see docs/superpowers/specs/2026-05-09-tool-directory-registry-design.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { SourceToolId } from '@/lib/agent-tools/types';

export interface ToolDirDef {
  type: SourceToolId;
  displayName: string;
  envVar: string;
  configKey: string;
  defaultDirs: string[];
}

export const TOOL_DIR_REGISTRY: ToolDirDef[] = [
  {
    type: 'openclaw',
    displayName: 'OpenClaw',
    envVar: 'OPENCLAW_DIR',
    configKey: 'openclaw_dirs',
    defaultDirs: ['.openclaw/agents'],
  },
  {
    type: 'claude-code',
    displayName: 'Claude Code',
    envVar: 'CLAUDE_PROJECTS_DIR',
    configKey: 'claude_project_dirs',
    defaultDirs: ['.claude/projects'],
  },
  {
    type: 'codex',
    displayName: 'Codex',
    envVar: 'CODEX_SESSIONS_DIR',
    configKey: 'codex_sessions_dirs',
    defaultDirs: ['.codex/sessions'],
  },
];

interface ToolConfigFile {
  [key: string]: unknown;
}

function loadConfigFile(): ToolConfigFile | null {
  const configPath =
    process.env.AGENTS_TRACING_CONFIG ||
    path.join(os.homedir(), '.agents-tracing', 'config.json');

  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resolveToolDirs(configOverride?: ToolConfigFile): Map<SourceToolId, string[]> {
  const home = os.homedir();
  const configFile = configOverride ?? loadConfigFile();
  const result = new Map<SourceToolId, string[]>();

  for (const def of TOOL_DIR_REGISTRY) {
    // Priority 1: environment variable
    const envVal = process.env[def.envVar];
    if (envVal) {
      result.set(def.type, [envVal]);
      continue;
    }

    // Priority 2: config file
    const configVal = configFile?.[def.configKey];
    if (Array.isArray(configVal) && configVal.length > 0 && typeof configVal[0] === 'string') {
      result.set(
        def.type,
        configVal.map((p: string) => (path.isAbsolute(p) ? p : path.join(home, p)))
      );
      continue;
    }

    // Priority 3: built-in defaults
    result.set(def.type, def.defaultDirs.map((p) => path.join(home, p)));
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/ingest/tool-dirs.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add ingest/config/tool-dirs.ts tests/unit/ingest/tool-dirs.test.ts
git commit -m "feat(ingest): add tool directory registry with layered config resolution"
```

---

### Task 2: Integrate toolDirs into IngestConfig

**Files:**
- Modify: `ingest/config/index.ts`

- [ ] **Step 1: Add toolDirs field to IngestConfig and populate in loadConfig()**

In `ingest/config/index.ts`, add the import and field:

```typescript
// Add at top with other imports:
import { resolveToolDirs } from './tool-dirs';
import type { SourceToolId } from '@/lib/agent-tools/types';

// In IngestConfig interface, add after debugMode:
export interface IngestConfig {
  port: number;
  dbPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  resyncIntervalMs: number;
  debounceMs: number;
  startupSyncLimit: number;
  backgroundSyncEnabled: boolean;
  rateLimitRPM: number;
  rateLimitEnabled: boolean;
  debugMode: boolean;
  toolDirs: Map<SourceToolId, string[]>;
}
```

In `loadConfig()`, add before the `const config: IngestConfig = {` block:

```typescript
  const toolDirs = resolveToolDirs();
```

Add `toolDirs` to the config object:

```typescript
  const config: IngestConfig = {
    port,
    dbPath,
    logLevel,
    resyncIntervalMs,
    debounceMs,
    startupSyncLimit,
    backgroundSyncEnabled,
    rateLimitRPM,
    rateLimitEnabled,
    debugMode,
    toolDirs,
  };
```

Add `toolDirs` to the console.log:

```typescript
  console.log('Configuration loaded:', {
    port: config.port,
    dbPath: config.dbPath,
    logLevel: config.logLevel,
    resyncIntervalMs: config.resyncIntervalMs,
    debounceMs: config.debounceMs,
    startupSyncLimit: config.startupSyncLimit,
    backgroundSyncEnabled: config.backgroundSyncEnabled,
    rateLimitRPM: config.rateLimitRPM,
    rateLimitEnabled: config.rateLimitEnabled,
    debugMode: config.debugMode,
    toolDirs: Object.fromEntries(config.toolDirs),
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --project ingest/tsconfig.json 2>&1 | head -20`
Expected: No errors related to `tool-dirs.ts` or `index.ts`

- [ ] **Step 3: Commit**

```bash
git add ingest/config/index.ts
git commit -m "feat(ingest): add toolDirs to IngestConfig from registry"
```

---

### Task 3: Refactor sources.ts to read from config

**Files:**
- Modify: `ingest/sync/sources.ts`

- [ ] **Step 1: Update discoverOpenClawSources signature and body**

Replace the existing `discoverOpenClawSources` function (lines 131-196) with:

```typescript
/**
 * Discover OpenClaw sources from configured directories
 *
 * Scans each configured directory for agent session subdirectories.
 * @param dirs - Optional directory list override; defaults to resolved config
 */
export async function discoverOpenClawSources(dirs?: string[]): Promise<DiscoveredSource[]> {
  const scanDirs = dirs ?? getDefaultDirs('openclaw');
  const allSources: DiscoveredSource[] = [];

  for (const dir of scanDirs) {
    const sources = await discoverSingleOpenClawDir(dir);
    allSources.push(...sources);
  }

  if (allSources.length === 0 && scanDirs.length > 0) {
    allSources.push({
      type: 'openclaw',
      path: scanDirs[0],
      sessionCount: 0,
      error: 'No agent sessions found',
    });
  }

  return allSources;
}

async function discoverSingleOpenClawDir(agentsDir: string): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];

  try {
    await fs.access(agentsDir);
    const agentDirs = await fs.readdir(agentsDir);

    for (const agentDir of agentDirs) {
      const sessionsPath = path.join(agentsDir, agentDir, 'sessions');
      try {
        await fs.access(sessionsPath);
        const files = await fs.readdir(sessionsPath);
        const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));
        sources.push({ type: 'openclaw', path: sessionsPath, sessionCount: sessionFiles.length });
      } catch {
        // Agent has no sessions directory, skip
      }
    }

    if (sources.length === 0) {
      sources.push({ type: 'openclaw', path: agentsDir, sessionCount: 0, error: 'No agent sessions found' });
    }
  } catch (err) {
    sources.push({
      type: 'openclaw',
      path: agentsDir,
      sessionCount: 0,
      error: err instanceof Error ? err.message : 'Failed to access agents directory',
    });
  }

  return sources.filter((s) => {
    if (!s.path) return true;
    if (!isWithinRoot(s.path, agentsDir)) {
      console.warn(`[sources] Rejected path outside root: ${s.path} (root: ${agentsDir})`);
      return false;
    }
    return true;
  });
}
```

- [ ] **Step 2: Update discoverClaudeSources signature and body**

Replace the existing `discoverClaudeSources` function (lines 210-234) with:

```typescript
/**
 * Discover Claude Code sources from configured directories
 *
 * @param dirs - Optional directory list override; defaults to resolved config
 */
export async function discoverClaudeSources(dirs?: string[]): Promise<DiscoveredSource[]> {
  const scanDirs = dirs ?? getDefaultDirs('claude-code');
  const allSources: DiscoveredSource[] = [];

  for (const dir of scanDirs) {
    const results = await discoverJsonlDirectories('claude-code', dir, 'Claude sessions directory not found');
    allSources.push(...results.filter((s) => {
      if (!s.path) return true;
      if (!isWithinRoot(s.path, dir)) {
        console.warn(`[sources] Rejected Claude path outside root: ${s.path} (root: ${dir})`);
        return false;
      }
      return true;
    }));
  }

  return allSources;
}
```

- [ ] **Step 3: Update discoverCodexSources signature and body**

Replace the existing `discoverCodexSources` function (lines 247-271) with:

```typescript
/**
 * Discover Codex sources from configured directories
 *
 * @param dirs - Optional directory list override; defaults to resolved config
 */
export async function discoverCodexSources(dirs?: string[]): Promise<DiscoveredSource[]> {
  const scanDirs = dirs ?? getDefaultDirs('codex');
  const allSources: DiscoveredSource[] = [];

  for (const dir of scanDirs) {
    const results = await discoverJsonlDirectories('codex', dir, 'Codex sessions directory not found');
    allSources.push(...results.filter((s) => {
      if (!s.path) return true;
      if (!isWithinRoot(s.path, dir)) {
        console.warn(`[sources] Rejected Codex path outside root: ${s.path} (root: ${dir})`);
        return false;
      }
      return true;
    }));
  }

  return allSources;
}
```

- [ ] **Step 4: Add getDefaultDirs helper and delete getSourcePath**

Add this helper after the `isWithinRoot` function. Import `getConfig` from config:

```typescript
import { getConfig } from '../config';
import type { SourceToolId } from '@/lib/agent-tools/types';

function getDefaultDirs(sourceType: SourceToolId): string[] {
  const config = getConfig();
  return config.toolDirs.get(sourceType) ?? [];
}
```

Delete the entire `getSourcePath` function (lines 322-334).

Delete the `import * as os from 'os';` line since it is no longer used directly in this file.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --project ingest/tsconfig.json 2>&1 | head -20`
Expected: No errors related to sources.ts

- [ ] **Step 6: Commit**

```bash
git add ingest/sync/sources.ts
git commit -m "refactor(ingest): discover functions read dirs from registry config"
```

---

### Task 4: Update sync/index.ts callers

**Files:**
- Modify: `ingest/sync/index.ts`

- [ ] **Step 1: Update syncOpenClawSource to pass dirs**

In `syncOpenClawSource` (line 673-720), change the discover call:

```typescript
// Before:
const sources = await discoverOpenClawSources({ workspacePath: opts.basePath });

// After:
const toolDirs = (await import('../config')).getConfig().toolDirs;
const dirs = opts.basePath ? [opts.basePath] : toolDirs.get('openclaw');
const sources = await discoverOpenClawSources(dirs);
```

- [ ] **Step 2: Update syncClaudeCodeSource to pass dirs**

In `syncClaudeCodeSource` (line 732-781), change:

```typescript
// Before:
const sources = await discoverClaudeSources();

// After:
const toolDirs = (await import('../config')).getConfig().toolDirs;
const sources = await discoverClaudeSources(toolDirs.get('claude-code'));
```

- [ ] **Step 3: Update syncCodexSource to pass dirs**

In `syncCodexSource` (line 793-852), change:

```typescript
// Before:
const sources = await discoverCodexSources();

// After:
const toolDirs = (await import('../config')).getConfig().toolDirs;
const sources = await discoverCodexSources(toolDirs.get('codex'));
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --project ingest/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add ingest/sync/index.ts
git commit -m "refactor(ingest): sync callers pass dirs from registry config"
```

---

### Task 5: Update tests

**Files:**
- Modify: `tests/unit/ingest/sources.test.ts`

- [ ] **Step 1: Add mock for config module**

Add after the existing `vi.mock('fs/promises', ...)` block:

```typescript
// Mock ingest/config to return predictable toolDirs
vi.mock('@/ingest/config', () => ({
  getConfig: () => ({
    toolDirs: new Map([
      ['openclaw', ['/mock/home/user/.openclaw/agents']],
      ['claude-code', ['/mock/home/user/.claude/projects']],
      ['codex', ['/mock/home/user/.codex/sessions']],
    ]),
  }),
}));
```

- [ ] **Step 2: Update discoverClaudeSources tests**

Remove env var `CLAUDE_SESSIONS_PATH` references. Replace with direct `dirs` parameter tests.

In `beforeEach`, change:

```typescript
// Before:
delete process.env.CLAUDE_SESSIONS_PATH;
delete process.env.CODEX_SESSIONS_PATH;

// After:
// (remove these delete lines — no longer relevant)
```

Update "should use default path" test — it now uses config:

```typescript
it('should use dirs from config when no dirs param', async () => {
  mockAccess.mockResolvedValue(undefined);
  mockReaddir.mockResolvedValue(['session1.jsonl']);

  await discoverClaudeSources();

  expect(mockAccess).toHaveBeenCalled();
  const accessedPath = mockAccess.mock.calls[0][0];
  expect(accessedPath).toContain('.claude');
  expect(accessedPath).toContain('projects');
});
```

Update "should use CLAUDE_SESSIONS_PATH env var" test to test dirs param instead:

```typescript
it('should use dirs param override when provided', async () => {
  mockAccess.mockResolvedValue(undefined);
  mockReaddir.mockResolvedValue(['session1.jsonl']);

  await discoverClaudeSources(['/custom/claude/sessions']);

  expect(mockAccess.mock.calls[0][0]).toBe('/custom/claude/sessions');
});
```

Delete the old "should use config.sessionsPath override" test (replaced by dirs param test above).

- [ ] **Step 3: Update discoverCodexSources tests**

Same pattern as Claude — replace env var tests with dirs param tests:

```typescript
it('should use dirs param override when provided', async () => {
  mockAccess.mockResolvedValue(undefined);
  mockReaddir.mockResolvedValue(['session1.jsonl']);

  await discoverCodexSources(['/override/codex/path']);

  expect(mockAccess.mock.calls[0][0]).toBe('/override/codex/path');
});
```

- [ ] **Step 4: Update getSourceConfig tests**

In `getSourceConfig` describe block, remove env var deletes from `beforeEach` (no longer used by these functions). The tests should pass unchanged since `getSourceConfig` calls discover functions without args, which use config.

- [ ] **Step 5: Update or remove getSourcePath tests**

Delete the entire `describe('getSourcePath', ...)` block (lines 327-371) since `getSourcePath` is removed.

Remove `getSourcePath` from the import at line 33:

```typescript
// Before:
import {
  discoverClaudeSources,
  discoverCodexSources,
  getSourceConfig,
  getSourcePath,
  SourceConfig,
  DiscoveredSource,
} from '@/ingest/sync/sources';

// After:
import {
  discoverClaudeSources,
  discoverCodexSources,
  getSourceConfig,
  type SourceConfig,
  type DiscoveredSource,
} from '@/ingest/sync/sources';
```

- [ ] **Step 6: Run all ingest tests**

Run: `pnpm exec vitest run tests/unit/ingest/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add tests/unit/ingest/sources.test.ts
git commit -m "test(ingest): update sources tests for registry-based dir resolution"
```

---

### Task 6: Build verification and smoke test

**Files:**
- No new files

- [ ] **Step 1: Run full TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm exec vitest run`
Expected: All tests PASS

- [ ] **Step 3: Start dev server and verify ingest loads**

Run: `pnpm dev`

Check terminal output for:
```
Configuration loaded: { ... toolDirs: { openclaw: [...], 'claude-code': [...], codex: [...] } }
```

Verify ingest sync still discovers sessions from default paths.

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(ingest): address build/test issues from registry integration"
```
(Only if needed — skip if everything passes clean.)
