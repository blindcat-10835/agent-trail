'use client'

import Link from 'next/link'
import { HudFrame } from '@/components/overview/hud-frame'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useQoderUsage } from '@/lib/agent-tools/client-hooks'
import type { QoderUsageEntry } from '@/types/overview'

function fmtDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function fmtTokens(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`
  return `${(value / 1_000_000).toFixed(2)}M`
}

function fmtCost(value: number | null): string {
  if (value == null) return '—'
  return `~$${value.toFixed(2)}`
}

function fmtCredits(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(2)
}

function fmtModel(value: string | null): string {
  if (!value) return 'UNKNOWN'
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-')
}

function fmtOperation(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === 'experts') return 'EXPERTS'
  if (normalized === 'agent') return 'AGENT'
  if (normalized === 'ask' || normalized === 'assistant') return 'ASK'
  return value.toUpperCase()
}

function MultiplierBadge({ entry }: { entry: QoderUsageEntry }) {
  if (entry.modelMultiplier == null) return null

  return (
    <span className="ml-1 rounded-sm border border-border/70 px-1 py-0.5 text-[9px] text-muted-foreground">
      {entry.modelMultiplier.toFixed(1)}x
    </span>
  )
}

export function QoderUsageList() {
  const { usage, loading, error } = useQoderUsage('qoder', 12)

  const right = usage.totalCostUsd != null
    ? <span className="font-mono text-accent">~${usage.totalCostUsd.toFixed(2)}</span>
    : undefined

  return (
    <HudFrame
      label="Qoder Estimated Usage"
      right={right}
      bodyClassName="p-0 overflow-hidden"
      glow
    >
      {loading ? (
        <div className="space-y-2 p-3.5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <EmptyState heading="USAGE UNAVAILABLE" body={error.toUpperCase()} />
      ) : usage.entries.length === 0 ? (
        <EmptyState heading="NO USAGE ROWS" body="NO QODER REQUEST-LEVEL TOKEN USAGE FOUND." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead className="border-b border-border/70 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">Time</th>
                <th className="px-3 py-2 font-bold">Source</th>
                <th className="px-3 py-2 font-bold">Operation</th>
                <th className="px-3 py-2 font-bold">Model</th>
                <th className="px-3 py-2 text-right font-bold">Tokens</th>
                <th className="px-3 py-2 text-right font-bold">Credits</th>
                <th className="px-3 py-2 text-right font-bold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/45 last:border-b-0 hover:bg-accent/5"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                    {fmtDate(entry.startedAt)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.source}</td>
                  <td className="px-3 py-2 font-bold text-foreground">{fmtOperation(entry.operation)}</td>
                  <td className="px-3 py-2">
                    <span>{fmtModel(entry.model)}</span>
                    <MultiplierBadge entry={entry} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {fmtTokens(entry.totalTokens)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {fmtCredits(entry.credits)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-accent">
                    <Link href={`/qoder/sessions/${encodeURIComponent(entry.sessionId)}`}>
                      {fmtCost(entry.costUsd)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HudFrame>
  )
}
