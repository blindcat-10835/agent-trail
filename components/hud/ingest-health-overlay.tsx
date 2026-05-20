'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useIngestHealthStore } from '@/stores/ingest-health-store'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 1000
const TIMEOUT_MS = 30000
const HEALTH_FETCH_TIMEOUT_MS = 5000
const HEALTH_ENDPOINT = '/api/ingest/health'
const INITIAL_CHECK_GRACE_MS = 700

export function IngestHealthOverlay() {
  const status = useIngestHealthStore((s) => s.status)
  const hasConnectedOnce = useIngestHealthStore((s) => s.hasConnectedOnce)
  const retry = useIngestHealthStore((s) => s.retry)
  const setConnected = useIngestHealthStore((s) => s.setConnected)
  const setTimeout_ = useIngestHealthStore((s) => s.setTimeout)
  const hydrateConnectedOnce = useIngestHealthStore((s) => s.hydrateConnectedOnce)

  const startedAtRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusRef = useRef(status)
  const [showInitialCheck, setShowInitialCheck] = useState(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const checkHealth = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_FETCH_TIMEOUT_MS)

    try {
      const res = await fetch(HEALTH_ENDPOINT, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (res.ok) {
        const data = await res.json() as { status?: string; ready?: boolean }
        if (data.status === 'ok' && data.ready !== false) {
          setConnected()
          return
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }

    if (statusRef.current === 'connected') {
      startedAtRef.current = Date.now()
      retry()
      return
    }

    const elapsed = Date.now() - startedAtRef.current
    if (elapsed >= TIMEOUT_MS) {
      setTimeout_()
      stopPolling()
    }
  }, [setConnected, setTimeout_, retry, stopPolling])

  const startPolling = useCallback(() => {
    startedAtRef.current = Date.now()
    stopPolling()
    intervalRef.current = setInterval(checkHealth, POLL_INTERVAL_MS)
    checkHealth()
  }, [checkHealth, stopPolling])

  useEffect(() => {
    if (status === 'checking') {
      startPolling()
    }
    return () => stopPolling()
  }, [status, startPolling, stopPolling])

  useEffect(() => {
    hydrateConnectedOnce()
    retry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status !== 'checking' || hasConnectedOnce) return

    const timer = setTimeout(() => setShowInitialCheck(true), INITIAL_CHECK_GRACE_MS)
    return () => clearTimeout(timer)
  }, [status, hasConnectedOnce])

  if (status === 'connected') return null

  if (status === 'checking' && !hasConnectedOnce && !showInitialCheck) return null

  // During initial checks and reconnects, avoid blocking the dashboard.
  if (status !== 'timeout') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 bg-muted/80 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm"
        aria-live="polite"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span>{hasConnectedOnce ? 'Reconnecting to data service...' : 'Connecting to data service...'}</span>
      </div>
    )
  }

  const isTimeout = status === 'timeout'

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm'
      )}
      aria-live="polite"
    >
      {isTimeout ? (
        <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
      ) : (
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" aria-hidden="true" />
      )}
      <p className="text-lg font-semibold text-foreground">
        {isTimeout ? 'Unable to connect to data service' : 'Connecting to data service...'}
      </p>
      {isTimeout && (
        <button
          onClick={retry}
          className={cn(
            'rounded-md bg-primary px-4 py-2 text-sm font-medium',
            'text-primary-foreground transition-colors hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
        >
          Retry
        </button>
      )}
    </div>
  )
}
