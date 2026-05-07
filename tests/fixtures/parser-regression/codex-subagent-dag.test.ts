import { describe, it, expect, afterEach } from 'vitest';
import { parseCodexSession } from '@/ingest/parser/codex';
import { createTempFixture, cleanupTempFixture } from '@/tests/helpers/temp-fixture';
import { TraceSubagentLink } from '@/types/trace';

describe('Codex parser — subagent DAG', () => {
  let tempPath: string | null = null;

  afterEach(() => {
    if (tempPath) {
      cleanupTempFixture(tempPath);
      tempPath = null;
    }
  });

  it('creates SubagentLink entries with correct parent/child session IDs', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"parent-session-001"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"response_item","response_item":{"type":"text","text":"Spawning subagent now..."}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"child-session-001","type":"spawned"}}',
      '{"type":"response_item","response_item":{"type":"text","text":"Subagent completed work"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // Should have at least one subagent_link activity
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];
    expect(subagentLinks.length).toBeGreaterThanOrEqual(1);
    // Parent is the current session
    expect(subagentLinks[0].subagentSessionId).toBe('child-session-001');
    expect(subagentLinks[0].subagentSource).toBe('codex');
    expect(subagentLinks[0].relationship).toBe('spawned');
  });

  it('handles multiple nested subagents (subagent within subagent)', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"root-session"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"child-level-1","type":"spawned"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"child-level-2","type":"spawned"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"child-level-3","type":"attached"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // All three subagent links should be created
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];
    expect(subagentLinks.length).toBe(3);
    // Each has unique session ID
    const ids = subagentLinks.map(s => s.subagentSessionId);
    expect(ids).toContain('child-level-1');
    expect(ids).toContain('child-level-2');
    expect(ids).toContain('child-level-3');
    // Check relationship types
    const relationships = subagentLinks.map(s => s.relationship);
    expect(relationships).toContain('spawned');
    expect(relationships).toContain('attached');
  });

  it('handles spawn_agent with session IDs matching UUID pattern', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"b2c3d4e5-f6a7-8901-bcde-f12345678901","type":"spawned"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];
    expect(subagentLinks.length).toBe(1);
    expect(subagentLinks[0].subagentSessionId).toBe(
      'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    );
  });

  it('does not create subagent links when spawn_agent is absent', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"no-sub-session"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"response_item","response_item":{"type":"input_text","input_text":"No subagents here"}}',
      '{"type":"response_item","response_item":{"type":"text","text":"Just a normal session"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // No subagent links should exist
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    );
    expect(subagentLinks.length).toBe(0);
  });

  it('handles spawn_agent mixed with function_call activities', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"mixed-session"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"response_item","response_item":{"type":"function_call","call_id":"call_01","name":"task","arguments":"{\\"subagent_name\\":\\"helper\\"}"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"sub-from-task","type":"spawned"}}',
      '{"type":"event_msg","event_msg":{"type":"function_call_output","call_id":"call_01","content":"Subagent spawned","status":"completed"}}',
      '{"type":"response_item","response_item":{"type":"text","text":"Task delegated to subagent"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // Both tool_call and subagent_link should be present
    const toolCalls = result.activities.filter(a => a.type === 'tool_call');
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];

    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(subagentLinks.length).toBe(1);
    expect(subagentLinks[0].subagentSessionId).toBe('sub-from-task');
  });

  it('parses spawn_agent without session_meta header', async () => {
    const content = [
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"orphan-subagent","type":"spawned"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // Should parse successfully even without session_meta
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];
    expect(subagentLinks.length).toBe(1);
    expect(subagentLinks[0].subagentSessionId).toBe('orphan-subagent');
  });

  it('handles spawn_agent interspersed with malformed lines', async () => {
    const content = [
      '{"type":"session_meta","session_meta":{"session_id":"s1"}}',
      '{"type":"turn_context","turn_context":{"turn_id":"t1","model":"gpt-4"}}',
      'garbage line here {{{',
      '{"type":"spawn_agent","spawn_agent":{"session_id":"s2","type":"spawned"}}',
      'more garbage ###',
      '{"type":"response_item","response_item":{"type":"text","text":"valid after garbage"}}',
    ].join('\n');
    tempPath = createTempFixture(content);

    const result = await parseCodexSession(tempPath, 'test-project');

    // Malformed lines produce errors
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    // Subagent link still parsed
    const subagentLinks = result.activities.filter(
      a => a.type === 'subagent_link'
    ) as TraceSubagentLink[];
    expect(subagentLinks.length).toBe(1);
    expect(subagentLinks[0].subagentSessionId).toBe('s2');
    // Valid messages still parsed
    expect(result.messages.length).toBe(1);
  });
});
