'use client'

import { useState, useCallback } from 'react'
import { Wrench, Sparkles, Bot, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import type { TraceTurn, TraceActivity, TraceMessage } from '@/types/trace'
import { useReplayStore } from '@/stores/replay-store'
import { cn } from '@/lib/utils'
import { ToolBlock } from './tool-block'
import { SkillBlock } from './skill-block'
import { SubagentBlock } from './subagent-block'
import { ThinkingBlock } from './thinking-block'
import { SystemEventBlock } from './system-event-block'
import { getActivityKey, getMessageKey } from './key-utils'
import { MarkdownContent } from './markdown-content'
import { InjectedContextBlock } from './injected-context-block'
import { parseUserMessage, getCleanPreview } from '@/lib/replay/parse-user-message'

interface TurnCardProps {
  turn: TraceTurn
}

export function TurnCard({ turn }: TurnCardProps) {
  const expandedTurns = useReplayStore((s) => s.expandedTurns)
  const toggleTurn = useReplayStore((s) => s.toggleTurn)
  const isExpanded = expandedTurns.has(turn.id)
  const searchQuery = useReplayStore((s) => s.searchQuery)
  const [copied, setCopied] = useState(false)
  const activityEntries = turn.activities.map((activity, idx) => ({ activity, idx }))
  const activitiesByOrdinal = groupActivityEntriesByOrdinal(activityEntries)
  const messageOrdinals = new Set(turn.assistantMessages.map((message) => message.ordinal))
  const unanchoredActivityEntries = activityEntries.filter(
    ({ activity }) => getActivityMessageOrdinal(activity) == null
  )
  const orphanedAnchoredActivityEntries = activityEntries.filter(({ activity }) => {
    const ordinal = getActivityMessageOrdinal(activity)
    return ordinal != null && !messageOrdinals.has(ordinal)
  })
  const hasVisibleAssistantMessages = turn.assistantMessages.some(shouldRenderAssistantMessage)

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
      if (shouldRenderAssistantMessage(m)) {
        text += `**Assistant:** ${m.content}\n\n`
      }
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggleTurn(turn.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTurn(turn.id) } }}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors cursor-pointer"
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
          {turn.userMessage?.content
            ? getCleanPreview(turn.userMessage.content)
            : '(no user input)'}
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
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* User message block */}
          {turn.userMessage?.content && (() => {
            const parsed = parseUserMessage(turn.userMessage.content)
            return (
              <div className="border-b border-border/50">
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      USER
                    </span>
                    <CopyMessageButton content={parsed.userText} />
                  </div>
                  {parsed.userText && (
                    <MarkdownContent
                      content={parsed.userText}
                      searchQuery={searchQuery}
                      className="text-[12px] leading-relaxed text-foreground"
                    />
                  )}
                </div>
                {parsed.injectedParts.map((part, i) => (
                  <InjectedContextBlock key={i} part={part} />
                ))}
              </div>
            )
          })()}

          {/* Unanchored activity blocks — system events without a message ordinal */}
          {unanchoredActivityEntries.map(({ activity, idx }) => (
            <ActivityBlock
              key={getActivityKey(activity, idx, turn.index)}
              activity={activity}
              turnIndex={turn.index}
            />
          ))}

          {/* Assistant message(s) */}
          {turn.assistantMessages.length > 0 && (
            <>
              {hasVisibleAssistantMessages && (
                <div className="px-4 pt-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      ASSISTANT
                    </span>
                  </div>
                </div>
              )}
              {turn.assistantMessages.map((msg, index) => {
                const attachedActivities = activitiesByOrdinal.get(msg.ordinal) ?? []
                const showMessage = shouldRenderAssistantMessage(msg)

                return (
                  <div key={getMessageKey(msg, index)}>
                    {showMessage && (
                      <div className="group relative px-4 pb-3">
                        <MarkdownContent
                          content={msg.content}
                          searchQuery={searchQuery}
                          className="text-[12px] leading-relaxed text-foreground"
                        />
                        <CopyMessageButton content={msg.content} />
                      </div>
                    )}
                    {attachedActivities.map(({ activity, idx }) => (
                      <ActivityBlock
                        key={getActivityKey(activity, idx, turn.index)}
                        activity={activity}
                        turnIndex={turn.index}
                      />
                    ))}
                  </div>
                )
              })}
              {orphanedAnchoredActivityEntries.map(({ activity, idx }) => (
                <ActivityBlock
                  key={getActivityKey(activity, idx, turn.index)}
                  activity={activity}
                  turnIndex={turn.index}
                />
              ))}
            </>
          )}

          {turn.assistantMessages.length === 0 && orphanedAnchoredActivityEntries.length > 0 && (
            <>
              {orphanedAnchoredActivityEntries.map(({ activity, idx }) => (
                <ActivityBlock
                  key={getActivityKey(activity, idx, turn.index)}
                  activity={activity}
                  turnIndex={turn.index}
                />
              ))}
            </>
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

type ActivityEntry = {
  activity: TraceActivity
  idx: number
}

function groupActivityEntriesByOrdinal(entries: ActivityEntry[]): Map<number, ActivityEntry[]> {
  const grouped = new Map<number, ActivityEntry[]>()
  for (const entry of entries) {
    const ordinal = getActivityMessageOrdinal(entry.activity)
    if (ordinal == null) continue
    const existing = grouped.get(ordinal) ?? []
    existing.push(entry)
    grouped.set(ordinal, existing)
  }
  return grouped
}

function getActivityMessageOrdinal(activity: TraceActivity): number | undefined {
  if (activity.type === 'tool_call') return activity.messageOrdinal
  if (activity.type === 'subagent_link') return activity.messageOrdinal
  return undefined
}

function shouldRenderAssistantMessage(message: TraceMessage): boolean {
  if (message.role !== 'assistant') return false
  const content = message.content.trim()
  if (!content) return false
  return !/^\[(function_call|custom_tool_call):/i.test(content)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}
