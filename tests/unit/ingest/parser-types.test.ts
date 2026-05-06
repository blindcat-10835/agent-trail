import { describe, it, expect } from 'vitest';
import {
  ClaudeJsonlLine,
  CodexJsonlLine,
  ClaudeDAGNode,
  ClaudeCompactBoundary,
  CodexTurnContext,
} from '@/ingest/parser/types';

describe('Claude Code Parser Types', () => {
  describe('ClaudeJsonlLine', () => {
    it('should support valid Claude JSONL line with DAG fields', () => {
      const line: ClaudeJsonlLine = {
        uuid: 'msg-uuid-001',
        parentUuid: 'msg-uuid-parent',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'Hello, I am Claude.',
          model: 'claude-sonnet-4-20250514',
          usage: { input_tokens: 150, output_tokens: 80 },
        },
        session: {
          id: 'session-abc',
          type: 'root',
          cwd: '/Users/dev/project',
          gitBranch: 'main',
        },
        timestamp: '2025-06-01T10:00:00Z',
      };

      expect(line.uuid).toBe('msg-uuid-001');
      expect(line.parentUuid).toBe('msg-uuid-parent');
      expect(line.type).toBe('assistant');
      expect(line.message?.role).toBe('assistant');
      expect(line.session?.id).toBe('session-abc');
      expect(line.session?.type).toBe('root');
    });

    it('should support optional parentUuid (root messages)', () => {
      const line: ClaudeJsonlLine = {
        uuid: 'msg-root',
        type: 'user',
        message: {
          role: 'user',
          content: 'Write a function',
        },
        timestamp: '2025-06-01T10:00:00Z',
      };

      expect(line.parentUuid).toBeUndefined();
      expect(line.session).toBeUndefined();
    });

    it('should support subagent session type', () => {
      const line: ClaudeJsonlLine = {
        uuid: 'msg-sub',
        type: 'assistant',
        session: {
          id: 'sub-session-1',
          type: 'subagent',
          parentId: 'parent-session',
        },
      };

      expect(line.session?.type).toBe('subagent');
      expect(line.session?.parentId).toBe('parent-session');
    });

    it('should support compact/continuation session types', () => {
      const forkLine: ClaudeJsonlLine = {
        uuid: 'fork-msg',
        type: 'system',
        session: { id: 'fork-session', type: 'fork' },
      };
      const continuationLine: ClaudeJsonlLine = {
        uuid: 'cont-msg',
        type: 'system',
        session: { id: 'cont-session', type: 'continuation' },
      };

      expect(forkLine.session?.type).toBe('fork');
      expect(continuationLine.session?.type).toBe('continuation');
    });

    it('should support content blocks in messages', () => {
      const line: ClaudeJsonlLine = {
        uuid: 'msg-content-blocks',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file.' },
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/file' },
              id: 'tool-1',
            },
          ],
        },
      };

      expect(Array.isArray(line.message?.content)).toBe(true);
      if (Array.isArray(line.message!.content)) {
        expect(line.message!.content[0].type).toBe('text');
        expect(line.message!.content[1].type).toBe('tool_use');
      }
    });

    it('should allow extra keys on raw JSONL lines', () => {
      const line: ClaudeJsonlLine = {
        uuid: 'extra-keys',
        type: 'assistant',
        extraField: 'should be allowed',
      };

      expect(line.extraField).toBe('should be allowed');
    });
  });

  describe('ClaudeDAGNode', () => {
    it('should support root relationship type', () => {
      const node: ClaudeDAGNode = {
        uuid: 'dag-1',
        sessionId: 'session-abc',
        relationshipType: 'root',
      };

      expect(node.uuid).toBe('dag-1');
      expect(node.sessionId).toBe('session-abc');
      expect(node.relationshipType).toBe('root');
      expect(node.parentSessionId).toBeUndefined();
      expect(node.parentUuid).toBeUndefined();
    });

    it('should support subagent relationship with parent links', () => {
      const node: ClaudeDAGNode = {
        uuid: 'dag-2',
        parentUuid: 'dag-1',
        sessionId: 'sub-session',
        parentSessionId: 'parent-session',
        relationshipType: 'subagent',
      };

      expect(node.parentUuid).toBe('dag-1');
      expect(node.parentSessionId).toBe('parent-session');
      expect(node.relationshipType).toBe('subagent');
    });

    it('should support fork and continuation relationship types', () => {
      const fork: ClaudeDAGNode = {
        uuid: 'dag-fork',
        sessionId: 'fork-session',
        parentSessionId: 'root-session',
        relationshipType: 'fork',
      };
      const continuation: ClaudeDAGNode = {
        uuid: 'dag-cont',
        sessionId: 'cont-session',
        parentSessionId: 'prior-session',
        relationshipType: 'continuation',
      };

      expect(fork.relationshipType).toBe('fork');
      expect(continuation.relationshipType).toBe('continuation');
    });
  });

  describe('ClaudeCompactBoundary', () => {
    it('should track compact boundaries with truncated UUIDs', () => {
      const boundary: ClaudeCompactBoundary = {
        lineNumber: 42,
        truncatedUuids: ['msg-1', 'msg-2', 'msg-3'],
      };

      expect(boundary.lineNumber).toBe(42);
      expect(boundary.truncatedUuids).toHaveLength(3);
      expect(boundary.truncatedUuids).toContain('msg-2');
    });

    it('should support empty truncated UUIDs list', () => {
      const boundary: ClaudeCompactBoundary = {
        lineNumber: 1,
        truncatedUuids: [],
      };

      expect(boundary.truncatedUuids).toHaveLength(0);
    });
  });
});

