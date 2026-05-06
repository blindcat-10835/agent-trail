'use client'

import { useState, useCallback } from 'react'
import { Wrench, Sparkles, Bot, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import type { TraceTurn, TraceActivity } from '@/types/trace'
import { useReplayStore } from '@/stores/replay-store'
import { cn } from '@/lib/utils'
import { ToolBlock } from './tool-block'
import { SkillBlock } from './skill-block'
import { SubagentBlock } from './subagent-block'
import { ThinkingBlock } from './thinking-block'
import { SystemEventBlock } from './system-event-block'

interface TurnCardProps {
  turn: TraceTurn
}

export function TurnCard({ turn }: TurnCardProps) {
  const expandedTurns = useReplayStore((s) => s.expandedTurns)
  const toggleTurn = useReplayStore((s) => s.toggleTurn)
  const isExpanded = expandedTurns.has(turn.id)
  const [copied, setCopied] = useState(false)

  // Count activity types for collapsed badges
  const toolCount = turn.activities.filter((a) => a.type === 'tool_call').length
  const skillCount = turn.activities.filter((a) => a.type === 'skill_use').length
  const subagentCount = turn.activities.filter((a) => a.type === 'subagent_link').length

  const handleCopyTurn = useCallback(async () => {
    let text = `## Turn ${turn.index + 1}\n\n`
    if (turn.userMessage?.content) {
      text += `**User:** ${turn.userMessage.content}\n\n`
    }
    turn.assistantMessages.forEach((m) => {
      text += `**Assistant:** ${m.content}\n\n`
    })
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [turn])

  return (
    <div
      id={`turn-${turn.index}`}
      className={cn(
        'border border-border bg-card transition-all duration-200',
        isExpanded ? 'shadow-sm' : 'hover:border-foreground/10'
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={() => toggleTurn(turn.id)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors"
      >
        {/* Turn number */}
        <span className="text-[14px] font-semibold text-foreground font-mono min-w-[28px]">
          {turn.index + 1}
        </span>

        {/* Chevron */}
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        )}

        {/* User message preview (truncated, 1 line) */}
        <span className="flex-1 text-[12px] text-muted-foreground truncate min-w-0">
          {turn.userMessage?.content || '(no user input)'}
        </span>

        {/* Activity badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {toolCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-secondary border border-border rounded">
              <Wrench className="w-2.5 h-2.5" /> {toolCount}
            </span>
          )}
          {skillCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-secondary border border-border rounded">
              <Sparkles className="w-2.5 h-2.5" /> {skillCount}
            </span>
          )}
          {subagentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-secondary border border-border rounded">
              <Bot className="w-2.5 h-2.5" /> {subagentCount}
            </span>
          )}
        </div>

        {/* Copy turn button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCopyTurn() }}
          className="flex-shrink-0 p-1 text-muted-foreground hover:text-accent transition-colors"
          title={copied ? 'Copied!' : 'Copy Turn'}
        >
          {copied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
        </button>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* User message block */}
          {turn.userMessage?.content && (
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  USER
                </span>
                <CopyMessageButton content={turn.userMessage.content} />
              </div>
              <div className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap break-words font-mono">
                {turn.userMessage.content}
              </div>
            </div>
          )}

          {/* Activity blocks — rendered inline between user and assistant */}
          {turn.activities.map((activity, idx) => (
            <ActivityBlock key={`${activity.type}-${idx}`} activity={activity} turnIndex={turn.index} />
          ))}

          {/* Assistant message(s) */}
          {turn.assistantMessages.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  ASSISTANT
                </span>
              </div>
              {turn.assistantMessages.map((msg) => (
                <div key={msg.id} className="group relative">
                  <div className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  <CopyMessageButton content={msg.content} />
                </div>
              ))}
            </div>
          )}

          {/* Turn metadata footer */}
          <div className="px-4 py-2 border-t border-border/50 flex items-center gap-3 text-[9px] text-muted-foreground">
            {turn.durationMs != null && (
              <span>{formatDuration(turn.durationMs)}</span>
            )}
            {turn.tokenUsage && (
              <span>
                {turn.tokenUsage.inputTokens}&uarr; / {turn.tokenUsage.outputTokens}&darr; tokens
              </span>
            )}
            {turn.isTruncated && (
              <span className="text-[oklch(0.76_0.17_55)]">TRUNCATED</span>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Inline copy button for individual messages — shown on group hover */
function CopyMessageButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-accent flex-shrink-0"
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="w-2.5 h-2.5 text-accent" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  )
}

/** Discriminated union renderer for activity blocks */
function ActivityBlock({ activity, turnIndex }: { activity: TraceActivity; turnIndex: number }) {
  switch (activity.type) {
    case 'tool_call':
      return <ToolBlock tool={activity} />
    case 'skill_use':
      return <SkillBlock skill={activity} />
    case 'subagent_link':
      return <SubagentBlock subagent={activity} parentTurnIndex={turnIndex} />
    case 'thinking':
      return <ThinkingBlock thinking={activity} />
    case 'system':
      return <SystemEventBlock event={activity} />
    default:
      return null
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}
