import type { TraceActivity, TraceMessage, TraceTurn } from '@/types/trace'

export function getTurnKey(turn: TraceTurn, index = turn.index): string {
  return turn.id || `${turn.sessionId || 'session'}-turn-${turn.index ?? index}`
}

export function getMessageKey(message: TraceMessage, index: number): string {
  return message.id || `${message.role}-${message.ordinal ?? index}-${index}`
}

export function getActivityKey(
  activity: TraceActivity,
  index: number,
  turnIndex: number,
): string {
  if (activity.type === 'tool_call') {
    return activity.id || `tool-${activity.name}-${turnIndex}-${index}`
  }
  if (activity.type === 'skill_use') {
    return `skill-${activity.name}-${turnIndex}-${index}`
  }
  if (activity.type === 'subagent_link') {
    return activity.subagentSessionId || `subagent-${turnIndex}-${index}`
  }
  if (activity.type === 'system') {
    return `system-${activity.subtype}-${turnIndex}-${index}`
  }
  return `thinking-${turnIndex}-${index}`
}
