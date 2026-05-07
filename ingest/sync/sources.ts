/**
 * Source Discovery and Configuration
 *
 * Discovers and configures data sources (OpenClaw, Claude Code, Codex)
 * for the ingest service. Handles environment variable resolution and
 * session directory enumeration.
 *
 * @module ingest/sync/sources
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TraceSource } from '@/types/trace';

// ============================================================================
// Path Boundary Enforcement
// ============================================================================

/**
 * Validate that a candidate path is within an allowed root directory.
 * Uses resolved absolute paths to prevent traversal bypass via symlinks
 * or `..` segments.
 *
 * @param candidatePath - The path to validate
 * @param allowedRoot   - The allowed root directory
 * @returns true if candidatePath is within allowedRoot
 */
export function isWithinRoot(candidatePath: string, allowedRoot: string): boolean {
  const resolved = path.resolve(candidatePath);
  const root = path.resolve(allowedRoot);
  return resolved.startsWith(root + path.sep) || resolved === root;
}

/**
 * Source configuration
 *
 * Represents a configured source with path and enabled state
 */
export interface SourceConfig {
  type: TraceSource;
  path: string;
  enabled: boolean;
}

/**
 * Discovered source with metadata
 *
 * Result of source discovery with session count and status
 */
export interface DiscoveredSource {
  type: TraceSource;
  path: string;
  sessionCount: number;
  lastSyncAt?: string;
  error?: string;
}

async function discoverJsonlDirectories(
  type: TraceSource,
  rootPath: string,
  missingMessage: string
): Promise<DiscoveredSource[]> {
  try {
    await fs.access(rootPath);
    const directories = await collectJsonlDirectories(rootPath);

    if (directories.length === 0) {
      return [{ type, path: rootPath, sessionCount: 0 }];
    }

    return directories.map((source) => ({
      type,
      path: source.path,
      sessionCount: source.sessionCount,
    }));
  } catch (err) {
    return [
      {
        type,
        path: rootPath,
        sessionCount: 0,
        error: err instanceof Error ? err.message : missingMessage,
      },
    ];
  }
}

async function collectJsonlDirectories(
  rootPath: string
): Promise<Array<{ path: string; sessionCount: number }>> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true }) as Array<
    string | { name: string; isDirectory(): boolean; isFile(): boolean }
  >;
  let sessionCount = 0;
  const nestedSources: Array<{ path: string; sessionCount: number }> = [];

  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry.name;
    const entryPath = path.join(rootPath, name);
    const isDirectory =
      typeof entry === 'string' ? false : entry.isDirectory();
    const isFile = typeof entry === 'string' ? true : entry.isFile();

    if (isFile && name.endsWith('.jsonl')) {
      sessionCount += 1;
      continue;
    }

    if (isDirectory) {
      nestedSources.push(...await collectJsonlDirectories(entryPath));
    }
  }

  if (sessionCount > 0) {
    return [{ path: rootPath, sessionCount }, ...nestedSources];
  }

  return nestedSources;
}

/**
 * Discover OpenClaw sources from workspace configuration
 *
 * Uses WORKSPACE_PATH environment variable to locate OpenClaw agents directory.
 * Each agent has its own sessions subdirectory, which is treated as a separate source.
 *
 * @param config - Optional workspace path override
 * @returns Array of discovered OpenClaw sources
 */
export async function discoverOpenClawSources(config?: {
  workspacePath?: string;
}): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];

  // Default path: ~/.openclaw/agents (overridable via WORKSPACE_PATH or config)
  const openclawBase = config?.workspacePath
    ? config.workspacePath.replace(/\/+$/, '').replace(/\/workspace$/, '')
    : process.env.WORKSPACE_PATH
      ? process.env.WORKSPACE_PATH.replace(/\/+$/, '').replace(/\/workspace$/, '')
      : path.join(os.homedir(), '.openclaw');
  const agentsDir = path.join(openclawBase, 'agents');

  try {
    // Check if agents directory exists
    await fs.access(agentsDir);

    // List all agent directories
    const agentDirs = await fs.readdir(agentsDir);

    for (const agentDir of agentDirs) {
      const sessionsPath = path.join(agentsDir, agentDir, 'sessions');

      try {
        // Check if sessions directory exists
        await fs.access(sessionsPath);

        // Count session files
        const files = await fs.readdir(sessionsPath);
        const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

        sources.push({
          type: 'openclaw',
          path: sessionsPath,
          sessionCount: sessionFiles.length,
        });
      } catch {
        // Agent has no sessions directory, skip
      }
    }

    // If no agents found, still report source as discovered
    if (sources.length === 0) {
      sources.push({
        type: 'openclaw',
        path: agentsDir,
        sessionCount: 0,
        error: 'No agent sessions found',
      });
    }
  } catch (err) {
    sources.push({
      type: 'openclaw',
      path: agentsDir,
      sessionCount: 0,
      error: err instanceof Error ? err.message : 'Failed to access agents directory',
    });
  }

  // Validate all discovered paths are within the configured root
  return sources.filter((s) => {
    if (!s.path) return true;
    if (!isWithinRoot(s.path, agentsDir)) {
      console.warn(`[sources] Rejected path outside root: ${s.path} (root: ${agentsDir})`);
      return false;
    }
    return true;
  });
}

