'use client'

import { useState, useMemo } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { selectSessionsState } from '@/stores/gateway/p0-selectors'
import { SessionsStatsBar } from '@/components/sessions/sessions-stats-bar'
import { SessionsTable } from '@/components/sessions/sessions-table'
import { SessionsDetailRail } from '@/components/sessions/sessions-detail-rail'
import type { TraceSession } from '@/types/trace'

export default function SessionsPage() {
  const sessionsState = selectSessionsState(useGatewayStore())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hideCron, setHideCron] = useState(true)

  const nonCronSessions = useMemo(
    () => hideCron ? sessionsState.data.filter(s => !s.key.includes(':cron:')) : sessionsState.data,
    [sessionsState.data, hideCron]
  )

  const availableModels = useMemo(() => {
    const models = new Set(sessionsState.data.map(s => s.model?.split('/').pop() || '-'))
    return Array.from(models).filter(m => m !== '-').sort()
  }, [sessionsState.data])

  const availableKinds = useMemo(() => {
    const kinds = new Set(sessionsState.data.map(s => s.kind || '-'))
    return Array.from(kinds).filter(k => k !== '-').sort()
  }, [sessionsState.data])

  // Handle UI states
  if (sessionsState.state === 'loading') {
    return <div className="flex items-center justify-center h-full"><span className="animate-pulse text-muted-foreground">Loading sessions...</span></div>
  }

  if (sessionsState.state === 'error') {
    return <div className="flex items-center justify-center h-full"><span className="text-destructive">Error loading sessions</span></div>
  }

  if (sessionsState.state === 'disconnected') {
    return <div className="flex items-center justify-center h-full"><span className="text-muted-foreground">Gateway disconnected</span></div>
  }

  return (
    <div className="relative h-full min-w-0 overflow-hidden">
      <div className="h-full overflow-auto">
        <div className="max-w-5xl mx-auto w-full flex flex-col p-3.5 gap-3">
          {/* Stats bar — adapted for new component signature */}
          <SessionsStatsBar sessions={nonCronSessions as unknown as TraceSession[]} totalCount={sessionsState.data.length} />

          {/* Cron toggle */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setHideCron(v => !v)}
              className={`flex-shrink-0 mt-0.5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] border rounded transition-all ${
                hideCron
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent/5'
              }`}
            >
              {hideCron ? 'CRON HIDDEN' : 'CRON SHOWN'}
            </button>
            <div className="flex-1 min-w-0 text-[10px] text-muted-foreground self-center">
              {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} &middot; {availableKinds.length} kind{availableKinds.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Table */}
          {nonCronSessions.length === 0 ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              No sessions found
            </div>
          ) : (
            <SessionsTable
              sessions={nonCronSessions}
              selectedKey={selectedKey}
              onSelectKey={setSelectedKey}
            />
          )}
        </div>
      </div>

      {/* Session detail overlay */}
      {selectedKey && (
        <SessionsDetailRail
          sessionId={selectedKey}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  )
}
