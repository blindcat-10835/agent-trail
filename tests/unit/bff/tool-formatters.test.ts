import { describe, expect, it } from 'vitest'
import { formatToolDisplay } from '@/components/replay/tool-formatters'
import type { TraceToolCall } from '@/types/trace'

function makeTool(overrides: Partial<TraceToolCall> & { name: string; inputJson: string }): TraceToolCall {
  return {
    type: 'tool_call',
    id: 'test-id',
    category: 'Edit',
    resultEvents: [],
    status: 'success',
    ...overrides,
  }
}

describe('formatToolDisplay', () => {
  it('formats Claude Edit with file_path and unified diff preview', () => {
    const tool = makeTool({
      name: 'Edit',
      inputJson: JSON.stringify({
        file_path: '/src/app.tsx',
        old_string: 'const x = 1',
        new_string: 'const x = 2',
      }),
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('claude-edit')
    if (display.kind !== 'claude-edit') return
    expect(display.filePath).toBe('/src/app.tsx')
    expect(display.content).toContain('const x = 1')
    expect(display.content).toContain('const x = 2')
    expect(display.content).toContain('-')
    expect(display.content).toContain('+')
  })

  it('formats Claude MultiEdit with file_path and per-edit diff sections', () => {
    const tool = makeTool({
      name: 'MultiEdit',
      inputJson: JSON.stringify({
        file_path: '/src/utils.ts',
        edits: [
          { old_string: 'foo()', new_string: 'bar()' },
          { old_string: 'baz()', new_string: 'qux()' },
        ],
      }),
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('claude-multiedit')
    if (display.kind !== 'claude-multiedit') return
    expect(display.filePath).toBe('/src/utils.ts')
    expect(display.content).toContain('Edit 1')
    expect(display.content).toContain('Edit 2')
    expect(display.content).toContain('foo()')
    expect(display.content).toContain('qux()')
  })

  it('formats Claude Write with file_path and content preview', () => {
    const tool = makeTool({
      name: 'Write',
      inputJson: JSON.stringify({
        file_path: '/src/new-file.ts',
        content: 'export function hello() { return 42 }',
      }),
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('claude-write')
    if (display.kind !== 'claude-write') return
    expect(display.filePath).toBe('/src/new-file.ts')
    expect(display.content).toContain('export function hello()')
  })

  it('formats Codex apply_patch with raw patch text directly', () => {
    const patchText = '*** Begin Patch\n*** Rename File\nold.ts\nnew.ts\n--- old.ts\n+++ new.ts\n@@ -1 +1 @@\n-a\n+b'
    const tool = makeTool({
      name: 'apply_patch',
      category: 'Other',
      inputJson: JSON.stringify({ patch: patchText }),
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('patch')
    expect(display.content).toContain('*** Begin Patch')
  })

  it('formats Codex apply_patch with raw string input starting with patch marker', () => {
    const patchText = '*** Begin Patch\n--- a.txt\n+++ b.txt\n@@ -1 +1 @@\n-old\n+new'
    const tool = makeTool({
      name: 'apply_patch',
      category: 'Other',
      inputJson: patchText,
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('patch')
    expect(display.content).toContain('*** Begin Patch')
  })

  it('falls back to pretty JSON for unknown tools', () => {
    const tool = makeTool({
      name: 'Bash',
      category: 'Bash',
      inputJson: '{"command": "ls -la"}',
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('raw')
    expect(display.content).toContain('"command"')
    expect(display.content).toContain('ls -la')
  })

  it('falls back to raw input for invalid JSON without throwing', () => {
    const tool = makeTool({
      name: 'UnknownTool',
      category: 'Other',
      inputJson: 'not valid json {{{',
    })

    const display = formatToolDisplay(tool)
    expect(display.kind).toBe('raw')
    expect(display.content).toBe('not valid json {{{')
  })

  it('includes tool name, category, formatted content, and results in copyText', () => {
    const tool = makeTool({
      name: 'Edit',
      inputJson: JSON.stringify({
        file_path: '/src/app.tsx',
        old_string: 'a',
        new_string: 'b',
      }),
      resultEvents: [
        { type: 'result_event' as const, content: 'Applied edit', isPartial: false },
      ],
    })

    const display = formatToolDisplay(tool)
    expect(display.copyText).toContain('Edit')
    expect(display.copyText).toContain('/src/app.tsx')
    expect(display.copyText).toContain('Applied edit')
  })
})
