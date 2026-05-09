import { describe, it, expect } from 'vitest';
import {
  TraceSource,
  IngestStatus,
  GatewayStatus,
  TraceSourceMetadata,
  TraceSession,
  TraceTurn,
  TraceMessage,
  TraceActivity,
  TraceToolCall,
  TraceSkillUse,
  TraceSubagentLink,
  TraceThinkingBlock,
  TraceSystemEvent,
  TokenUsage,
  SourceMetadata,
} from '@/types/trace';

describe('Source Status Types', () => {
  it('should include all expected IngestStatus values', () => {
    const validIngestStatuses: IngestStatus[] = [
      'installed',
      'configured',
      'empty',
      'indexing',
      'error',
      'parser-warning',
    ];

    validIngestStatuses.forEach((status) => {
      expect(status).toBeTruthy();
    });
  });

  it('should include all expected GatewayStatus values', () => {
    const validGatewayStatuses: GatewayStatus[] = [
      'connected',
      'disconnected',
      'connecting',
      'error',
    ];

    validGatewayStatuses.forEach((status) => {
      expect(status).toBeTruthy();
    });
  });

  it('should include all expected TraceSource values', () => {
    const validSources: TraceSource[] = [
      'openclaw',
      'claude-code',
      'codex',
    ];

    validSources.forEach((source) => {
      expect(source).toBeTruthy();
    });
  });
});

describe('Type Compilation', () => {
  it('should create valid TraceSourceMetadata', () => {
    const sourceMetadata: TraceSourceMetadata = {
      type: 'openclaw',
      path: '/path/to/openclaw',
      ingestStatus: 'configured',
      lastSyncAt: '2024-01-01T00:00:00Z',
      sessionCount: 10,
    };

    expect(sourceMetadata.type).toBe('openclaw');
    expect(sourceMetadata.ingestStatus).toBe('configured');
  });

  it('should create valid TraceSession', () => {
    const session: TraceSession = {
      id: 'session-123',
      source: 'claude-code',
      project: 'test-project',
      startedAt: '2024-01-01T00:00:00Z',
      endedAt: '2024-01-01T01:00:00Z',
      status: 'idle',
      metrics: {
        messageCount: 10,
        userMessageCount: 5,
        totalTokens: 1000,
        hasToolCalls: true,
        terminationStatus: 'completed',
        parserMalformedLines: 0,
        isTruncated: false,
      },
      turns: [],
    };

    expect(session.id).toBe('session-123');
    expect(session.source).toBe('claude-code');
    expect(session.status).toBe('idle');
  });

  it('should create valid TraceTurn', () => {
    const turn: TraceTurn = {
      id: 'turn-1',
      sessionId: 'session-123',
      index: 0,
      userMessage: null,
      assistantMessages: [],
      activities: [],
      startedAt: '2024-01-01T00:00:00Z',
      endedAt: '2024-01-01T00:00:10Z',
      durationMs: 10000,
    };

    expect(turn.sessionId).toBe('session-123');
    expect(turn.index).toBe(0);
  });

  it('should create valid TraceMessage', () => {
    const message: TraceMessage = {
      id: 'msg-1',
      ordinal: 0,
      role: 'user',
      content: 'Hello, world!',
      timestamp: '2024-01-01T00:00:00Z',
      sourceMetadata: {
        sourceType: 'openclaw',
        sourceFile: 'session.jsonl',
        sourceLine: 1,
      },
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, world!');
  });

  it('should create valid TraceToolCall', () => {
    const toolCall: TraceToolCall = {
      type: 'tool_call',
      id: 'tool-1',
      name: 'Read',
      category: 'Read',
      inputJson: '{"file_path": "/path/to/file"}',
      resultEvents: [],
      status: 'success',
      durationMs: 1000,
    };

    expect(toolCall.type).toBe('tool_call');
    expect(toolCall.name).toBe('Read');
  });

  it('should create valid TraceSkillUse', () => {
    const skillUse: TraceSkillUse = {
      type: 'skill_use',
      name: 'test-skill',
      inputSummary: 'Test input',
      result: 'Test result',
      status: 'success',
    };

    expect(skillUse.type).toBe('skill_use');
    expect(skillUse.status).toBe('success');
  });

  it('should create valid TraceSubagentLink', () => {
    const subagentLink: TraceSubagentLink = {
      type: 'subagent_link',
      subagentSessionId: 'subagent-123',
      subagentSource: 'codex',
      relationship: 'spawned',
    };

    expect(subagentLink.type).toBe('subagent_link');
    expect(subagentLink.relationship).toBe('spawned');
  });

  it('should create valid TraceThinkingBlock', () => {
    const thinkingBlock: TraceThinkingBlock = {
      type: 'thinking',
      content: 'Thinking process...',
      isRedacted: false,
    };

    expect(thinkingBlock.type).toBe('thinking');
    expect(thinkingBlock.isRedacted).toBe(false);
  });

  it('should create valid TraceSystemEvent', () => {
    const systemEvent: TraceSystemEvent = {
      type: 'system',
      subtype: 'error',
      content: 'An error occurred',
    };

    expect(systemEvent.type).toBe('system');
    expect(systemEvent.subtype).toBe('error');
  });

  it('should create valid TokenUsage', () => {
    const tokenUsage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
    };

    expect(tokenUsage.inputTokens).toBe(100);
    expect(tokenUsage.outputTokens).toBe(50);
  });

  it('should create valid SourceMetadata', () => {
    const sourceMetadata: SourceMetadata = {
      sourceType: 'claude-code',
      sourceFile: 'session.jsonl',
      sourceLine: 1,
      sourceVersion: '1.0',
      cwd: '/path/to/project',
      gitBranch: 'main',
    };

    expect(sourceMetadata.sourceType).toBe('claude-code');
    expect(sourceMetadata.gitBranch).toBe('main');
  });

  it('should support discriminated union for TraceActivity', () => {
    const activities: TraceActivity[] = [
      {
        type: 'tool_call',
        id: 'tool-1',
        name: 'Read',
        category: 'Read',
        inputJson: '{}',
        resultEvents: [],
        status: 'success',
      },
      {
        type: 'skill_use',
        name: 'test',
        inputSummary: 'test',
        status: 'success',
      },
      {
        type: 'subagent_link',
        subagentSessionId: 'sub-1',
        subagentSource: 'codex',
        relationship: 'spawned',
      },
      {
        type: 'thinking',
        content: 'thinking',
        isRedacted: false,
      },
      {
        type: 'system',
        subtype: 'info',
        content: 'info',
      },
    ];

    expect(activities).toHaveLength(5);

    // Verify discriminated union works
    activities.forEach((activity) => {
      switch (activity.type) {
        case 'tool_call':
          expect(activity.name).toBeTruthy();
          break;
        case 'skill_use':
          expect(activity.inputSummary).toBeTruthy();
          break;
        case 'subagent_link':
          expect(activity.subagentSessionId).toBeTruthy();
          break;
        case 'thinking':
          expect(activity.content).toBeTruthy();
          break;
        case 'system':
          expect(activity.subtype).toBeTruthy();
          break;
      }
    });
  });
});

