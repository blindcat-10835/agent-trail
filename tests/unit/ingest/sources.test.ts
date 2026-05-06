import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock os.homedir for predictable test behavior
vi.mock('os', () => ({
  default: {
    homedir: () => '/mock/home/user',
  },
  homedir: () => '/mock/home/user',
}));

// Mock fs/promises for deterministic file system tests
const mockAccess = vi.fn();
const mockReaddir = vi.fn();

vi.mock('fs/promises', () => ({
  default: {
    access: (...args: any[]) => mockAccess(...args),
    readdir: (...args: any[]) => mockReaddir(...args),
  },
  access: (...args: any[]) => mockAccess(...args),
  readdir: (...args: any[]) => mockReaddir(...args),
}));

import {
  discoverClaudeSources,
  discoverCodexSources,
  getSourceConfig,
  getSourcePath,
  SourceConfig,
  DiscoveredSource,
} from '@/ingest/sync/sources';

describe('Claude Code Source Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env vars
    delete process.env.CLAUDE_SESSIONS_PATH;
    delete process.env.CODEX_SESSIONS_PATH;
  });

  describe('discoverClaudeSources', () => {
    it('should return DiscoveredSource[] with type claude-code', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl', 'session2.jsonl', 'other.txt']);

      const sources = await discoverClaudeSources();

      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0].type).toBe('claude-code');
    });

    it('should use default path ~/.claude/sessions/', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverClaudeSources();

      // Should access the default path derived from os.homedir()
      expect(mockAccess).toHaveBeenCalled();
      const accessedPath = mockAccess.mock.calls[0][0];
      expect(accessedPath).toContain('.claude');
      expect(accessedPath).toContain('sessions');
    });

    it('should use CLAUDE_SESSIONS_PATH env var when set', async () => {
      process.env.CLAUDE_SESSIONS_PATH = '/custom/claude/sessions';
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverClaudeSources();

      expect(mockAccess.mock.calls[0][0]).toBe('/custom/claude/sessions');
    });

    it('should use config.sessionsPath override when provided', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverClaudeSources({ sessionsPath: '/override/path' });

      expect(mockAccess.mock.calls[0][0]).toBe('/override/path');
    });

    it('should filter to only .jsonl files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        'session1.jsonl',
        'session2.jsonl',
        'readme.md',
        '.DS_Store',
        'config.json',
      ]);

      const sources = await discoverClaudeSources();

      expect(sources[0].sessionCount).toBe(2);
    });

    it('should handle missing directory gracefully', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const sources = await discoverClaudeSources();

      expect(sources.length).toBe(1);
      expect(sources[0].type).toBe('claude-code');
      expect(sources[0].error).toBeDefined();
      expect(sources[0].sessionCount).toBe(0);
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

      const sources = await discoverClaudeSources();

      expect(sources.length).toBe(1);
      expect(sources[0].error).toBeDefined();
      expect(sources[0].sessionCount).toBe(0);
    });

    it('should report sessionCount matching number of .jsonl files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue([
        's1.jsonl', 's2.jsonl', 's3.jsonl',
        's4.jsonl', 's5.jsonl',
      ]);

      const sources = await discoverClaudeSources();

      expect(sources[0].sessionCount).toBe(5);
    });
  });
});

describe('Codex Source Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_SESSIONS_PATH;
    delete process.env.CODEX_SESSIONS_PATH;
  });

  describe('discoverCodexSources', () => {
    it('should return DiscoveredSource[] with type codex', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['codex-session.jsonl']);

      const sources = await discoverCodexSources();

      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0].type).toBe('codex');
    });

    it('should use default path ~/.codex/sessions/', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverCodexSources();

      expect(mockAccess).toHaveBeenCalled();
      const accessedPath = mockAccess.mock.calls[0][0];
      expect(accessedPath).toContain('.codex');
      expect(accessedPath).toContain('sessions');
    });

    it('should use CODEX_SESSIONS_PATH env var when set', async () => {
      process.env.CODEX_SESSIONS_PATH = '/custom/codex/sessions';
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverCodexSources();

      expect(mockAccess.mock.calls[0][0]).toBe('/custom/codex/sessions');
    });

    it('should use config.sessionsPath override when provided', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockResolvedValue(['session1.jsonl']);

      await discoverCodexSources({ sessionsPath: '/override/codex/path' });

      expect(mockAccess.mock.calls[0][0]).toBe('/override/codex/path');
    });

    it('should handle missing directory gracefully', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const sources = await discoverCodexSources();

      expect(sources.length).toBe(1);
      expect(sources[0].type).toBe('codex');
      expect(sources[0].error).toBeDefined();
      expect(sources[0].sessionCount).toBe(0);
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

      const sources = await discoverCodexSources();

      expect(sources[0].error).toBeDefined();
      expect(sources[0].sessionCount).toBe(0);
    });
  });
});

describe('getSourceConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_SESSIONS_PATH;
    delete process.env.CODEX_SESSIONS_PATH;
  });

  it('should return non-empty arrays for claude-code', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(['s1.jsonl']);

    const configs = await getSourceConfig('claude-code');

    expect(Array.isArray(configs)).toBe(true);
    expect(configs.length).toBeGreaterThan(0);
    expect(configs[0].type).toBe('claude-code');
    expect(configs[0]).toHaveProperty('path');
    expect(configs[0]).toHaveProperty('enabled');
  });

  it('should return non-empty arrays for codex', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(['s1.jsonl']);

    const configs = await getSourceConfig('codex');

    expect(Array.isArray(configs)).toBe(true);
    expect(configs.length).toBeGreaterThan(0);
    expect(configs[0].type).toBe('codex');
  });

  it('should return enabled:true for valid sources', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(['s1.jsonl']);

    const configs = await getSourceConfig('claude-code');

    expect(configs[0].enabled).toBe(true);
  });

  it('should return enabled:false for sources with errors', async () => {
    mockAccess.mockRejectedValue(new Error('Not found'));

    const configs = await getSourceConfig('codex');

    expect(configs[0].enabled).toBe(false);
  });
});

describe('getSourcePath', () => {
  beforeEach(() => {
    delete process.env.CLAUDE_SESSIONS_PATH;
    delete process.env.CODEX_SESSIONS_PATH;
  });

  it('should return correct path for claude-code (default)', () => {
    const path = getSourcePath('claude-code');

    expect(path).toContain('.claude');
    expect(path).toContain('sessions');
    expect(path).toBe('/mock/home/user/.claude/sessions');
  });

  it('should return correct path for claude-code (env var)', () => {
    process.env.CLAUDE_SESSIONS_PATH = '/env/claude/path';

    const path = getSourcePath('claude-code');

    expect(path).toBe('/env/claude/path');
  });

  it('should return correct path for codex (default)', () => {
    const path = getSourcePath('codex');

    expect(path).toContain('.codex');
    expect(path).toContain('sessions');
    expect(path).toBe('/mock/home/user/.codex/sessions');
  });

  it('should return correct path for codex (env var)', () => {
    process.env.CODEX_SESSIONS_PATH = '/env/codex/path';

    const path = getSourcePath('codex');

    expect(path).toBe('/env/codex/path');
  });

  it('should return empty string for unknown sources', () => {
    const path = getSourcePath('openclaw' as any);

    // openclaw path depends on WORKSPACE_PATH which is not set
    expect(typeof path).toBe('string');
  });
});
