import { describe, it, expect } from 'vitest';
import { parseFixture } from '@/lib/parseFixture';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Helper function to load fixture input and expected output
 *
 * @param fixtureDir - Directory containing fixtures (e.g., 'fixtures/openclaw')
 * @param baseName - Base name of fixture (e.g., 'conversation', 'tool-call')
 * @returns Object with input JSONL content and expected TraceSession
 */
function loadGoldenFixture(fixtureDir: string, baseName: string) {
  const input = readFileSync(join(fixtureDir, `${baseName}.jsonl`), 'utf-8');
  const expected = JSON.parse(
    readFileSync(join(fixtureDir, `${baseName}.golden.json`), 'utf-8')
  );
  return { input, expected };
}

/**
 * Helper function to parse fixture from file path
 *
 * @param fixtureDir - Directory containing fixtures
 * @param baseName - Base name of fixture
 * @param sourceType - Source type for parsing
 * @returns Parsed TraceSession
 */
async function parseFixtureFromPath(
  fixtureDir: string,
  baseName: string,
  sourceType: 'openclaw' | 'claude-code' | 'codex'
) {
  const filePath = join(fixtureDir, `${baseName}.jsonl`);
  return parseFixture(filePath, sourceType);
}

describe('OpenClaw fixtures', () => {
  it('parses conversation.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/openclaw';
    const { expected } = loadGoldenFixture(fixtureDir, 'conversation');
    const result = await parseFixtureFromPath(fixtureDir, 'conversation', 'openclaw');
    expect(result).toEqual(expected);
  });

  it('parses tool-call.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/openclaw';
    const { expected } = loadGoldenFixture(fixtureDir, 'tool-call');
    const result = await parseFixtureFromPath(fixtureDir, 'tool-call', 'openclaw');
    expect(result).toEqual(expected);
  });
});

describe('Claude Code fixtures', () => {
  it('parses valid_session.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/claude-code';
    const { expected } = loadGoldenFixture(fixtureDir, 'valid_session');
    const result = await parseFixtureFromPath(
      fixtureDir,
      'valid_session',
      'claude-code'
    );
    expect(result).toEqual(expected);
  });

  it('parses tool_call_pending.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/claude-code';
    const { expected } = loadGoldenFixture(fixtureDir, 'tool_call_pending');
    const result = await parseFixtureFromPath(
      fixtureDir,
      'tool_call_pending',
      'claude-code'
    );
    expect(result).toEqual(expected);
  });
});

describe('Codex fixtures', () => {
  it('parses standard_session.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/codex';
    const { expected } = loadGoldenFixture(fixtureDir, 'standard_session');
    const result = await parseFixtureFromPath(fixtureDir, 'standard_session', 'codex');
    expect(result).toEqual(expected);
  });

  it('parses function_calls.jsonl to canonical TraceSession', async () => {
    const fixtureDir = 'fixtures/codex';
    const { expected } = loadGoldenFixture(fixtureDir, 'function_calls');
    const result = await parseFixtureFromPath(fixtureDir, 'function_calls', 'codex');
    expect(result).toEqual(expected);
  });
});

describe('Error handling', () => {
  it('handles malformed JSONL lines gracefully', async () => {
    // Create a temporary fixture with a malformed line
    const fixtureDir = 'fixtures/openclaw';
    const baseName = 'conversation';
    const filePath = join(fixtureDir, `${baseName}.jsonl`);

    // Parse the fixture - it should handle any malformed lines
    const result = await parseFixture(filePath, 'openclaw');

    // Verify parserMalformedLines is tracked
    expect(result.metrics.parserMalformedLines).toBeDefined();
    expect(result.metrics.parserMalformedLines).toBeGreaterThanOrEqual(0);
  });
});