describe('Codex Parser Types', () => {
  describe('CodexJsonlLine', () => {
    it('should support session_meta type with model info', () => {
      const line: CodexJsonlLine = {
        type: 'session_meta',
        session_meta: {
          session_id: 'codex-session-001',
          cwd: '/Users/dev/project',
          git_branch: 'feature/parser',
          model: 'gpt-5',
        },
      };

      expect(line.type).toBe('session_meta');
      expect(line.session_meta?.session_id).toBe('codex-session-001');
      expect(line.session_meta?.model).toBe('gpt-5');
    });

    it('should support turn_context type', () => {
      const line: CodexJsonlLine = {
        type: 'turn_context',
        turn_context: {
          turn_id: 'turn-1',
          model: 'gpt-5-mini',
          started_at: '2025-06-01T10:00:00Z',
        },
      };

      expect(line.type).toBe('turn_context');
      expect(line.turn_context?.turn_id).toBe('turn-1');
      expect(line.turn_context?.model).toBe('gpt-5-mini');
      expect(line.turn_context?.started_at).toBe('2025-06-01T10:00:00Z');
    });

    it('should support response_item type with input_text', () => {
      const line: CodexJsonlLine = {
        type: 'response_item',
        response_item: {
          type: 'input_text',
          input_text: 'Hello, Codex!',
          token_count: 3,
        },
      };

      expect(line.response_item?.type).toBe('input_text');
      expect(line.response_item?.input_text).toBe('Hello, Codex!');
      expect(line.response_item?.token_count).toBe(3);
    });

    it('should support response_item type with text (assistant)', () => {
      const line: CodexJsonlLine = {
        type: 'response_item',
        response_item: {
          type: 'text',
          text: 'Hello! How can I help?',
          token_count: 7,
        },
      };

      expect(line.response_item?.type).toBe('text');
      expect(line.response_item?.text).toBe('Hello! How can I help?');
    });

    it('should support response_item type with function_call', () => {
      const line: CodexJsonlLine = {
        type: 'response_item',
        response_item: {
          type: 'function_call',
          call_id: 'call-abc',
          name: 'read_file',
          arguments: '{"path":"/src/index.ts"}',
          token_count: 12,
        },
      };

      expect(line.response_item?.type).toBe('function_call');
      expect(line.response_item?.call_id).toBe('call-abc');
      expect(line.response_item?.name).toBe('read_file');
      expect(line.response_item?.arguments).toBe('{"path":"/src/index.ts"}');
    });

    it('should support event_msg type', () => {
      const line: CodexJsonlLine = {
        type: 'event_msg',
        event_msg: {
          type: 'function_call_output',
          call_id: 'call-abc',
          content: 'File contents here...',
          status: 'completed',
        },
      };

      expect(line.event_msg?.type).toBe('function_call_output');
      expect(line.event_msg?.call_id).toBe('call-abc');
      expect(line.event_msg?.status).toBe('completed');
    });

    it('should support spawn_agent type', () => {
      const line: CodexJsonlLine = {
        type: 'spawn_agent',
        spawn_agent: {
          session_id: 'subagent-001',
          type: 'spawned',
        },
      };

      expect(line.type).toBe('spawn_agent');
      expect(line.spawn_agent?.session_id).toBe('subagent-001');
      expect(line.spawn_agent?.type).toBe('spawned');
    });

    it('should allow extra keys on raw JSONL lines', () => {
      const line: CodexJsonlLine = {
        type: 'custom_event',
        extraField: 'should be allowed',
      };

      expect(line.extraField).toBe('should be allowed');
    });
  });

  describe('CodexTurnContext', () => {
    it('should support turn context with model and start time', () => {
      const ctx: CodexTurnContext = {
        turnId: 'turn-abc-123',
        model: 'gpt-5',
        startedAt: '2025-06-01T10:05:00Z',
      };

      expect(ctx.turnId).toBe('turn-abc-123');
      expect(ctx.model).toBe('gpt-5');
      expect(ctx.startedAt).toBe('2025-06-01T10:05:00Z');
    });

    it('should support optional model and startedAt', () => {
      const ctx: CodexTurnContext = {
        turnId: 'turn-minimal',
      };

      expect(ctx.turnId).toBe('turn-minimal');
      expect(ctx.model).toBeUndefined();
      expect(ctx.startedAt).toBeUndefined();
    });
  });
});
