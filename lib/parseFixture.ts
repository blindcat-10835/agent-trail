import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { TraceSession, TraceSource } from '@/types/trace';

/**
 * Parse a JSONL fixture file and return a minimal TraceSession
 *
 * This is a Phase 1 stub implementation that:
 * - Reads JSONL files line-by-line using readline streaming
 * - Counts malformed lines without crashing
 * - Returns minimal TraceSession with placeholder values
 *
 * Phase 2-3 will implement real parsers that populate fields based on source type.
 *
 * @param filePath - Absolute path to the JSONL fixture file
 * @param sourceType - The source type ('openclaw' | 'claude-code' | 'codex')
 * @returns Promise<TraceSession> - Minimal session stub with message count
 */
export async function parseFixture(
  filePath: string,
  sourceType: TraceSource
): Promise<TraceSession> {
  const lines: string[] = [];
  let malformedLines = 0;

  try {
    // Read JSONL line by line (streaming for large files)
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        lines.push(line);
        // Validate JSON but continue on error
        try {
          JSON.parse(line);
        } catch (err) {
          malformedLines++;
          // Log parse error but don't throw - continue parsing
          console.warn(`[parseFixture] Malformed JSON at line ${lines.length}: ${err}`);
        }
      }
    }
  } catch (err) {
    // File read errors should throw
    throw new Error(`Failed to read fixture file ${filePath}: ${err}`);
  }

  // Phase 1 stub: return minimal TraceSession
  return {
    id: 'stub-session-id',
    source: sourceType,
    project: 'test-project',
    startedAt: null,
    endedAt: null,
    status: 'unknown',
    metrics: {
      messageCount: lines.length,
      userMessageCount: 0,
      hasToolCalls: false,
      terminationStatus: 'unknown',
      parserMalformedLines: malformedLines,
      isTruncated: false
    },
    turns: []
  };
}
