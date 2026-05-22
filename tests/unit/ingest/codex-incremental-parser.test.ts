import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { parseCodexSessionAppend } from '@/ingest/parser/codex';
import type { IncrementalParseOptions } from '@/ingest/parser/types';

describe('Codex incremental parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codex-incremental-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses only appended Codex response_item lines', async () => {
    const historical = '{bad historical json}\n';
    const appended = [
      JSON.stringify({
        type: 'response_item',
        response_item: { type: 'text', text: 'Appended answer', token_count: 4 },
        timestamp: '2026-05-15T00:00:00.000Z',
      }),
      '',
    ].join('\n');
    const filePath = writeJsonl('append.jsonl', historical + appended);

    const delta = await parseCodexSessionAppend(filePath, 'project', {
      ...baseOptions(),
      startOffset: Buffer.byteLength(historical),
      endOffset: statSync(filePath).size,
      startLine: 1,
    });

    expect(delta.requiresFullReparse).toBeFalsy();
    expect(delta.errors).toEqual([]);
    expect(delta.messages).toHaveLength(1);
    expect(delta.messages[0].content).toBe('Appended answer');
    expect(delta.cursorUpdate.lastIndexedLine).toBe(2);
  });

  it('uses appended turn_context for subsequent Codex turn metadata', async () => {
    const jsonl = [
      JSON.stringify({
        type: 'turn_context',
        turn_context: { turn_id: 'turn-new', model: 'gpt-5.5' },
        timestamp: '2026-05-15T00:00:00.000Z',
      }),
      JSON.stringify({
        type: 'response_item',
        response_item: { type: 'text', text: 'In new turn', token_count: 3 },
        timestamp: '2026-05-15T00:00:01.000Z',
      }),
      '',
    ].join('\n');
    const filePath = writeJsonl('turn-context.jsonl', jsonl);

    const delta = await parseCodexSessionAppend(filePath, 'project', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
    });

    expect(delta.messages[0].turnId).toBe('turn-new');
    expect(delta.messages[0].turnIndex).toBe(0);
    expect(delta.messages[0].model).toBe('gpt-5.5');
  });

  it('does not use a fallback date directory as the Codex project during append', async () => {
    const jsonl = `${JSON.stringify({
      type: 'response_item',
      response_item: { type: 'text', text: 'No cwd in this append', token_count: 3 },
      timestamp: '2026-05-15T00:00:00.000Z',
    })}\n`;
    const filePath = writeJsonl('date-dir-append.jsonl', jsonl);

    const delta = await parseCodexSessionAppend(filePath, '22', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
    });

    expect(delta.sessionPatch.project).toBeUndefined();
  });

  it('promotes appended Codex turn_context cwd to the session project', async () => {
    const cwd = '/Users/example/Work/ai-dashboard-projects/agents-tracing-dashboard';
    const jsonl = `${JSON.stringify({
      type: 'turn_context',
      turn_context: { turn_id: 'turn-new', cwd, model: 'gpt-5.5' },
      timestamp: '2026-05-15T00:00:00.000Z',
    })}\n`;
    const filePath = writeJsonl('cwd-turn-context.jsonl', jsonl);

    const delta = await parseCodexSessionAppend(filePath, '22', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
    });

    expect(delta.sessionPatch.cwd).toBe(cwd);
    expect(delta.sessionPatch.project).toBe(cwd);
  });

  it('represents function_call_output for a known previous Codex call', async () => {
    const jsonl = `${JSON.stringify({
      type: 'response_item',
      response_item: {
        type: 'function_call_output',
        call_id: 'call-known',
        output: 'command output',
        status: 'completed',
      },
      timestamp: '2026-05-15T00:00:00.000Z',
    })}\n`;
    const filePath = writeJsonl('known-output.jsonl', jsonl);

    const delta = await parseCodexSessionAppend(filePath, 'project', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
      startTurnIndex: 0,
      currentTurnId: 'turn-0',
      knownToolCallIds: ['call-known'],
    });

    expect(delta.requiresFullReparse).toBeFalsy();
    expect(delta.toolResultEvents).toHaveLength(1);
    expect(delta.toolResultEvents[0].toolId).toBe('call-known');
    expect(delta.toolResultEvents[0].event.content).toBe('command output');
  });

  it('holds a trailing partial Codex JSONL line for the next sync', async () => {
    const complete = `${JSON.stringify({
      type: 'response_item',
      response_item: { type: 'text', text: 'Complete', token_count: 1 },
    })}\n`;
    const partial = '{"type":"response_item","response_item":';
    const filePath = writeJsonl('partial.jsonl', complete + partial);

    const delta = await parseCodexSessionAppend(filePath, 'project', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
    });

    expect(delta.messages).toHaveLength(1);
    expect(delta.messages[0].content).toBe('Complete');
    expect(delta.cursorUpdate.lastIndexedOffset).toBe(Buffer.byteLength(complete));
  });

  it('accumulates appended token_count deltas once per unique snapshot', async () => {
    const jsonl = [
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 1200,
              cached_input_tokens: 0,
              output_tokens: 34,
              reasoning_output_tokens: 21,
              total_tokens: 1234,
            },
            last_token_usage: {
              input_tokens: 1200,
              cached_input_tokens: 0,
              output_tokens: 34,
              reasoning_output_tokens: 21,
              total_tokens: 1234,
            },
          },
        },
        timestamp: '2026-05-15T00:00:01.000Z',
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 1200,
              cached_input_tokens: 0,
              output_tokens: 34,
              reasoning_output_tokens: 21,
              total_tokens: 1234,
            },
            last_token_usage: {
              input_tokens: 1200,
              cached_input_tokens: 0,
              output_tokens: 34,
              reasoning_output_tokens: 21,
              total_tokens: 1234,
            },
          },
        },
        timestamp: '2026-05-15T00:00:02.000Z',
      }),
      '',
    ].join('\n');
    const filePath = writeJsonl('token-count.jsonl', jsonl);

    const delta = await parseCodexSessionAppend(filePath, 'project', {
      ...baseOptions(),
      endOffset: statSync(filePath).size,
    });

    expect(delta.metricsDelta.totalInputTokens).toBe(1200);
    expect(delta.metricsDelta.totalOutputTokens).toBe(34);
    expect(delta.metricsDelta.totalReasoningTokens).toBe(21);
    expect(delta.metricsDelta.totalTokens).toBe(1234);
  });

  function writeJsonl(name: string, content: string): string {
    const filePath = join(tempDir, name);
    writeFileSync(filePath, content);
    return filePath;
  }

  function baseOptions(): IncrementalParseOptions {
    return {
      startOffset: 0,
      endOffset: 0,
      startLine: 0,
      startOrdinal: 0,
      startTurnIndex: -1,
      parserVersion: 'test-parser',
    };
  }
});
