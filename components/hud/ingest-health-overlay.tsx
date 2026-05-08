'use client'

import { useEffect, useRef } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useIngestHealthStore } from '@/stores/ingest-health-store'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 2000
const TIMEOUT_MS = 30000

export function IngestHealthOverlay() {
  const status = useIngestHealthStore((s) => s.status)
  const retry = useIngestHealthStore((s) => s.retry)
  const setConnected = useIngestHealthStore((s) => s.setConnected)
  const setTimeout_ = useIngestHealthStore((s) => s.setTimeout)

  const startedAtRef = useRef<number>(Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const statusRef = useRef(status)

  // Keep ref in sync so checkHealth always reads latest status
  statusRef.current = status

  const checkHealth = async () => {
    try {
      const res = await fetch('http://localhost:8078/health')
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'ok') {
          setConnected()
          startedAtRef.current = Date.now()
          return
        }
      }
      // Unhealthy or unexpected response
      handleUnhealthy()
    } catch {
      // Network error
      handleUnhealthy()
    }
  }

  const handleUnhealthy = () => {
    const currentStatus = statusRef.current
    if (currentStatus === 'connected') {
      // Was healthy, now not — transition back to checking with fresh timer
      startedAtRef.current = Date.now()
      // We call retry() to reset to 'checking', which triggers the status
      // effect below to restart polling with fresh timer
      retry()
      return
    }

    // Still in checking phase — check if we've timed out
    const elapsed = Date.now() - startedAtRef.current
    if (elapsed >= TIMEOUT_MS) {
      setTimeout_()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  const startPolling = () => {
    startedAtRef.current = Date.now()
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    intervalRef.current = setInterval(checkHealth, POLL_INTERVAL_MS)
    checkHealth()
  }

  // Mount: start polling
  useEffect(() => {
    startPolling()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restart polling whenever status resets to 'checking' (initial mount or retry)
  useEffect(() => {
    if (status === 'checking') {
      startPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (status === 'connected') return null

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
