import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Create a temporary fixture file with the given content.
 * Returns the full path to the file.
 *
 * @param content - File content to write
 * @param ext - File extension (default: '.jsonl')
 * @returns Full path to the temporary file
 */
export function createTempFixture(content: string, ext = '.jsonl'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
  const filePath = path.join(dir, `fixture${ext}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Clean up a temporary fixture file and its parent directory.
 *
 * @param filePath - Full path to the temporary file
 */
export function cleanupTempFixture(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.rmSync(dir, { recursive: true, force: true });
}
