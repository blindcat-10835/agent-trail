/**
 * SSE Connection Manager
 *
 * Manages Server-Sent Events (SSE) connections for real-time invalidation
 * notifications. Supports global event streams and per-session event streams.
 * SSE events notify the frontend to re-fetch data; individual turn/message
 * data is NOT pushed inline (v1 uses batch sync + SSE invalidation).
 *
 * @module ingest/src/sse
 */

// ============================================================================
// Types
// ============================================================================

export type SSEEventType =
  | 'session_created'
  | 'session_updated'
  | 'session_removed'
  | 'sync_complete'
  | 'turn_added';

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}

export interface SSESubscriber {
  id: string;
  sessionId: string | null; // null = global subscriber
  controller: ReadableStreamDefaultController;
}

export interface SSEManager {
  subscribe(sessionId?: string): {
    stream: ReadableStream<Uint8Array>;
    close: () => void;
  };
  emit(event: SSEEventType, data: Record<string, unknown>): void;
  emitSessionEvent(
    sessionId: string,
    event: SSEEventType,
    data: Record<string, unknown>,
  ): void;
  getStats(): { globalSubscribers: number; perSession: Record<string, number> };
  shutdown(): void;
}

// ============================================================================
// Implementation
// ============================================================================

export function createSSEManager(): SSEManager {
  const subscribers = new Map<string, SSESubscriber>();
  let nextId = 0;

  function subscribe(sessionId?: string) {
    const id = String(nextId++);
    let controller!: ReadableStreamDefaultController;

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
      cancel() {
        subscribers.delete(id);
      },
    });

    subscribers.set(id, { id, sessionId: sessionId ?? null, controller });

    // Send initial connection event
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'));

    return {
      stream,
      close: () => {
        subscribers.delete(id);
        try {
          controller.close();
        } catch {
          // Already closed — no-op
        }
      },
    };
  }

  function emit(event: SSEEventType, data: Record<string, unknown>) {
    const encoder = new TextEncoder();
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(payload);

    for (const sub of subscribers.values()) {
      if (sub.sessionId === null) {
        try {
          sub.controller.enqueue(encoded);
        } catch {
          subscribers.delete(sub.id);
        }
      }
    }
  }

  function emitSessionEvent(
    sessionId: string,
    event: SSEEventType,
    data: Record<string, unknown>,
  ) {
    const encoder = new TextEncoder();
    const payload = `event: ${event}\ndata: ${JSON.stringify({ sessionId, ...data })}\n\n`;
    const encoded = encoder.encode(payload);

    for (const sub of subscribers.values()) {
      if (sub.sessionId === sessionId) {
        try {
          sub.controller.enqueue(encoded);
        } catch {
          subscribers.delete(sub.id);
        }
      }
    }
  }

  function getStats() {
    let globalSubscribers = 0;
    const perSession: Record<string, number> = {};

    for (const sub of subscribers.values()) {
      if (sub.sessionId === null) {
        globalSubscribers++;
      } else {
        perSession[sub.sessionId] = (perSession[sub.sessionId] || 0) + 1;
      }
    }

    return { globalSubscribers, perSession };
  }

  function shutdown() {
    for (const sub of subscribers.values()) {
      try {
        sub.controller.close();
      } catch {
        // Already closed — no-op
      }
    }
    subscribers.clear();
  }

  return { subscribe, emit, emitSessionEvent, getStats, shutdown };
}

// ============================================================================
// Module-level Singleton
// ============================================================================

export const sseManager = createSSEManager();
