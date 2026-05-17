'use client'

import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { DailyTokenUsage, OverviewAggregates } from '@/types/overview'
import type { AgentToolId } from '@/lib/agent-tools/types'

// ============================================================================
// Helpers
// ============================================================================

const DASH = '—'

function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1e6) return (n / 1000).toFixed(1) + 'K'
  return (n / 1e6).toFixed(2) + 'M'
}

function pctOf(a: number, total: number): string {
  if (!total) return '0.0%'
  return ((a / total) * 100).toFixed(1) + '%'
}

function fmtShortDate(date: string): string {
  const [, month, day] = date.split('-')
  if (!month || !day) return date
  return `${month}/${day}`
}

const SOURCE_LABELS: Record<string, string> = {
  all: 'ALL SOURCES',
  openclaw: 'OPENCLAW',
  'claude-code': 'CLAUDE:CODE',
  codex: 'CODEX',
}

// ============================================================================
// PulsePanel
// ============================================================================

function PulsePanel({
  toolId,
  aggregates,
  loading,
}: {
  toolId: AgentToolId
  aggregates: OverviewAggregates | null
  loading: boolean
}) {
  const label = SOURCE_LABELS[toolId] ?? toolId.toUpperCase()
  const sessions = aggregates ? String(aggregates.sessionCount) : DASH
  const avgTurns =
    aggregates && aggregates.sessionCount > 0
      ? (aggregates.turnCount / aggregates.sessionCount).toFixed(1)
      : DASH

  return (
    <div className="relative bg-card border border-border flex flex-col gap-[3px] overflow-hidden px-3 py-2">
      {/* Left accent strip */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
        style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)' }}
      />
      {/* Decorative circle corner */}
      <span
        className="absolute -right-7 -bottom-7 w-[70px] h-[70px] rounded-full pointer-events-none"
        style={{ border: '1px solid color-mix(in oklch, var(--accent) 16%, transparent)' }}
      />

      {/* Head */}
      <div className="flex justify-between items-center">
        <span
          className="text-[8.5px] font-bold tracking-[0.22em] uppercase"
          style={{ color: 'var(--accent)' }}
        >
          ◆ {label}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[7.5px] font-bold tracking-[0.2em]"
          style={{ color: 'var(--status-success)' }}
        >
          <span
            className="w-1 h-1 rounded-full animate-pulse"
            style={{ background: 'var(--status-success)', boxShadow: '0 0 6px var(--status-success)' }}
          />
          LIVE
        </span>
      </div>

      {/* Sessions stat */}
      <div className="flex items-baseline gap-2 flex-wrap relative z-[1] mt-1">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <span
            className="font-bold font-mono tabular-nums leading-none"
            style={{
              fontSize: 28,
              letterSpacing: '-0.025em',
              color: 'var(--foreground)',
              textShadow: '0 0 14px color-mix(in oklch, var(--accent) 30%, transparent)',
            }}
          >
            {sessions}
          </span>
        )}
        <span className="text-[7.5px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          SESSIONS · TOTAL
        </span>
      </div>

      {/* Dashed rule */}
      <div
        className="h-px my-1"
        style={{
          background: 'repeating-linear-gradient(90deg, var(--border) 0 4px, transparent 4px 6px)',
        }}
      />

      {/* Avg turns stat */}
      <div className="flex items-baseline gap-2 flex-wrap relative z-[1]">
        {loading ? (
          <Skeleton className="h-5 w-14" />
        ) : (
          <span
            className="font-bold font-mono tabular-nums leading-none"
            style={{
              fontSize: 18,
              letterSpacing: '-0.02em',
              color: 'var(--accent)',
              textShadow: '0 0 10px color-mix(in oklch, var(--accent) 35%, transparent)',
            }}
          >
            {avgTurns}
          </span>
        )}
        <span className="text-[7.5px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
          TURNS / SESSION · AVG
        </span>
      </div>

      {/* Projects count */}
      {aggregates && (
        <div className="mt-auto pt-3 flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
            {aggregates.projectCount} projects
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">
            {aggregates.turnCount} turns
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Token Chart
// ============================================================================

function buildLinePath(
  points: DailyTokenUsage[],
  maxValue: number,
  width: number,
  height: number,
  padX: number,
  padY: number,
): { linePath: string; areaPath: string; lastX: number; lastY: number } | null {
  if (points.length === 0) return null

  const baseline = height - padY
  const usableWidth = width - padX * 2
  const usableHeight = height - padY * 2
  const denominator = Math.max(points.length - 1, 1)
  const coords = points.map((point, index) => {
    const x = padX + (index / denominator) * usableWidth
    const y = baseline - (point.totalTokens / maxValue) * usableHeight
    return { x, y }
  })

  const linePath = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ')
  const first = coords[0]
  const last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${baseline} L ${first.x.toFixed(2)} ${baseline} Z`

  return { linePath, areaPath, lastX: last.x, lastY: last.y }
}

function DailyTokenChart({
  dailyTokens,
  loading,
  error,
}: {
  dailyTokens: DailyTokenUsage[]
  loading: boolean
  error?: string | null
}) {
  const totalTokens = dailyTokens.reduce((sum, day) => sum + day.totalTokens, 0)
  const peakTokens = dailyTokens.reduce((max, day) => Math.max(max, day.totalTokens), 0)
  const hasData = totalTokens > 0
  const firstDate = dailyTokens[0]?.date
  const lastDate = dailyTokens[dailyTokens.length - 1]?.date
  const maxValue = Math.max(peakTokens, 1)
  const chart = buildLinePath(dailyTokens, maxValue, 320, 126, 12, 14)

  const right = (
    <span className="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono tracking-[0.06em]">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: hasData ? 'var(--accent)' : 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)' }}
      />
      {loading ? 'LOADING' : hasData ? fmtTokens(totalTokens) : 'NO DATA'}
    </span>
  )

  return (
    <HudFrame
      label="30D · TOKEN USAGE"
      glow
      className="flex flex-col"
      bodyClassName="flex-1 min-h-0 p-3"
      right={right}
    >
      {loading ? (
        <div className="h-full flex flex-col gap-2 justify-end">
          <Skeleton className="h-24 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ) : error ? (
        <EmptyState heading="LOAD ERROR" body={error} />
      ) : !hasData || !chart ? (
        <EmptyState heading="NO TOKEN DATA" body="No sessions with token totals in the last 30 days." />
      ) : (
        <div className="h-full min-h-[138px] flex flex-col gap-2">
          <div className="relative flex-1 min-h-0">
            <svg
              viewBox="0 0 320 126"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              role="img"
              aria-label="Daily token usage over the last 30 days"
            >
              {[22, 52, 82, 112].map((y) => (
                <line
                  key={y}
                  x1="10"
                  x2="310"
                  y1={y}
                  y2={y}
                  stroke="color-mix(in oklch, var(--border) 52%, transparent)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
              <path
                d={chart.areaPath}
                fill="color-mix(in oklch, var(--accent) 16%, transparent)"
              />
              <path
                d={chart.linePath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={chart.lastX}
                cy={chart.lastY}
                r="3"
                fill="var(--accent)"
                style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
              />
            </svg>
          </div>
          <div className="grid grid-cols-3 items-center text-[9px] font-mono text-muted-foreground">
            <span>{firstDate ? fmtShortDate(firstDate) : DASH}</span>
            <span className="text-center">PEAK {fmtTokens(peakTokens)}</span>
            <span className="text-right">{lastDate ? fmtShortDate(lastDate) : DASH}</span>
          </div>
        </div>
      )}
    </HudFrame>
  )
}

// ============================================================================
// KPI Mini Card
// ============================================================================

function KpiMini({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: string
  color: string
  sub: string
}) {
  return (
    <div
      className="relative bg-card border border-border flex-1 overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto auto',
        columnGap: 8,
        alignItems: 'baseline',
        padding: '3px 9px 3px 11px',
      }}
    >
      {/* Left accent strip */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[2px] pointer-events-none"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {/* Decorative diamond corner */}
      <span
        className="absolute -right-[10px] -top-[10px] w-[18px] h-[18px] pointer-events-none rotate-45"
        style={{ border: `1px solid color-mix(in oklch, ${color} 30%, transparent)` }}
      />

      <span
        className="text-[7.5px] font-bold tracking-[0.2em] uppercase text-muted-foreground"
        style={{ gridColumn: 1, gridRow: 1 }}
      >
        {label}
      </span>
      <span
        className="font-bold font-mono tabular-nums leading-none"
        style={{
          gridColumn: 1,
          gridRow: 2,
          fontSize: 13,
          letterSpacing: '-0.01em',
          color,
          textShadow: `0 0 10px color-mix(in oklch, ${color} 30%, transparent)`,
        }}
      >
        {value}
      </span>
      <span
        className="text-[8px] text-muted-foreground text-right font-mono"
        style={{ gridColumn: 2, gridRow: '1 / 3', alignSelf: 'center', letterSpacing: '0.02em' }}
      >
        {sub}
      </span>
    </div>
  )
}

// ============================================================================
// KPI Mini Stack
// ============================================================================

function KpiMiniStack({
  aggregates,
  loading,
}: {
  aggregates: OverviewAggregates | null
  loading: boolean
}) {
  const totalT = aggregates?.totalTokens ?? 0
  const inT = aggregates?.inputTokens ?? 0
  const outT = aggregates?.outputTokens ?? 0

  return (
    <div className="flex flex-col gap-[3px]">
      <KpiMini
        label="TOTAL COST · 30D"
        value={DASH}
        color="var(--accent)"
        sub={loading ? '…' : `${fmtTokens(totalT)} tokens`}
      />
      <KpiMini
        label="INPUT TOKENS · 30D"
        value={loading ? DASH : fmtTokens(inT)}
        color="oklch(0.78 0.12 220)"
        sub={loading ? '…' : `${pctOf(inT, totalT)} of total`}
      />
      <KpiMini
        label="OUTPUT TOKENS · 30D"
        value={loading ? DASH : fmtTokens(outT)}
        color="oklch(0.78 0.15 45)"
        sub={loading ? '…' : `${pctOf(outT, totalT)} of total`}
      />
      <KpiMini
        label="DAILY BURN · AVG"
        value={DASH}
        color="oklch(0.75 0.17 340)"
        sub={loading ? '…' : 'Pricing pending'}
      />
    </div>
  )
}

// ============================================================================
// Props
// ============================================================================

interface KpiHeroProps {
  toolId: AgentToolId
  aggregates: OverviewAggregates | null
  dailyTokens: DailyTokenUsage[]
  dailyTokensLoading: boolean
  dailyTokensError?: string | null
  loading: boolean
  error?: string | null
}

// ============================================================================
// Component — Hero Band: PulsePanel + Chart + KpiMiniStack
// ============================================================================

export function KpiHero({
  toolId,
  aggregates,
  dailyTokens,
  dailyTokensLoading,
  dailyTokensError,
  loading,
  error,
}: KpiHeroProps) {
  if (error && !aggregates && !loading) {
    return (
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: '220px minmax(0,1fr) 200px', minHeight: 160 }}
      >
        <div className="bg-card border border-destructive flex items-center justify-center col-span-3">
          <span className="text-[10.5px] font-bold tracking-[0.15em] text-destructive uppercase">
            INGEST OFFLINE
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: '220px minmax(0,1fr) 200px', minHeight: 180 }}
    >
      <PulsePanel toolId={toolId} aggregates={aggregates} loading={loading} />
      <DailyTokenChart
        dailyTokens={dailyTokens}
        loading={dailyTokensLoading}
        error={dailyTokensError}
      />
      <KpiMiniStack aggregates={aggregates} loading={loading} />
    </div>
  )
}