describe('Source Metadata', () => {
  it('should create valid TraceSourceMetadata with ingestStatus', () => {
    const source: TraceSourceMetadata = {
      type: 'openclaw',
      path: '/path/to/openclaw',
      ingestStatus: 'configured',
      sessionCount: 5,
    };

    expect(source.ingestStatus).toBe('configured');
  });

  it('should allow TraceSourceMetadata with optional lastSyncAt', () => {
    const source: TraceSourceMetadata = {
      type: 'claude-code',
      path: '/path/to/claude-code',
      ingestStatus: 'configured',
      sessionCount: 3,
    };

    expect(source.ingestStatus).toBe('configured');
    expect(source.lastSyncAt).toBeUndefined();
  });
});

describe('Optional Fields', () => {
  it('should allow omitting optional fields', () => {
    const session: TraceSession = {
      id: 'session-123',
      source: 'codex',
      project: 'test-project',
      startedAt: null,
      endedAt: null,
      status: 'unknown',
      metrics: {
        messageCount: 0,
        userMessageCount: 0,
        hasToolCalls: false,
        terminationStatus: undefined,
        parserMalformedLines: 0,
        isTruncated: false,
      },
      turns: [],
    };

    expect(session.rootSessionId).toBeUndefined();
    expect(session.parentSessionId).toBeUndefined();
    expect(session.relationshipType).toBeUndefined();
    expect(session.metrics.totalTokens).toBeUndefined();
  });

  it('should allow optional fields to be null or undefined', () => {
    const session1: TraceSession = {
      id: 'session-123',
      source: 'openclaw',
      project: 'test-project',
      startedAt: null,
      endedAt: null,
      status: 'unknown',
      metrics: {
        messageCount: 0,
        userMessageCount: 0,
        hasToolCalls: false,
        parserMalformedLines: 0,
        isTruncated: false,
      },
      turns: [],
    };

    expect(session1.startedAt).toBeNull();
    expect(session1.endedAt).toBeNull();

    const turn: TraceTurn = {
      id: 'turn-1',
      sessionId: 'session-123',
      index: 0,
      userMessage: null,
      assistantMessages: [],
      activities: [],
      startedAt: null,
      endedAt: null,
      durationMs: null,
    };

    expect(turn.startedAt).toBeNull();
    expect(turn.durationMs).toBeNull();
  });
});
