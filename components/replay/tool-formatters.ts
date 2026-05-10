import type { TraceToolCall } from '@/types/trace'

export type ToolDisplay =
  | { kind: 'claude-edit'; filePath: string; content: string; copyText: string }
  | { kind: 'claude-multiedit'; filePath: string; content: string; copyText: string }
  | { kind: 'claude-write'; filePath: string; content: string; copyText: string }
  | { kind: 'patch'; content: string; copyText: string }
  | { kind: 'raw'; content: string; copyText: string }

function buildCopyText(tool: TraceToolCall, body: string): string {
  let text = `Tool: ${tool.name} (${tool.category})\n---\n${body}`
  if (tool.resultEvents.length > 0) {
    text += `\n---\nResult:\n${tool.resultEvents.map((r) => r.content).join('\n')}`
  }
  return text
}

function formatDiffHunk(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')
  let diff = '@@ -1 +' + (newLines.length) + ' @@\n'
  for (const line of oldLines) {
    diff += `-${line}\n`
  }
  for (const line of newLines) {
    diff += `+${line}\n`
  }
  return diff.trimEnd()
}

function extractPatchText(parsed: unknown, rawInput: string): string | null {
  if (typeof parsed === 'string') {
    if (parsed.trimStart().startsWith('*** Begin Patch') || parsed.includes('*** Begin Patch')) {
      return parsed
    }
    try {
      const inner = JSON.parse(parsed)
      if (typeof inner === 'string') return extractPatchText(inner, rawInput)
      if (inner && typeof inner === 'object' && 'patch' in inner && typeof inner.patch === 'string') {
        return inner.patch
      }
    } catch {
      // not JSON, check if raw input looks like a patch
    }
    return null
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if ('patch' in obj && typeof obj.patch === 'string') return obj.patch
  }

  if (rawInput.trimStart().startsWith('*** Begin Patch')) return rawInput

  return null
}

export function formatToolDisplay(tool: TraceToolCall): ToolDisplay {
  const nameLower = tool.name.toLowerCase()

  if (nameLower === 'apply_patch' || nameLower === 'patch') {
    let parsed: unknown
    try { parsed = JSON.parse(tool.inputJson) } catch { parsed = tool.inputJson }
    const patchText = extractPatchText(parsed, tool.inputJson)
    if (patchText) {
      return { kind: 'patch', content: patchText, copyText: buildCopyText(tool, patchText) }
    }
  }

  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(tool.inputJson) } catch {
    return { kind: 'raw', content: tool.inputJson, copyText: buildCopyText(tool, tool.inputJson) }
  }

  if (nameLower === 'edit' && typeof parsed.file_path === 'string' && 'old_string' in parsed && 'new_string' in parsed) {
    const filePath = parsed.file_path as string
    const diff = formatDiffHunk(parsed.old_string as string, parsed.new_string as string)
    const content = `file: ${filePath}\n${diff}`
    return { kind: 'claude-edit', filePath, content, copyText: buildCopyText(tool, content) }
  }

  if (nameLower === 'multiedit' && typeof parsed.file_path === 'string' && Array.isArray(parsed.edits)) {
    const filePath = parsed.file_path as string
    const edits = parsed.edits as Array<{ old_string?: string; new_string?: string }>
    const sections = edits.map((edit, i) => {
      const diff = formatDiffHunk(edit.old_string ?? '', edit.new_string ?? '')
      return `Edit ${i + 1}:\n${diff}`
    })
    const content = `file: ${filePath}\n${sections.join('\n\n')}`
    return { kind: 'claude-multiedit', filePath, content, copyText: buildCopyText(tool, content) }
  }

  if (nameLower === 'write' && typeof parsed.file_path === 'string' && 'content' in parsed) {
    const filePath = parsed.file_path as string
    const fileContent = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content)
    const content = `file: ${filePath}\n${fileContent}`
    return { kind: 'claude-write', filePath, content, copyText: buildCopyText(tool, content) }
  }

  const pretty = JSON.stringify(parsed, null, 2)
  return { kind: 'raw', content: pretty, copyText: buildCopyText(tool, pretty) }
}
