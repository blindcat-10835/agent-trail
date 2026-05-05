'use client'

import { useState, useCallback } from 'react'
import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { clearDashboardSnapshot } from '@/lib/dashboard-snapshot-cache'
import { cn } from '@/lib/utils'

type ActionStatus = 'idle' | 'loading' | 'success' | 'error'

interface ActionDef {
  id: string
  label: string
  loadingLabel: string
  danger?: boolean
  confirm?: string
  execute: () => Promise<string | null>
}

const ACTIONS: ActionDef[] = [
  {
    id: 'restart',
    label: 'Restart OpenClaw',
    loadingLabel: 'Restarting...',
    danger: true,
    confirm: 'Restart OpenClaw? This will interrupt running tasks.',
    execute: async () => {
      const res = await fetch('/api/action/restart', { method: 'POST' })
      const data = await res.json()
      return data.success ? null : (data.error || 'Restart failed')
    },
  },
  {
    id: 'clear-cache',
    label: 'Clear Cache',
    loadingLabel: 'Clearing...',
    execute: async () => {
      clearDashboardSnapshot()
      return null
    },
  },
  {
    id: 'update',
    label: 'Update OpenClaw',
    loadingLabel: 'Updating...',
    danger: true,
    confirm: 'Update OpenClaw? This may take a minute.',
    execute: async () => {
      const res = await fetch('/api/action/update', { method: 'POST' })
      const data = await res.json()
      return data.success ? null : (data.error || 'Update failed')
    },
  },
  {
    id: 'reconnect',
    label: 'Reconnect Gateway',
    loadingLabel: 'Reconnecting...',
    execute: async () => {
      const store = useGatewayStore.getState()
      store.reconnect()
      return null
    },
  },
]

export function QuickActions() {
  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [settingsData, setSettingsData] = useState<{ gatewayUrl: string; gatewayToken: string } | null>(null)

  const handleAction = useCallback(async (action: ActionDef) => {
    if (action.confirm && !window.confirm(action.confirm)) return

    setStatuses((prev) => ({ ...prev, [action.id]: 'loading' }))
    setErrors((prev) => ({ ...prev, [action.id]: '' }))

    try {
      const error = await action.execute()
      if (error) {
        setStatuses((prev) => ({ ...prev, [action.id]: 'error' }))
        setErrors((prev) => ({ ...prev, [action.id]: error }))
      } else {
        setStatuses((prev) => ({ ...prev, [action.id]: 'success' }))
      }
    } catch (e) {
      setStatuses((prev) => ({ ...prev, [action.id]: 'error' }))
      setErrors((prev) => ({ ...prev, [action.id]: e instanceof Error ? e.message : 'Unknown error' }))
    }

    setTimeout(() => {
      setStatuses((prev) => ({ ...prev, [action.id]: 'idle' }))
    }, 2000)
  }, [])

  const handleSettings = useCallback(async () => {
    if (showSettings) {
      setShowSettings(false)
      return
    }
    try {
      const res = await fetch('/api/gateway-config')
      const data = await res.json()
      setSettingsData(data)
      setShowSettings(true)
    } catch {
      setSettingsData({ gatewayUrl: 'Error loading', gatewayToken: '' })
      setShowSettings(true)
    }
  }, [showSettings])

  return (
    <div className="text-[11.5px]">
      {ACTIONS.map((action) => {
        const status = statuses[action.id] || 'idle'
        const error = errors[action.id]
        return (
          <div key={action.id}>
            <button
              onClick={() => handleAction(action)}
              disabled={status === 'loading'}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 border-b border-border transition-colors text-left',
                'hover:bg-accent/5 disabled:opacity-60',
                action.danger && 'text-[oklch(0.65_0.18_25)]',
                status === 'error' && 'text-destructive',
                status === 'success' && 'text-[oklch(0.76_0.17_145)]',
              )}
            >
              <span className="font-medium">
                {status === 'loading' ? action.loadingLabel : action.label}
              </span>
              {status === 'loading' && (
                <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              )}
              {status === 'success' && <span className="text-xs">Done</span>}
              {status === 'idle' && action.danger && (
                <span className="text-[9px] text-muted-foreground tracking-wider uppercase">warn</span>
              )}
            </button>
            {error && (
              <div className="px-3 py-1 text-[10px] text-destructive bg-destructive/5 border-b border-border">
                {error}
              </div>
            )}
          </div>
        )
      })}

      {/* Settings toggle */}
      <button
        onClick={handleSettings}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 border-b border-border transition-colors text-left hover:bg-accent/5',
          showSettings && 'bg-accent/5',
        )}
      >
        <span className="font-medium">Gateway Settings</span>
        <span className="text-muted-foreground text-xs">{showSettings ? '▲' : '▼'}</span>
      </button>

      {/* Settings panel */}
      {showSettings && settingsData && (
        <div className="px-3 py-2.5 space-y-2 border-b border-border bg-muted/20">
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">WS URL</div>
            <div className="font-mono text-[11px] text-foreground truncate">{settingsData.gatewayUrl || 'Not configured'}</div>
          </div>
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Token</div>
            <div className="font-mono text-[11px] text-foreground">{settingsData.gatewayToken || 'Not set'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
