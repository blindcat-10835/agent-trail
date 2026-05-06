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

  // Default path: derive from WORKSPACE_PATH env var
  // WORKSPACE_PATH=/Users/xxx/.openclaw/workspace -> parent is /Users/xxx/.openclaw
  let basePath = process.env.WORKSPACE_PATH || '';
  if (config?.workspacePath) {
    basePath = config.workspacePath;
  }

  if (!basePath) {
    return [
      {
        type: 'openclaw',
        path: '',
        sessionCount: 0,
        error: 'WORKSPACE_PATH not configured',
      },
    ];
  }

  // Derive OpenClaw base directory
  const parts = basePath.replace(/\/+$/, '').split('/');
  parts.pop(); // remove "workspace"
  const openclawBase = parts.join('/');
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

  return sources;
}

/**
 * Discover Claude Code sources from sessions directory
 *
 * Uses CLAUDE_SESSIONS_PATH environment variable or defaults to ~/.claude/sessions/.
 * Lists all .jsonl files in the sessions directory and returns a single discovered source.
 *
 * Per D-12: Default path ~/.claude/sessions/, overridable via CLAUDE_SESSIONS_PATH env var.
 *
 * @param config - Optional sessions path override
 * @returns Array of discovered Claude Code sources
 */
export async function discoverClaudeSources(config?: {
  sessionsPath?: string;
}): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];

  // Resolve path: config override > env var > default
  let sessionsPath = config?.sessionsPath || process.env.CLAUDE_SESSIONS_PATH || '';
  if (!sessionsPath) {
    sessionsPath = path.join(os.homedir(), '.claude', 'sessions');
  }

  try {
    // Check if sessions directory exists
    await fs.access(sessionsPath);

    // List all JSONL files
    const files = await fs.readdir(sessionsPath);
    const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

    sources.push({
      type: 'claude-code',
      path: sessionsPath,
      sessionCount: sessionFiles.length,
    });
  } catch (err) {
    sources.push({
      type: 'claude-code',
      path: sessionsPath,
      sessionCount: 0,
      error: err instanceof Error ? err.message : 'Claude sessions directory not found',
    });
  }

  return sources;
}

/**
 * Discover Codex sources from sessions directory
 *
 * Uses CODEX_SESSIONS_PATH environment variable or defaults to ~/.codex/sessions/.
 * Lists all .jsonl files in the sessions directory and returns a single discovered source.
 *
 * Per D-13: Default path ~/.codex/sessions/, overridable via CODEX_SESSIONS_PATH env var.
 *
 * @param config - Optional sessions path override
 * @returns Array of discovered Codex sources
 */
export async function discoverCodexSources(config?: {
  sessionsPath?: string;
}): Promise<DiscoveredSource[]> {
  const sources: DiscoveredSource[] = [];

  // Resolve path: config override > env var > default
  let sessionsPath = config?.sessionsPath || process.env.CODEX_SESSIONS_PATH || '';
  if (!sessionsPath) {
    sessionsPath = path.join(os.homedir(), '.codex', 'sessions');
  }

  try {
    // Check if sessions directory exists
    await fs.access(sessionsPath);

    // List all JSONL files
    const files = await fs.readdir(sessionsPath);
    const sessionFiles = files.filter((f) => f.endsWith('.jsonl'));

    sources.push({
      type: 'codex',
      path: sessionsPath,
      sessionCount: sessionFiles.length,
    });
  } catch (err) {
    sources.push({
      type: 'codex',
      path: sessionsPath,
      sessionCount: 0,
      error: err instanceof Error ? err.message : 'Codex sessions directory not found',
    });
  }

  return sources;
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
    case 'openclaw':
      const workspace = process.env.WORKSPACE_PATH || '';
      if (!workspace) return '';
      const parts = workspace.replace(/\/+$/, '').split('/');
      parts.pop();
      return path.join(parts.join('/'), 'agents');
    case 'claude-code':
      return process.env.CLAUDE_SESSIONS_PATH || path.join(os.homedir(), '.claude', 'sessions');
    case 'codex':
      return process.env.CODEX_SESSIONS_PATH || path.join(os.homedir(), '.codex', 'sessions');
    default:
      return '';
  }
}
