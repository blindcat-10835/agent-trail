'use client'

import { useState, useEffect } from 'react'
import { useAgentTool } from '@/lib/agent-tools/client-hooks'
import { useToolSessions } from '@/lib/agent-tools/client-hooks'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { EmptyState } from '@/components/dashboard/empty-state'
import Link from 'next/link'

interface GatewaySessionMatch {
  gatewayKey: string
  gatewayLabel: string
  gatewayModel?: string
  ingestSessionId: string | null  // null = not yet indexed
  ingestLoading: boolean
}

/**
 * OpenClaw Dashboard Overview
 *
 * Per OPEN-02 and OPEN-03: Shows live Gateway connection state,
 * Gateway → ingest session drilldown links, "Not yet indexed" labels,
 * and explicit disconnected/unreachable states.
 *
 * KPI data remains skeleton (per D-13 — intentionally not connected to Gateway).
 * Agents/Skills/Cron/Activity sections remain as placeholders.
 */
export function OpenClawDashboard() {
  const { toolId, definition, href } = useAgentTool()
  const { sessions, loading: sessionsLoading } = useToolSessions(toolId, { limit: '10' })

  // Gateway state
  const gatewayStatus = useGatewayStore((s) => s.connectionStatus)
  const gatewaySessions = useGatewayStore((s) => s.sessions)
  const gatewayVersion = useGatewayStore((s) => s.gatewayVersion)

  // Match Gateway sessions to ingest sessions
  const [matches, setMatches] = useState<GatewaySessionMatch[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)

  useEffect(() => {
    if (gatewayStatus !== 'connected' || gatewaySessions.length === 0) {
      setMatches([])
      return
    }

    let cancelled = false
    setMatchesLoading(true)

    Promise.all(
      gatewaySessions.slice(0, 10).map(async (gs) => {
        try {
          const res = await fetch(
            `/api/agent-tools/openclaw/sessions/lookup?key=${encodeURIComponent(gs.key)}`,
          )
          if (res.ok) {
            const session = await res.json()
            return {
              gatewayKey: gs.key,
              gatewayLabel: gs.displayName || gs.label || gs.key,
              gatewayModel: gs.model,
              ingestSessionId: session.id,
              ingestLoading: false,
            }
          }
          return {
            gatewayKey: gs.key,
            gatewayLabel: gs.displayName || gs.label || gs.key,
            gatewayModel: gs.model,
            ingestSessionId: null,
            ingestLoading: false,
          }
        } catch {
          return {
            gatewayKey: gs.key,
            gatewayLabel: gs.displayName || gs.label || gs.key,
            gatewayModel: gs.model,
            ingestSessionId: null,
            ingestLoading: false,
          }
        }
      }),
    ).then((results) => {
      if (!cancelled) {
        setMatches(results)
        setMatchesLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [gatewayStatus, gatewaySessions])

  return (
    <div className="p-4 space-y-6 min-h-0 overflow-y-auto">
      {/* KPI Bar — skeleton, empty data (per D-13) */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          KPI OVERVIEW
        </h2>
        <div className="grid grid-cols-4 gap-px bg-border border border-border">
          {['FLEET STATUS', 'SESSIONS', 'SPEND', 'ACTIVITY'].map((label) => (
            <div key={label} className="bg-card px-4 py-3.5 flex flex-col gap-1">
              <div className="text-[9.5px] text-muted-foreground tracking-[0.2em] uppercase">
                {label}
              </div>
              <div className="text-2xl font-bold tracking-tight text-muted-foreground/40 tabular-nums">
                —
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 italic">
          KPI data will be populated from local file data sources in Phase 6+.
        </p>
      </section>

      {/* Agent Cards — skeleton, empty */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          AGENTS
        </h2>
        <EmptyState
          heading="NO AGENT DATA"
          body="Agent data will be populated from local file data sources in Phase 6+."
        />
      </section>

      {/* GATEWAY STATUS — NEW */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          GATEWAY STATUS
        </h2>
        <div className="border border-border bg-card p-4">
          {gatewayStatus === 'connected' ? (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full bg-[#22c55e]"
                style={{ boxShadow: '0 0 8px #22c55e' }}
              />
              <span className="text-sm">
                Gateway connected — v{gatewayVersion || '?'}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {gatewaySessions.length} active sessions
              </span>
            </div>
          ) : gatewayStatus === 'connecting' || gatewayStatus === 'reconnecting' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse" />
              <span className="text-sm">Gateway {gatewayStatus}...</span>
            </div>
          ) : (
            <EmptyState
              heading="GATEWAY DISCONNECTED"
              body="START THE GATEWAY SERVICE TO SEE LIVE OPENCLAW SESSION DATA."
            />
          )}
        </div>
      </section>

      {/* ACTIVE GATEWAY SESSIONS — NEW (drilldown) */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          ACTIVE GATEWAY SESSIONS
        </h2>
        {gatewayStatus !== 'connected' ? (
          <EmptyState
            heading="NO GATEWAY DATA"
            body="GATEWAY IS NOT CONNECTED. LIVE SESSION DATA UNAVAILABLE."
          />
        ) : matchesLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            heading="NO ACTIVE SESSIONS"
            body="NO GATEWAY SESSIONS CURRENTLY ACTIVE."
          />
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <div
                key={match.gatewayKey}
                className="border border-border bg-card px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm text-foreground font-medium">
                    {match.gatewayLabel}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {match.gatewayKey.slice(0, 40)}
                    {match.gatewayKey.length > 40 ? '...' : ''}
                    {match.gatewayModel && (
                      <span> · {match.gatewayModel}</span>
                    )}
                  </div>
                </div>
                <div>
                  {match.ingestSessionId ? (
                    <Link
                      href={href(`/sessions/${match.ingestSessionId}`)}
                      className="text-[11px] font-semibold text-accent hover:underline tracking-wider"
                    >
                      VIEW REPLAY →
                    </Link>
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic">
                      Not yet indexed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SESSIONS — from ingest (historical only) */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          INDEXED SESSIONS
        </h2>
        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            heading="NO SESSIONS"
            body={`ENSURE ${definition.shortLabel} SESSIONS DIRECTORY IS CONFIGURED IN INGEST.`}
          />
        ) : (
          <div className="border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-mono text-foreground font-bold">
                {sessions.length}
              </span>{' '}
              sessions indexed from ingest
            </div>
          </div>
        )}
      </section>

      {/* Skills — skeleton, empty */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          SKILLS
        </h2>
        <EmptyState
          heading="NO SKILL DATA"
          body="Skill data will be populated in Phase 6+."
        />
      </section>

      {/* Cron — placeholder */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          CRON
        </h2>
        <EmptyState
          heading="NO CRON DATA"
          body="Cron job data will be populated in Phase 6+."
        />
      </section>

      {/* Activity — placeholder */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          ACTIVITY
        </h2>
        <EmptyState
          heading="NO ACTIVITY DATA"
          body="Activity log data will be populated in Phase 6+."
        />
      </section>
    </div>
  )
}
