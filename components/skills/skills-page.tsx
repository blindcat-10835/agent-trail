'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { HudPanel } from '@/components/hud/hud-panel'
import { EmptyState } from '@/components/dashboard/empty-state'

interface SkillStat {
  skill_name: string
  total_calls: number
  success_count: number
  error_count: number
  total_duration_ms: number
  source: string
  session_count: number
  avg_duration_ms: number
}

interface SkillSession {
  session_id: string
  session_name: string | null
  display_title: string | null
  source: string
  status: string
  duration_ms: number | null
  input_summary: string | null
  error: string | null
  updated_at: string | null
}

interface SkillsStatsResponse {
  stats: SkillStat[]
  total_skills: number
}

interface SkillDetailResponse {
  skill_name: string
  sessions: SkillSession[]
}

function fmtDur(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

const SKILL_COLOR = 'oklch(0.78 0.15 50)'

function SkillRow({
  stat,
  maxCalls,
  onSelect,
  isSelected,
}: {
  stat: SkillStat
  maxCalls: number
  onSelect: () => void
  isSelected: boolean
}) {
  const barWidth = (stat.total_calls / maxCalls) * 100
  const successRate = stat.total_calls > 0
    ? ((stat.success_count / stat.total_calls) * 100).toFixed(0)
    : '0'
  const hasErrors = stat.error_count > 0

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/5 transition-colors"
      >
        <Sparkles style={{ width: 14, height: 14, color: SKILL_COLOR, flexShrink: 0 }} />
        <div className="w-full flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground min-w-[120px] truncate">
              {stat.skill_name}
            </span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-[0.08em] font-mono">
              {stat.source}
            </span>
            <span className="text-[10px] font-bold font-mono text-foreground ml-auto">
              {stat.total_calls}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground min-w-[50px] text-right">
              {fmtDur(stat.total_duration_ms)}
            </span>
            <span className={`text-[9px] font-mono ${hasErrors ? 'text-red-400' : 'text-green-400'}`}>
              {successRate}%
            </span>
            <span className="text-[8px] text-muted-foreground font-mono">
              {stat.session_count} ses
            </span>
            <span className="text-muted-foreground">
              {isSelected
                ? <ChevronDown style={{ width: 12, height: 12 }} />
                : <ChevronRight style={{ width: 12, height: 12 }} />}
            </span>
          </div>
          <div className="h-1 bg-border/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                background: hasErrors
                  ? 'linear-gradient(90deg, oklch(0.76 0.17 145), oklch(0.7 0.2 30))'
                  : SKILL_COLOR,
              }}
            />
          </div>
        </div>
      </button>
    </div>
  )
}

function SkillSessionsList({ skillName }: { skillName: string }) {
  const { toolId } = useAgentTool()
  const [sessions, setSessions] = useState<SkillSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/agent-tools/${toolId}/sessions/skills?skillName=${encodeURIComponent(skillName)}`)
      .then((r) => r.json())
      .then((data: SkillDetailResponse) => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [skillName, toolId])

  if (loading) {
    return (
      <div className="px-8 py-3 bg-accent/5">
        <span className="text-[9px] text-muted-foreground animate-pulse">LOADING...</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="px-8 py-3 bg-accent/5">
        <span className="text-[9px] text-muted-foreground">No sessions found.</span>
      </div>
    )
  }

  return (
    <div className="px-8 py-2 bg-accent/5">
      <div className="flex items-center gap-3 px-3 py-1.5">
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-[120px]">SESSION</span>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SRC</span>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">STATUS</span>
        <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-auto">DURATION</span>
      </div>
      {sessions.map((ses) => (
        <div key={`${ses.session_id}-${ses.duration_ms}`} className="flex items-center gap-3 px-3 py-1.5 hover:bg-accent/10 transition-colors rounded-sm">
          <span className="text-[9px] font-mono text-foreground min-w-[120px] truncate">
            {ses.display_title ?? ses.session_name ?? ses.session_id.slice(0, 20)}
          </span>
          <span className="text-[8px] text-muted-foreground uppercase">{ses.source}</span>
          <span className={`text-[8px] font-mono ${ses.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {ses.status}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground ml-auto">
            {ses.duration_ms != null ? fmtDur(ses.duration_ms) : '-'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SkillsPage() {
  const { toolId, definition } = useAgentTool()
  const [data, setData] = useState<SkillsStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'calls' | 'duration'>('calls')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent-tools/${toolId}/sessions/skills`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [toolId])

  useEffect(() => { fetchData() }, [fetchData])

  const sortedStats = useMemo(() => {
    if (!data?.stats) return []
    return [...data.stats].sort((a, b) =>
      sortBy === 'duration'
        ? b.total_duration_ms - a.total_duration_ms
        : b.total_calls - a.total_calls
    )
  }, [data, sortBy])

  const maxCalls = useMemo(
    () => Math.max(...sortedStats.map((s) => s.total_calls), 1),
    [sortedStats],
  )

  if (loading) {
    return (
      <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px]">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[12px] font-bold uppercase tracking-[0.15em] text-foreground">SKILL USAGE</h1>
          <span className="text-[9px] text-muted-foreground animate-pulse">LOADING...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px]">
        <EmptyState heading="LOAD ERROR" body={error} />
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 min-w-0 overflow-y-auto p-[18px_22px_26px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-[12px] font-bold uppercase tracking-[0.15em] text-foreground">SKILL USAGE</h1>
          <span className="text-[9px] text-muted-foreground">{definition.label}</span>
          {data && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {data.total_skills} CALLS · {data.stats.length} SKILLS
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setSortBy('calls')}
            className={`text-[8px] px-2 py-1 font-bold uppercase tracking-[0.1em] border transition-colors ${
              sortBy === 'calls'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted-foreground hover:border-accent'
            }`}
          >
            BY CALLS
          </button>
          <button
            onClick={() => setSortBy('duration')}
            className={`text-[8px] px-2 py-1 font-bold uppercase tracking-[0.1em] border transition-colors ${
              sortBy === 'duration'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted-foreground hover:border-accent'
            }`}
          >
            BY DURATION
          </button>
        </div>
      </div>

      {sortedStats.length === 0 ? (
        <EmptyState
          icon={<Sparkles style={{ width: 24, height: 24 }} />}
          heading="NO SKILL DATA"
          body="No skill invocations recorded for this source. Skills appear when agents use _Skill tool calls."
        />
      ) : (
        <HudPanel>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40">
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground w-[14px]" />
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-[120px]">SKILL</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SRC</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground ml-auto">CALLS</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground min-w-[50px] text-right">DURATION</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SUCCESS</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SESSIONS</span>
          </div>
          {sortedStats.map((stat) => (
            <div key={`${stat.skill_name}-${stat.source}`}>
              <SkillRow
                stat={stat}
                maxCalls={maxCalls}
                onSelect={() => setSelectedSkill(selectedSkill === stat.skill_name ? null : stat.skill_name)}
                isSelected={selectedSkill === stat.skill_name}
              />
              {selectedSkill === stat.skill_name && (
                <SkillSessionsList skillName={stat.skill_name} />
              )}
            </div>
          ))}
        </HudPanel>
      )}
    </div>
  )
}