/**
 * Discover Claude Code sources from projects/session directories
 *
 * Uses CLAUDE_SESSIONS_PATH environment variable or defaults to
 * ~/.claude/projects/. Recursively discovers directories containing .jsonl
 * transcripts so both project sessions and subagent sessions can be synced.
 *
 * Per D-12: overridable via CLAUDE_SESSIONS_PATH env var.
 *
 * @param config - Optional sessions path override
 * @returns Array of discovered Claude Code sources
 */
export async function discoverClaudeSources(config?: {
  sessionsPath?: string;
}): Promise<DiscoveredSource[]> {
  // Resolve path: config override > env var > default
  let sessionsPath = config?.sessionsPath || process.env.CLAUDE_SESSIONS_PATH || '';
  if (!sessionsPath) {
    sessionsPath = path.join(os.homedir(), '.claude', 'projects');
  }

  const results = await discoverJsonlDirectories(
    'claude-code',
    sessionsPath,
    'Claude sessions directory not found'
  );

  // Validate all discovered paths are within the configured root
  return results.filter((s) => {
    if (!s.path) return true;
    if (!isWithinRoot(s.path, sessionsPath)) {
      console.warn(`[sources] Rejected Claude path outside root: ${s.path} (root: ${sessionsPath})`);
      return false;
    }
    return true;
  });
}

/**
 * Discover Codex sources from sessions directory
 *
 * Uses CODEX_SESSIONS_PATH environment variable or defaults to ~/.codex/sessions/.
 * Recursively discovers directories containing .jsonl transcripts.
 *
 * Per D-13: Default path ~/.codex/sessions/, overridable via CODEX_SESSIONS_PATH env var.
 *
 * @param config - Optional sessions path override
 * @returns Array of discovered Codex sources
 */
export async function discoverCodexSources(config?: {
  sessionsPath?: string;
}): Promise<DiscoveredSource[]> {
  // Resolve path: config override > env var > default
  let sessionsPath = config?.sessionsPath || process.env.CODEX_SESSIONS_PATH || '';
  if (!sessionsPath) {
    sessionsPath = path.join(os.homedir(), '.codex', 'sessions');
  }

  const results = await discoverJsonlDirectories(
    'codex',
    sessionsPath,
    'Codex sessions directory not found'
  );

  // Validate all discovered paths are within the configured root
  return results.filter((s) => {
    if (!s.path) return true;
    if (!isWithinRoot(s.path, sessionsPath)) {
      console.warn(`[sources] Rejected Codex path outside root: ${s.path} (root: ${sessionsPath})`);
      return false;
    }
    return true;
  });
}

/**
 * Get source configuration for a specific source type
 *
 * Returns configuration for all discovered sources of the given type.
 * Supports OpenClaw, Claude Code, and Codex sources.
 *
 * @param sourceType - Type of source to configure
 * @returns Array of source configurations
 */
export async function getSourceConfig(sourceType: TraceSource): Promise<SourceConfig[]> {
  if (sourceType === 'openclaw') {
    const sources = await discoverOpenClawSources();
    return sources.map((s) => ({
      type: s.type,
      path: s.path,
      enabled: !s.error,
    }));
  }

  if (sourceType === 'claude-code') {
    const sources = await discoverClaudeSources();
    return sources.map((s) => ({
      type: s.type,
      path: s.path,
      enabled: !s.error,
    }));
  }

  if (sourceType === 'codex') {
    const sources = await discoverCodexSources();
    return sources.map((s) => ({
      type: s.type,
      path: s.path,
      enabled: !s.error,
    }));
  }

  return [];
}

/**
 * Get the base path for a source type
 *
 * Helper function to resolve the default path for a source type
 * based on environment variables and conventions.
 *
 * @param sourceType - Type of source
 * @returns Path to source directory or empty string if not found
 */
export function getSourcePath(sourceType: TraceSource): string {
  switch (sourceType) {
    case 'openclaw': {
      const workspace = process.env.WORKSPACE_PATH
        ? process.env.WORKSPACE_PATH.replace(/\/+$/, '').replace(/\/workspace$/, '')
        : path.join(os.homedir(), '.openclaw');
      return path.join(workspace, 'agents');
    }
    case 'claude-code':
      return process.env.CLAUDE_SESSIONS_PATH || path.join(os.homedir(), '.claude', 'projects');
    case 'codex':
      return process.env.CODEX_SESSIONS_PATH || path.join(os.homedir(), '.codex', 'sessions');
    default:
      return '';
  }
}
