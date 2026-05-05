'use client'

import type { CronTask } from '@/gateway/adapter-types'
import type { LogEntry } from '@/types/activity'
import { cn } from '@/lib/utils'

function fmtAgo(s: number): string {
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function fmtAhead(s: number): string {
  if (s < 60) return `in ${s}s`
  if (s < 3600) return `in ${Math.floor(s / 60)}m`
  return `in ${Math.floor(s / 3600)}h`
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m + 'm ' + rem + 's'
}

interface CronDrawerProps {
  task: CronTask
  runs: LogEntry[]
  onClose: () => void
}

export function CronDrawer({ task, runs, onClose }: CronDrawerProps) {
  const mostRecent = runs[0] ?? null

  const agentName = (mostRecent?.details?.agentName as string | undefined)
    ?? (mostRecent?.agentId ?? null)
  const agentInitial = agentName ? agentName.charAt(0).toUpperCase() : null

  const lastRunSec = task.state.lastRunAtMs
    ? Math.floor((Date.now() - task.state.lastRunAtMs) / 1000)
    : null
  const nextRunSec = task.state.nextRunAtMs
    ? Math.floor((task.state.nextRunAtMs - Date.now()) / 1000)
    : null

  const statusColor =
    !task.enabled
      ? 'text-muted-foreground'
      : task.state.lastRunStatus === 'ok'
        ? 'text-[oklch(0.76_0.17_145)]'
        : task.state.lastRunStatus === 'error'
          ? 'text-destructive'
          : 'text-muted-foreground'

  const dotColor =
    !task.enabled
      ? 'bg-muted-foreground'
      : task.state.lastRunStatus === 'ok'
        ? 'bg-[oklch(0.76_0.17_145)]'
        : task.state.lastRunStatus === 'error'
          ? 'bg-destructive'
          : 'bg-muted-foreground'

  const statusLabel = !task.enabled
    ? 'Disabled'
    : task.state.lastRunStatus === 'ok'
      ? 'Ok'
      : task.state.lastRunStatus === 'error'
        ? 'Error'
        : 'Unknown'

  const deliveryValue = (mostRecent?.details?.delivery as string | undefined)
    ?? (mostRecent?.details?.deliveryStatus as string | undefined)
    ?? null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
        style={{ animation: 'drawer-fade-in .15s ease' }}
        onClick={onClose}
      />
      <div
        className="fixed top-0 right-0 h-screen z-50 bg-background border-l border-border flex flex-col overflow-hidden"
        style={{
          width: 'min(560px, 92vw)',
          animation: 'drawer-slide-in .22s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 px-5 py-4 border-b border-border bg-card flex-shrink-0 relative">
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, oklch(0.76 0.17 145), transparent)`,
              opacity: 0.6,
            }}
          />
          {agentInitial ? (
            <div
              className="hud-clip-sm border border-border-strong bg-background grid place-items-center font-bold flex-shrink-0 text-[oklch(0.76_0.17_145)]"
              style={{ width: 40, height: 40, fontSize: 20 }}
            >
              {agentInitial}
            </div>
          ) : (
            <div
              className="hud-clip-sm border border-border-strong bg-background grid place-items-center font-bold flex-shrink-0 text-muted-foreground"
              style={{ width: 40, height: 40, fontSize: 20 }}
            >
              ⏱
            </div>
          )}
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground tracking-wide">{task.name}</div>
            {agentName && (
              <div className="text-[10.5px] text-muted-foreground tracking-wider">{agentName}</div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 text-[9px] tracking-[0.15em] uppercase font-bold', statusColor)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 hud-clip-sm border border-border grid place-items-center text-muted-foreground text-sm hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Fields */}
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[11.5px]">
            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Last run</dt>
            <dd className="text-foreground">
              {lastRunSec !== null && lastRunSec >= 0 ? fmtAgo(lastRunSec) : 'never'}
            </dd>

            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Next run</dt>
            <dd className="text-foreground">
              {nextRunSec !== null && nextRunSec > 0 ? fmtAhead(nextRunSec) : '—'}
            </dd>

            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Duration</dt>
            <dd className="text-foreground">
              {mostRecent?.durationMs != null ? fmtDuration(mostRecent.durationMs) : '—'}
            </dd>

            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Status</dt>
            <dd className={cn('font-semibold', statusColor)}>{statusLabel}</dd>

            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px]">Schedule</dt>
            <dd className="text-foreground">
              {task.schedule.kind === 'every' && (
                <div>{`every ${Math.round(task.schedule.everyMs / 1000)}s`}</div>
              )}
              {task.schedule.kind === 'at' && (
                <div>{task.schedule.at}</div>
              )}
              {task.schedule.kind === 'cron' && (
                <>
                  <div>cron</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{task.schedule.expr}</div>
                </>
              )}
            </dd>

            <dt className="text-muted-foreground tracking-[0.1em] uppercase text-[10px] self-center">Delivery</dt>
            <dd className="text-foreground">{deliveryValue ?? '—'}</dd>
          </dl>

          {/* Recent Runs */}
          <div>
            <div className="text-[9px] text-accent tracking-[0.25em] uppercase font-semibold mb-2 pb-1 border-b border-border">
              RECENT RUNS
            </div>
            {runs.length === 0 && (
              <div className="text-[11px] text-muted-foreground py-2">No runs recorded.</div>
            )}
            {runs.length > 0 && (
              <div className="border border-border">
                {runs.map((run) => {
                  const runOk = run.level !== 'error'
                  const runDot = runOk ? 'bg-[oklch(0.76_0.17_145)]' : 'bg-destructive'
                  const runStatus = run.level === 'error' ? 'Error' : (run.details?.deliveryStatus as string | undefined) ?? (run.details?.delivery as string | undefined) ?? 'Ok'
                  const runStatusColor = run.level === 'error' ? 'text-destructive' : 'text-[oklch(0.76_0.17_145)]'
                  const runAgo = fmtAgo(Math.floor((Date.now() - run.ts) / 1000))
                  const runDur = run.durationMs != null ? fmtDuration(run.durationMs) : '—'

                  return (
                    <div
                      key={run.id}
                      className="grid grid-cols-[10px_60px_52px_70px_1fr] gap-2 px-3 py-2 border-b border-border last:border-b-0 items-center text-[11px]"
                    >
                      <span className={cn('w-[7px] h-[7px] rounded-full flex-shrink-0', runDot)} />
                      <span className="text-muted-foreground tabular-nums text-[10px]">{runAgo}</span>
                      <span className="text-muted-foreground tabular-nums text-[10px]">{runDur}</span>
                      <span className={cn('font-semibold text-[10px]', runStatusColor)}>{runStatus}</span>
                      <span className="text-foreground/65 truncate text-[10.5px]">{run.summary}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
