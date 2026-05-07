/**
 * Source Discovery Tests — Path Validation & Root Enforcement
 *
 * Covers: isWithinRoot path boundary enforcement for discovered sources.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import { isWithinRoot } from './sources.js';

describe('isWithinRoot — path boundary enforcement', () => {
  const homeDir = os.homedir();
  const openclawRoot = path.join(homeDir, '.openclaw', 'agents');
  const claudeRoot = path.join(homeDir, '.claude', 'projects');

  it('should accept a path directly within the allowed root', () => {
    const testPath = path.join(openclawRoot, 'my-agent', 'sessions');
    expect(isWithinRoot(testPath, openclawRoot)).toBe(true);
  });

  it('should accept the root directory itself', () => {
    expect(isWithinRoot(openclawRoot, openclawRoot)).toBe(true);
  });

  it('should reject a path outside the allowed root (sibling directory)', () => {
    const outsidePath = path.join(homeDir, '.ssh');
    expect(isWithinRoot(outsidePath, openclawRoot)).toBe(false);
  });

  it('should reject path traversal attempt via ..', () => {
    const traversalPath = path.join(openclawRoot, '..', '..', 'etc');
    expect(isWithinRoot(traversalPath, openclawRoot)).toBe(false);
  });

  it('should reject a completely unrelated path', () => {
    expect(isWithinRoot('/etc/passwd', openclawRoot)).toBe(false);
  });

  it('should accept a deeply nested path within the root', () => {
    const deepPath = path.join(claudeRoot, 'project-a', '.claude', 'sessions', 'subdir');
    expect(isWithinRoot(deepPath, claudeRoot)).toBe(true);
  });

  it('should reject a path that is a prefix match but not a directory boundary (e.g., /root-fake)', () => {
    // This path is NOT inside openclawRoot because it's at the same level with a suffix
    const prefixMatch = openclawRoot + '-fake';
    expect(isWithinRoot(prefixMatch, openclawRoot)).toBe(false);
  });
});
