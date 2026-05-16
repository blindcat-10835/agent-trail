'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { TraceSession, TraceTurn, TraceActivity } from '@/types/trace'

interface TraceThreadProps {
  session: TraceSession | null
  turns: TraceTurn[]
  sessionId: string
  onBackToSessions: () => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '\u2014'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function deriveDisplayStatus(session: TraceSession | null): { label: string; color: string; pulse: boolean } | null {
  if (!session) return null
  if (session.status === 'active') return { label: 'LIVE', color: 'var(--status-success)', pulse: true }
  if (session.status === 'error') return { label: 'ERROR', color: 'var(--destructive)', pulse: false }
  if (session.status === 'aborted') return { label: 'ABORTED', color: 'var(--destructive)', pulse: false }
  if (session.metrics.isTruncated) return { label: 'TRUNCATED', color: 'oklch(0.76 0.17 55)', pulse: false }
  return null
}

const KIND_META: Record<string, { label: string; color: string }> = {
  read: { label: 'READ', color: 'oklch(0.78 0.10 220)' },
  edit: { label: 'EDIT', color: 'var(--accent)' },
  write: { label: 'WRITE', color: 'oklch(0.78 0.15 110)' },
  bash: { label: 'BASH', color: 'oklch(0.78 0.12 300)' },
  skill: { label: 'SKILL', color: 'oklch(0.78 0.15 50)' },
  agent: { label: 'AGENT', color: 'oklch(0.78 0.15 320)' },
}

function activityKind(act: TraceActivity): string {
  if (act.type === 'tool_call') {
    const cat = act.category
    if (cat === 'Read') return 'read'
    if (cat === 'Edit') return 'edit'
    if (cat === 'Bash') return 'bash'
    if (cat === 'Agent') return 'agent'
    if (cat === 'Grep' || cat === 'Task') return 'write'
    return 'read'
  }
  if (act.type === 'skill_use') return 'skill'
  if (act.type === 'subagent_link') return 'agent'
  return 'read'
}

function shouldShowActivity(act: TraceActivity): boolean {
  return act.type === 'tool_call' || act.type === 'skill_use' || act.type === 'subagent_link'
}

function activityName(act: TraceActivity): string {
  if (act.type === 'tool_call') return act.displayName || act.name
  if (act.type === 'skill_use') return act.displayName || act.name
  if (act.type === 'subagent_link') return 'subagent'
  return ''
}

function activityPath(act: TraceActivity): string {
  if (act.type === 'tool_call') {
    try {
      const parsed = JSON.parse(act.inputJson)
      return parsed.file_path || parsed.path || ''
    } catch {
      return ''
    }
  }
  if (act.type === 'subagent_link') return act.subagentSessionId
  return ''
}

function activityDuration(act: TraceActivity): number | undefined {
  if (act.type === 'tool_call') return act.durationMs
  if (act.type === 'skill_use') return act.durationMs
  if (act.type === 'subagent_link') return act.durationMs
  return undefined
}

function activityStatus(act: TraceActivity): 'ok' | 'err' | 'pending' {
  if (act.type === 'tool_call') {
    if (act.status === 'error') return 'err'
    if (act.status === 'pending') return 'pending'
    return 'ok'
  }
  if (act.type === 'skill_use') return act.status === 'error' ? 'err' : 'ok'
  return 'ok'
}

function activityError(act: TraceActivity): string | undefined {
  if (act.type === 'tool_call') return act.error
  if (act.type === 'skill_use') return act.error
  return undefined
}

function extractModel(turns: TraceTurn[]): string | null {
  for (const turn of turns) {
    for (const msg of turn.assistantMessages) {
      if (msg.model) return msg.model
    }
  }
  return null
}

function HudPill({ color, pulse, children }: { color: string; pulse?: boolean; children: React.ReactNode }) {
  return (
    <span className="hud-pill" style={{ color, borderColor: color, background: `color-mix(in oklch, ${color} 12%, transparent)` }}>
      {pulse && <span className="pulse-dot" style={{ background: color }} />}
      {children}
    </span>
  )
}

interface ActivityRowData {
  act: TraceActivity
  kind: string
  name: string
  path: string
  duration: number | undefined
  status: 'ok' | 'err' | 'pending'
  error: string | undefined
}

function toActivityRowData(act: TraceActivity): ActivityRowData {
  return {
    act,
    kind: activityKind(act),
    name: activityName(act),
    path: activityPath(act),
    duration: activityDuration(act),
    status: activityStatus(act),
    error: activityError(act),
  }
}

function ActivityRow({ data, expanded, onToggle }: { data: ActivityRowData; expanded: boolean; onToggle: () => void }) {
  const m = KIND_META[data.kind] || { label: data.kind.toUpperCase(), color: 'var(--muted-foreground)' }
  const sColor = data.status === 'ok' ? 'var(--status-success)' : data.status === 'err' ? 'var(--destructive)' : 'var(--status-warning)'
  return (
    <div className={`act-row ${expanded ? 'open' : ''} ${data.status === 'err' ? 'err' : ''}`}>
      <button className="act-head" onClick={onToggle}>
        <span className="act-tag" style={{ color: m.color, borderColor: m.color }}>{m.label}</span>
        <span className="act-name">{data.name}</span>
        <span className="act-path mono">{data.path}</span>
        <span className="act-spacer" />
        <span className="act-time mono">{data.duration != null ? formatDuration(data.duration) : ''}</span>
        <span
          className="act-dot"
          style={{
            background: sColor,
            boxShadow: `0 0 6px ${sColor}`,
            animation: data.status === 'pending' ? 'hud-pulse 1.4s infinite' : 'none',
          }}
        />
        <span className="act-chev">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
      </button>
      {expanded && (
        <div className="act-body">
          {data.error ? (
            <pre className="act-pre err">{data.error}</pre>
          ) : (
            <pre className="act-pre">{`$ ${data.name.toLowerCase()} ${data.path}\n\u2500 ${data.duration != null ? formatDuration(data.duration) : '?'} \u00b7 status: ${data.status}`}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function TurnCard({
  turn,
  focused,
  onFocus,
  expandedActs,
  onToggleAct,
}: {
  turn: TraceTurn
  focused: boolean
  onFocus: () => void
  expandedActs: Set<string>
  onToggleAct: (key: string) => void
}) {
  const ref = useRef<HTMLElement>(null)
  const userContent = turn.userMessage?.content || ''
  const assistantContent = turn.assistantMessages.map((m) => m.content).join('\n\n')
  const visibleActivities = turn.activities.filter(shouldShowActivity).map(toActivityRowData)
  const isErr = turn.enrichment?.failureStatus === 'error'
  const tokenIn = turn.tokenUsage?.inputTokens ?? 0
  const tokenOut = turn.tokenUsage?.outputTokens ?? 0

  return (
    <article
      ref={ref}
      className={`v2-turn ${focused ? 'focused' : ''} ${isErr ? 'err' : ''}`}
      data-turn={turn.index}
      onClick={onFocus}
    >
      <div className="v2-anchor">
        <span className="v2-num mono">{String(turn.index + 1).padStart(2, '0')}</span>
        <span className="v2-line" />
      </div>
      <div className="v2-content">
        <header className="v2-thead">
          <span className="v2-time mono">{formatTime(turn.startedAt)}</span>
          <span className="v2-meta mono">
            {formatDuration(turn.durationMs)}{' '}
            {'\u00b7'} {formatTokens(tokenIn)}\u2191/{formatTokens(tokenOut)}\u2193
          </span>
          {isErr && <HudPill color="var(--destructive)">FAILED</HudPill>}
        </header>

        <div className="v2-bubble user">
          <span className="v2-role">USER</span>
          <div className="v2-msg">{userContent}</div>
        </div>

        {assistantContent && (
          <div className="v2-bubble asst">
            <span className="v2-role">ASSISTANT</span>
            <div className="v2-msg">{assistantContent}</div>
          </div>
        )}

        {visibleActivities.length > 0 && (
          <div className="v2-acts">
            {visibleActivities.map((data, i) => (
              <ActivityRow
                key={`${turn.index}:${i}`}
                data={data}
                expanded={expandedActs.has(`${turn.index}:${i}`)}
                onToggle={() => onToggleAct(`${turn.index}:${i}`)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function Spine({ turns, focused, onPick }: { turns: TraceTurn[]; focused: number; onPick: (idx: number) => void }) {
  return (
    <aside className="v2-spine">
      <div className="v2-spine-head">
        <span className="eyebrow">TRACE</span>
        <span className="mono v2-dim">{turns.length} turns</span>
      </div>
      <div className="v2-spine-rail">
        {turns.map((t) => {
          const counts = t.enrichment?.activityCounts
          const tools = counts?.toolCalls ?? t.activities.filter((a) => a.type === 'tool_call').length
          const skills = counts?.skills ?? t.activities.filter((a) => a.type === 'skill_use').length
          const agents = counts?.subagents ?? t.activities.filter((a) => a.type === 'subagent_link').length
          const isErr = t.enrichment?.failureStatus === 'error'
          const userPreview = t.userMessage?.content || ''

          return (
            <button
              key={t.index}
              className={`v2-spine-node ${focused === t.index ? 'focused' : ''} ${isErr ? 'err' : ''}`}
              onClick={() => onPick(t.index)}
            >
              <span className="v2-spine-num mono">{String(t.index + 1).padStart(2, '0')}</span>
              <span className="v2-spine-preview">
                {userPreview.slice(0, 32)}
                {userPreview.length > 32 ? '\u2026' : ''}
              </span>
              <span className="v2-spine-glyphs">
                {tools > 0 && <span className="v2-glyph t">{'\u25AA'}{tools}</span>}
                {skills > 0 && <span className="v2-glyph s">{'\u25C7'}{skills}</span>}
                {agents > 0 && <span className="v2-glyph a">{'\u25C6'}{agents}</span>}
                {isErr && <span className="v2-glyph e">{'\u2715'}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function Inspector({
  turn,
  session,
  onClose,
}: {
  turn: TraceTurn | null
  session: TraceSession | null
  onClose: () => void
}) {
  if (!turn) return null

  const visibleActivities = turn.activities.filter(shouldShowActivity).map(toActivityRowData)
  const tokenIn = turn.tokenUsage?.inputTokens ?? 0
  const tokenOut = turn.tokenUsage?.outputTokens ?? 0

  return (
    <aside className="v2-inspect">
      <header className="v2-ins-head">
        <span className="eyebrow">TURN {String(turn.index + 1).padStart(2, '0')} {'\u00b7'} INSPECT</span>
        <button className="v2-ins-close" onClick={onClose}>
          {'\u00d7'}
        </button>
      </header>

      <div className="v2-ins-hudgrid">
        <div className="v2-ins-cell">
          <span className="v2-ins-k">TIME</span>
          <span className="v2-ins-v mono">{formatTime(turn.startedAt)}</span>
        </div>
        <div className="v2-ins-cell">
          <span className="v2-ins-k">DUR</span>
          <span className="v2-ins-v mono">{formatDuration(turn.durationMs)}</span>
        </div>
        <div className="v2-ins-cell">
          <span className="v2-ins-k">IN</span>
          <span className="v2-ins-v mono">
            {formatTokens(tokenIn)}
            <small>{'\u2191'}</small>
          </span>
        </div>
        <div className="v2-ins-cell">
          <span className="v2-ins-k">OUT</span>
          <span className="v2-ins-v mono">
            {formatTokens(tokenOut)}
            <small>{'\u2193'}</small>
          </span>
        </div>
      </div>

      <div className="v2-ins-section">
        <div className="eyebrow">ACTIVITY {'\u00b7'} {visibleActivities.length}</div>
        <div className="v2-ins-stack">
          {visibleActivities.length === 0 ? (
            <div className="v2-ins-empty mono">{'\u2014'} no tools called</div>
          ) : (
            visibleActivities.map((data, i) => {
              const m = KIND_META[data.kind] || { color: 'var(--muted-foreground)' }
              return (
                <div key={i} className="v2-ins-act">
                  <span
                    className="v2-ins-pip"
                    style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
                  />
                  <span className="mono v2-ins-actname">{data.name}</span>
                  <span className="mono v2-ins-actpath">{data.path}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="v2-ins-section">
        <div className="eyebrow">CONTEXT</div>
        <dl className="v2-ins-kv">
          <dt>Model</dt>
          <dd className="mono">{extractModel(session?.turns || []) || '\u2014'}</dd>
          <dt>Project</dt>
          <dd>{session?.project || '\u2014'}</dd>
          <dt>Branch</dt>
          <dd className="mono">{session?.gitBranch || '\u2014'}</dd>
          <dt>CWD</dt>
          <dd className="mono">{session?.cwd || '\u2014'}</dd>
        </dl>
      </div>
    </aside>
  )
}

export function TraceThread({ session, turns, sessionId, onBackToSessions }: TraceThreadProps) {
  const [focused, setFocused] = useState(0)
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set())
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [query, setQuery] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const total = turns.length

  const filtered = useMemo(() => {
    if (!query) return turns
    const q = query.toLowerCase()
    return turns.filter(
      (t) =>
        (t.userMessage?.content || '').toLowerCase().includes(q) ||
        t.assistantMessages.some((m) => m.content.toLowerCase().includes(q))
    )
  }, [query, turns])

  const toggleAct = useCallback((key: string) => {
    setExpandedActs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const focus = useCallback(
    (idx: number) => {
      setFocused(idx)
      const el = scrollRef.current?.querySelector(`[data-turn="${idx}"]`)
      if (el && scrollRef.current) {
        const offset = (el as HTMLElement).offsetTop - 16
        scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' })
      }
    },
    []
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'j') {
        e.preventDefault()
        setFocused((prev) => Math.min(prev + 1, total - 1))
      }
      if (e.key === 'k') {
        e.preventDefault()
        setFocused((prev) => Math.max(prev - 1, 0))
      }
      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-turn="${focused}"]`)
    if (el && scrollRef.current) {
      const offset = (el as HTMLElement).offsetTop - 16
      scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' })
    }
  }, [focused])

  const displayStatus = deriveDisplayStatus(session)
  const model = extractModel(turns)
  const focusedTurn = turns[focused] ?? null

  const totalInput = session?.inputTokens ?? session?.metrics.inputTokens ?? 0
  const totalOutput = session?.outputTokens ?? session?.metrics.outputTokens ?? 0
  const cost = session?.estimatedCost

  return (
    <div className="v2-root">
      <div className="v2-hud">
        <button className="v2-back" onClick={onBackToSessions}>
          {'\u2039'} SESSIONS
        </button>
        <div className="v2-title-block">
          <div className="v2-title">{session?.displayTitle || session?.name || session?.id || '\u2014'}</div>
          <div className="v2-subline mono">
            <span className="v2-hash">{'\u25C6'} {session?.id ?? sessionId}</span>
            <span className="v2-sep">/</span>
            <span>{session?.project || '\u2014'}</span>
            {model && (
              <>
                <span className="v2-sep">/</span>
                <span>{model}</span>
              </>
            )}
          </div>
        </div>
        <div className="v2-hud-stats">
          <div className="v2-hud-stat">
            <span className="v2-hud-k">TURNS</span>
            <span className="v2-hud-v mono">{total}</span>
          </div>
          <div className="v2-hud-stat">
            <span className="v2-hud-k">IN</span>
            <span className="v2-hud-v mono">{formatTokens(totalInput)}</span>
          </div>
          <div className="v2-hud-stat">
            <span className="v2-hud-k">OUT</span>
            <span className="v2-hud-v mono">{formatTokens(totalOutput)}</span>
          </div>
          {cost != null && (
            <div className="v2-hud-stat">
              <span className="v2-hud-k">COST</span>
              <span className="v2-hud-v mono accent">${cost.toFixed(2)}</span>
            </div>
          )}
        </div>
        {displayStatus && (
          <HudPill color={displayStatus.color} pulse={displayStatus.pulse}>
            {displayStatus.label}
          </HudPill>
        )}
        <button
          className="v2-hud-icon"
          title="Inspector"
          onClick={() => setInspectorOpen((o) => !o)}
        >
          {inspectorOpen ? '\u00bb' : '\u00ab'}
        </button>
      </div>

      <div className="v2-cmd">
        <div className="v2-search">
          <span className="v2-search-icon">
            <Search size={13} />
          </span>
          <input
            ref={searchInputRef}
            className="v2-search-input"
            placeholder="Search turns\u2026"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="v2-kbd mono">/</span>
        </div>
        <div className="v2-cmd-controls">
          <button className="v2-step" onClick={() => focus(Math.max(focused - 1, 0))} title="Prev (k)">
            {'\u2039'}
          </button>
          <span className="v2-step-pos mono">
            {String(focused + 1).padStart(2, '0')} <span className="v2-dim">of</span> {total}
          </span>
          <button className="v2-step" onClick={() => focus(Math.min(focused + 1, total - 1))} title="Next (j)">
            {'\u2039'}
          </button>
          <span className="v2-cmd-sep">{'\u2502'}</span>
          <button
            className="v2-link"
            onClick={() =>
              setExpandedActs(
                new Set(
                  turns.flatMap((t) =>
                    t.activities
                      .filter(shouldShowActivity)
                      .map((_, i) => `${t.index}:${i}`)
                  )
                )
              )
            }
          >
            EXPAND ALL
          </button>
          <button className="v2-link" onClick={() => setExpandedActs(new Set())}>
            COLLAPSE
          </button>
          <span className="v2-cmd-sep">{'\u2502'}</span>
          <span className="v2-hint mono">j / k {'\u00b7'} /</span>
        </div>
      </div>

      <div className="v2-grid">
        <Spine turns={filtered} focused={focused} onPick={focus} />

        <main className="v2-trace" ref={scrollRef}>
          <div className="v2-trace-pad">
            {filtered.map((t) => (
              <TurnCard
                key={t.id}
                turn={t}
                focused={focused === t.index}
                onFocus={() => setFocused(t.index)}
                expandedActs={expandedActs}
                onToggleAct={toggleAct}
              />
            ))}
            <div className="v2-trace-end mono">{'\u2014'} END OF TRACE {'\u2014'} listening for new turns</div>
          </div>
        </main>

        {inspectorOpen && (
          <Inspector turn={focusedTurn} session={session} onClose={() => setInspectorOpen(false)} />
        )}
      </div>
    </div>
  )
}
