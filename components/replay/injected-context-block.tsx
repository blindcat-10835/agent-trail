'use client'

import { useState } from 'react'
import { Terminal, Info, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { InjectedPart } from '@/lib/replay/parse-user-message'
import { MarkdownContent } from './markdown-content'

interface TagMeta {
  label: string
  icon: React.ReactNode
}

function getTagMeta(tagName: string): TagMeta {
  const key = tagName.toLowerCase().replace(/-/g, '_')

  if (key === 'system_reminder') {
    return {
      label: 'SYSTEM REMINDER',
      icon: <Terminal className="w-3 h-3 flex-shrink-0" style={{ color: 'oklch(0.76 0.17 55)' }} />,
    }
  }
  if (key === 'local_command_caveat') {
    return {
      label: 'CAVEAT',
      icon: <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'oklch(0.76 0.17 55)' }} />,
    }
  }
  if (key === 'local_command_stdout' || key.startsWith('command_')) {
    return {
      label: tagName.toUpperCase().replace(/-/g, ' '),
      icon: <Terminal className="w-3 h-3 text-muted-foreground flex-shrink-0" />,
    }
  }
  return {
    label: tagName.toUpperCase().replace(/-/g, ' '),
    icon: <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />,
  }
}

export function InjectedContextBlock({ part }: { part: InjectedPart }) {
  const [expanded, setExpanded] = useState(false)
  const { label, icon } = getTagMeta(part.tagName)
  const preview = part.content.replace(/\n+/g, ' ').slice(0, 80)
  const hasMore = part.content.length > 80 || part.content.includes('\n')

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        {icon}
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {!expanded && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[240px] font-mono">
            {preview}{hasMore ? '…' : ''}
          </span>
        )}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <MarkdownContent
            content={part.content}
            className="text-[11px] text-muted-foreground bg-background/50 p-2 border border-border"
          />
        </div>
      )}
    </div>
  )
}
