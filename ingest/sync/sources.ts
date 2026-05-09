/**
 * Source Discovery and Configuration
 *
 * Discovers and configures data sources (OpenClaw, Claude Code, Codex)
 * for the ingest service. Reads scan directories from the resolved
 * IngestConfig (which pulls from env vars and defaults via tool-dirs.ts).
 *
 * @module ingest/sync/sources
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TraceSource } from '@/types/trace';
import { getConfig } from '../config';
import type { SourceToolId } from '@/lib/agent-tools/types';

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

// ============================================================================
// Config Helper
// ============================================================================

function getDefaultDirs(sourceType: SourceToolId): string[] {
  const config = getConfig();
  return config.toolDirs.get(sourceType) ?? [];
}

// ============================================================================
// Internal Discovery Helpers
// ============================================================================

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

// ============================================================================
// OpenClaw Discovery
// ============================================================================

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

// ============================================================================
// Claude Code Discovery
// ============================================================================

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

// ============================================================================
// Codex Discovery
// ============================================================================

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

// ============================================================================
// Source Config Resolution
// ============================================================================

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
  let sources: DiscoveredSource[];

  if (sourceType === 'openclaw') {
    sources = await discoverOpenClawSources();
  } else if (sourceType === 'claude-code') {
    sources = await discoverClaudeSources();
  } else if (sourceType === 'codex') {
    sources = await discoverCodexSources();
  } else {
    return [];
  }

  return sources.map((s) => ({
    type: s.type,
    path: s.path,
    enabled: !s.error,
  }));
}
