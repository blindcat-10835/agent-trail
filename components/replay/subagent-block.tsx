'use client'

import { useState, useCallback } from 'react'
import { Bot, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAgentTool, useSessionTurns } from '@/lib/agent-tools/client-hooks'
import type { TraceSubagentLink } from '@/types/trace'
import { TurnCard } from './turn-card'
import { getTurnKey } from './key-utils'

interface SubagentBlockProps {
  subagent: TraceSubagentLink
  parentTurnIndex: number
  depth?: number
}

const MAX_DEPTH = 2
const AGENT_COLOR = 'oklch(0.78 0.15 320)'

export function SubagentBlock({ subagent, depth = 0 }: SubagentBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { toolId, href } = useAgentTool()
  const router = useRouter()

  const { turns: childTurns, loading, error } = useSessionTurns(
    toolId,
    loaded ? subagent.subagentSessionId : null,
    { limit: 20 },
  )

  const loadError = loaded ? error : null

  const handleLoad = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLoaded(true)
  }, [])

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLoaded(false)
    window.setTimeout(() => setLoaded(true), 0)
  }, [])

  const handleOpenFull = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(href(`/sessions/${subagent.subagentSessionId}`))
  }, [subagent.subagentSessionId, href, router])

  const shortId = subagent.subagentSessionId.slice(-12)
  const durationText = subagent.durationMs != null
    ? (subagent.durationMs < 1000 ? `${subagent.durationMs}ms` : `${(subagent.durationMs / 1000).toFixed(1)}s`)
    : ''

  return (
    <div className="act-row">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="act-head"
      >
        <Bot style={{ width: 12, height: 12, color: AGENT_COLOR, flexShrink: 0 }} />
        <span className="act-tag" style={{ color: AGENT_COLOR, borderColor: AGENT_COLOR }}>AGENT</span>
        <span className="act-name">Subagent</span>
        <span className="act-path mono" title={subagent.subagentSessionId}>{shortId}</span>
        <span className="act-time mono">{durationText}</span>
        <span className="act-dot" style={{ background: AGENT_COLOR, boxShadow: `0 0 5px ${AGENT_COLOR}` }} />
        <span className="act-chev">
          {expanded
            ? <ChevronDown style={{ width: 12, height: 12 }} />
            : <ChevronRight style={{ width: 12, height: 12 }} />}
        </span>
      </button>

      {expanded && (
        <div className="act-body">
          {depth >= MAX_DEPTH ? (
            <div style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: '8px 0', textAlign: 'center' }}>
              Max nesting depth reached
            </div>
          ) : !loaded ? (
            <button
              onClick={handleLoad}
              style={{ width: '100%', padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid var(--border)', background: 'none', color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }}
            >
              Load Subagent
            </button>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
            </div>
          ) : loadError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--destructive)', textTransform: 'uppercase' }}>ERR</div>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', textAlign: 'center' }}>Could not load subagent turns.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRetry} style={{ fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>RETRY</button>
                <button onClick={() => setLoaded(false)} style={{ fontSize: 9, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>DISMISS</button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 8, marginLeft: 16, borderLeft: '2px solid var(--border)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {childTurns.slice(0, 5).map((turn, index) => (
                <TurnCard key={getTurnKey(turn, index)} turn={turn} />
              ))}
              <button
                onClick={handleOpenFull}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Open Full Session <ExternalLink style={{ width: 10, height: 10 }} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
