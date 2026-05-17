'use client'

import { useState, useCallback, useMemo } from 'react'
import { Wrench, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import type { TraceToolCall } from '@/types/trace'
import { cn, shortPath } from '@/lib/utils'
import { formatToolDisplay } from './tool-formatters'

interface ToolBlockProps {
  tool: TraceToolCall
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  Read:  { label: 'READ',  color: 'oklch(0.78 0.10 220)' },
  Edit:  { label: 'EDIT',  color: 'var(--accent)' },
  Write: { label: 'WRITE', color: 'oklch(0.78 0.15 110)' },
  Bash:  { label: 'BASH',  color: 'oklch(0.78 0.12 300)' },
  Grep:  { label: 'GREP',  color: 'oklch(0.78 0.10 220)' },
  Task:  { label: 'TASK',  color: 'oklch(0.78 0.15 50)' },
  Agent: { label: 'AGENT', color: 'oklch(0.78 0.15 320)' },
  Other: { label: 'TOOL',  color: 'var(--muted-foreground)' },
}

function extractFilePath(tool: TraceToolCall, displayFilePath?: string): string {
  if (displayFilePath) return displayFilePath
  try {
    const p = JSON.parse(tool.inputJson)
    return p.file_path || p.path || ''
  } catch {
    return ''
  }
}

export function ToolBlock({ tool }: ToolBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inputCollapsed, setInputCollapsed] = useState(true)

  const display = useMemo(() => formatToolDisplay(tool), [tool])
  const lineCount = display.content.split('\n').length
  const isLongInput = lineCount > 10

  const kindMeta = CATEGORY_META[tool.category] ?? CATEGORY_META.Other
  const filePath = extractFilePath(tool, 'filePath' in display ? display.filePath : undefined)
  const durationText = tool.durationMs != null
    ? (tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`)
    : ''
  const dotColor =
    tool.status === 'success' ? 'oklch(0.76 0.17 145)' :
    tool.status === 'error' ? 'var(--destructive)' :
    'oklch(0.76 0.17 75)'

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(display.copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [display])

  return (
    <div className={`act-row${tool.status === 'error' ? ' err' : ''}`}>
      {/* Header — div[role=button] to avoid nesting <button> inside <button> (EL-001) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((prev) => !prev) } }}
        className="act-head"
      >
        <Wrench style={{ width: 12, height: 12, color: 'var(--muted-foreground)', flexShrink: 0 }} />
        <span className="act-tag" style={{ color: kindMeta.color, borderColor: kindMeta.color }}>
          {kindMeta.label}
        </span>
        <span className="act-name">{tool.displayName || tool.name}</span>
        <span className="act-path mono" title={filePath}>{shortPath(filePath)}</span>
        <span className="act-time mono">{durationText}</span>
        <span
          className="act-dot"
          style={{
            background: dotColor,
            boxShadow: `0 0 5px ${dotColor}`,
            animation: tool.status === 'pending' ? 'hud-pulse 1.4s infinite' : 'none',
          }}
        />
        <button
          onClick={handleCopy}
          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: 'var(--muted-foreground)', display: 'inline-flex', flexShrink: 0 }}
          title={copied ? 'Copied!' : 'Copy'}
        >
          {copied
            ? <Check style={{ width: 10, height: 10, color: 'var(--accent)' }} />
            : <Copy style={{ width: 10, height: 10 }} />}
        </button>
        <span className="act-chev">
          {expanded
            ? <ChevronDown style={{ width: 12, height: 12 }} />
            : <ChevronRight style={{ width: 12, height: 12 }} />}
        </span>
      </div>

      {expanded && (
        <div className="act-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tool.inputJson && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                INPUT
                {isLongInput && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setInputCollapsed((p) => !p) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 9, padding: 0 }}
                  >
                    {inputCollapsed ? '(expand)' : '(collapse)'}
                  </button>
                )}
              </div>
              <pre className={cn('act-pre', isLongInput && inputCollapsed && 'max-h-[160px] overflow-hidden')}>
                {display.content}
              </pre>
            </div>
          )}

          {tool.resultEvents.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                RESULT
              </div>
              {tool.resultEvents.map((event, i) => (
                <pre key={i} className="act-pre" style={{ marginBottom: i < tool.resultEvents.length - 1 ? 4 : 0 }}>
                  {event.timestamp && (
                    <span style={{ fontSize: 9, color: 'var(--muted-foreground)', display: 'block', marginBottom: 2 }}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  {event.content}
                </pre>
              ))}
            </div>
          )}

          {tool.error && (
            <pre className="act-pre err">{tool.error}</pre>
          )}
        </div>
      )}
    </div>
  )
}
