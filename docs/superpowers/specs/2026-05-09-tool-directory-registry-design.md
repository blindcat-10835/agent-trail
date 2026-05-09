# Tool Directory Registry

**Date:** 2026-05-09
**Status:** Draft
**Scope:** Ingest backend only — no frontend changes

## Problem

Tool session directory paths are hardcoded across multiple files:

- `ingest/sync/sources.ts` — three `discoverXxxSources()` with inline defaults
- `ingest/sync/index.ts` — `getSourcePath()` with switch-case defaults
- `lib/logs.ts` — isolated `.openclaw` paths
- `app/api/sessions/messages/route.ts` — legacy hardcoded path

Only Claude Code and Codex support env var overrides. OpenClaw has none. No config file support. No multi-directory scanning.

## Solution

Follow agentsview's Registry pattern: a centralized array of tool definitions with layered configuration resolution (env var > config.json > built-in defaults).

## Design

### 1. Data Structure (`ingest/config/tool-dirs.ts`)

```typescript
interface ToolDirDef {
  type: SourceToolId        // 'openclaw' | 'claude-code' | 'codex'
  displayName: string
  envVar: string            // env var that overrides directory list
  configKey: string         // key in config.json
  defaultDirs: string[]     // paths relative to $HOME
}

const TOOL_DIR_REGISTRY: ToolDirDef[] = [
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
]
```

### 2. Resolution Priority

`resolveToolDirs(configFile?)` returns `Map<SourceToolId, string[]>`:

```
1. Environment variable  → single-element array (overrides config.json)
2. config.json           → array from file (relative paths resolve to $HOME)
3. Built-in defaults     → defaultDirs joined with $HOME
```

Env var names match agentsview (`OPENCLAW_DIR`, `CLAUDE_PROJECTS_DIR`, `CODEX_SESSIONS_DIR`). The old names (`CLAUDE_SESSIONS_PATH`, `CODEX_SESSIONS_PATH`) are NOT preserved.

### 3. Config File

Location: `~/.agents-tracing/config.json`
Override: `AGENTS_TRACING_CONFIG` env var

```json
{
  "openclaw_dirs": ["/Users/ebbi/.openclaw/agents", "/data/openclaw-backup/agents"],
  "claude_project_dirs": ["/Users/ebbi/.claude/projects"],
  "codex_sessions_dirs": ["/Users/ebbi/.codex/sessions"]
}
```

Missing file = use defaults. No error.

### 4. sources.ts Changes

Each `discoverXxxSources()` accepts `dirs?: string[]` instead of resolving paths internally:

```typescript
// Before
export async function discoverOpenClawSources(config?: { workspacePath?: string })

// After
export async function discoverOpenClawSources(dirs?: string[]): Promise<DiscoveredSource[]>
```

Internal scanning logic (find `.jsonl` files, count sessions, validate paths) unchanged.

Delete `getSourcePath()` — its role is replaced by the Registry.

### 5. IngestConfig Integration

`IngestConfig` gains one field:

```typescript
interface IngestConfig {
  // ...existing fields...
  toolDirs: Map<SourceToolId, string[]>
}
```

`loadConfig()` calls `resolveToolDirs()` and attaches the result.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `ingest/config/tool-dirs.ts` | **New** | Registry, resolveToolDirs(), loadConfigFile() |
| `ingest/config/index.ts` | Modify | Add toolDirs to IngestConfig, call resolveToolDirs() |
| `ingest/sync/sources.ts` | Modify | Discover functions read from config, delete getSourcePath() |
| `ingest/sync/index.ts` | Modify | Update callers of getSourcePath() to use config.toolDirs |

## Out of Scope

- Frontend Settings UI (future phase)
- `lib/logs.ts` cleanup (different concern — cron/log paths, not session data)
- `app/api/sessions/messages/route.ts` cleanup (legacy route, separate task)
- Backward compat for old env var names (`CLAUDE_SESSIONS_PATH`, `CODEX_SESSIONS_PATH`)

## Reference

- agentsview Registry: `../references/agentsview/internal/parser/types.go`
- agentsview config: `../references/agentsview/internal/config/config.go`
- Research doc: `docs/research-tool-directory-discovery.md`
