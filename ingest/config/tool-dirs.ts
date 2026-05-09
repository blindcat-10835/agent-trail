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
