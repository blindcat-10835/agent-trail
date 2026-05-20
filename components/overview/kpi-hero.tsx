'use client'

import { useState, useRef } from 'react'
import { HudFrame } from '@/components/overview/hud-frame'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/dashboard/empty-state'
import type { DailyTokenUsage, OverviewAggregates, PricingStatus, TimeWindow } from '@/types/overview'
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

function fmtCost(n: number | null | undefined, status?: PricingStatus): string {
  if (n == null) return DASH
  const value = n < 0.01 ? n.toFixed(4) : n < 1 ? n.toFixed(3) : n.toFixed(2)
  return `${status === 'partial' ? '~' : ''}$${value}`
}

function pricingSub(status: PricingStatus | undefined, fallback: string): string {
  if (status === 'partial') return 'Partial pricing'
  if (status === 'unknown') return 'Pricing pending'
  return fallback
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
  opencode: 'OPENCODE',
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

const C_W = 320
const C_H = 126
const C_PAD_X = 12
const C_PAD_X_R = 20  // extra right margin to keep last point away from Y-axis labels
const C_PAD_Y = 14
const C_USABLE_W = C_W - C_PAD_X - C_PAD_X_R
const C_USABLE_H = C_H - C_PAD_Y * 2
const C_BASELINE = C_H - C_PAD_Y

function buildLinePath(
  points: DailyTokenUsage[],
  maxValue: number,
): { linePath: string; areaPath: string; lastX: number; lastY: number } | null {
  if (points.length === 0) return null

  const denominator = Math.max(points.length - 1, 1)
  const coords = points.map((point, index) => ({
    x: C_PAD_X + (index / denominator) * C_USABLE_W,
    y: C_BASELINE - (point.totalTokens / maxValue) * C_USABLE_H,
  }))

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(' ')
  const first = coords[0]
  const last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${C_BASELINE} L ${first.x.toFixed(2)} ${C_BASELINE} Z`

  return { linePath, areaPath, lastX: last.x, lastY: last.y }
}

const WINDOW_LABELS: Record<TimeWindow, string> = {
  today: 'TODAY',
  '7d': '7D',
  '30d': '30D',
  all: 'ALL',
}

function TodayTokenDisplay({
  dailyTokens,
  loading,
  error,
}: {
  dailyTokens: DailyTokenUsage[]
  loading: boolean
  error?: string | null
}) {
  const today = dailyTokens[0]
  const totalTokens = today?.totalTokens ?? 0
  const inputTokens = today?.inputTokens ?? 0
  const outputTokens = today?.outputTokens ?? 0
  const cost = today?.cost ?? null
  const hasData = totalTokens > 0

  const right = (
    <span className="inline-flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono tracking-[0.06em]">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: hasData ? 'var(--accent)' : 'color-mix(in oklch, var(--muted-foreground) 45%, transparent)' }}
      />
      {loading ? 'LOADING' : hasData ? today!.date : 'NO DATA'}
    </span>
  )

  return (
    <HudFrame
      label="TODAY · TOKEN USAGE"
      glow
      className="flex flex-col"
      bodyClassName="flex-1 min-h-0 p-3"
      right={right}
    >
      {loading ? (
        <div className="h-full flex flex-col items-center justify-center gap-3">
          <Skeleton className="h-14 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      ) : error ? (
        <EmptyState heading="LOAD ERROR" body={error} />
      ) : !hasData ? (
        <EmptyState heading="NO TOKEN DATA" body="No token usage recorded today." />
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <div
            className="font-bold font-mono tabular-nums leading-none"
            style={{
              fontSize: 52,
              letterSpacing: '-0.035em',
              color: 'var(--foreground)',
              textShadow: '0 0 32px color-mix(in oklch, var(--accent) 35%, transparent)',
            }}
          >
            {fmtTokens(totalTokens)}
          </div>
          <div
            className="text-[9px] font-bold tracking-[0.22em] uppercase"
            style={{ color: 'var(--accent)' }}
          >
            TOKENS TODAY
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono tabular-nums font-bold" style={{ fontSize: 15, color: 'oklch(0.78 0.12 220)' }}>
                {fmtTokens(inputTokens)}
              </span>
              <span className="text-[8px] tracking-[0.18em] text-muted-foreground uppercase">Input</span>
            </div>
            <span className="text-muted-foreground/30 text-[10px]">/</span>
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-mono tabular-nums font-bold" style={{ fontSize: 15, color: 'oklch(0.78 0.15 45)' }}>
                {fmtTokens(outputTokens)}
              </span>
              <span className="text-[8px] tracking-[0.18em] text-muted-foreground uppercase">Output</span>
            </div>
            {cost != null && (
              <>
                <span className="text-muted-foreground/30 text-[10px]">/</span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-mono tabular-nums font-bold" style={{ fontSize: 15, color: 'oklch(0.75 0.17 340)' }}>
                    ${cost < 0.01 ? cost.toFixed(4) : cost < 1 ? cost.toFixed(3) : cost.toFixed(2)}
                  </span>
                  <span className="text-[8px] tracking-[0.18em] text-muted-foreground uppercase">Cost</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </HudFrame>
  )
}

function DailyTokenChart({
  dailyTokens,
  loading,
  error,
  window,
}: {
  dailyTokens: DailyTokenUsage[]
  loading: boolean
  error?: string | null
  window: TimeWindow
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalTokens = dailyTokens.reduce((sum, day) => sum + day.totalTokens, 0)
  const peakTokens = dailyTokens.reduce((max, day) => Math.max(max, day.totalTokens), 0)
  const hasData = totalTokens > 0
  const firstDate = dailyTokens[0]?.date
  const lastDate = dailyTokens[dailyTokens.length - 1]?.date
  const maxValue = Math.max(peakTokens, 1)
  const chart = buildLinePath(dailyTokens, maxValue)

  const n = dailyTokens.length
  const denom = Math.max(n - 1, 1)

  // SVG coords for hovered point
  const hovSvgX = hoverIdx !== null ? C_PAD_X + (hoverIdx / denom) * C_USABLE_W : null
  const hovSvgY = hoverIdx !== null && dailyTokens[hoverIdx]
    ? C_BASELINE - (dailyTokens[hoverIdx].totalTokens / maxValue) * C_USABLE_H
    : null

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || n === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * C_W
    const adjusted = Math.max(0, Math.min(1, (svgX - C_PAD_X) / C_USABLE_W))
    setHoverIdx(Math.round(adjusted * denom))
  }

  const windowLabel = WINDOW_LABELS[window] ?? '30D'
  const noDataMsg = window === 'all'
    ? 'No sessions with token totals recorded.'
    : `No sessions with token totals in the last ${windowLabel}.`

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
      label={`${windowLabel} · TOKEN USAGE`}
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
        <EmptyState heading="NO TOKEN DATA" body={noDataMsg} />
      ) : (
        <div className="h-full min-h-[138px] flex flex-col gap-2">
          <div
            ref={containerRef}
            className="relative flex-1 min-h-0"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <svg
              viewBox={`0 0 ${C_W} ${C_H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-label={`Daily token usage — ${windowLabel}`}
            >
              {[22, 52, 82, 112].map((y) => (
                <line
                  key={y}
                  x1="10" x2="310" y1={y} y2={y}
                  stroke="color-mix(in oklch, var(--border) 52%, transparent)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
              <path d={chart.areaPath} fill="color-mix(in oklch, var(--accent) 16%, transparent)" />
              <path
                d={chart.linePath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Crosshair */}
              {hovSvgX !== null && hovSvgY !== null && (
                <line
                  x1={hovSvgX} x2={hovSvgX}
                  y1={hovSvgY} y2={C_BASELINE}
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.45"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Y-axis labels — HTML to avoid SVG distortion under non-uniform scaling */}
            {[22, 52, 82, 112].map((y) => {
              const value = maxValue * (1 - (y - C_PAD_Y) / C_USABLE_H)
              return (
                <div
                  key={y}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: `${(y / C_H) * 100}%`,
                    transform: 'translateY(-50%)',
                    fontSize: 7.5,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    color: 'color-mix(in oklch, var(--muted-foreground) 65%, transparent)',
                    background: 'color-mix(in oklch, var(--card) 80%, transparent)',
                    paddingLeft: 2,
                    pointerEvents: 'none',
                  }}
                >
                  {fmtTokens(value)}
                </div>
              )
            })}

            {/* Hover dot — rendered as HTML div to stay circular under non-uniform SVG scaling */}
            {hovSvgX !== null && hovSvgY !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(hovSvgX / C_W) * 100}%`,
                  top: `${(hovSvgY / C_H) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 6px var(--accent)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Tooltip */}
            {hoverIdx !== null && hovSvgX !== null && hovSvgY !== null && dailyTokens[hoverIdx] && (
              <div
                style={{
                  position: 'absolute',
                  left: `${(hovSvgX / C_W) * 100}%`,
                  top: `${(hovSvgY / C_H) * 100}%`,
                  transform: 'translate(-50%, calc(-100% - 10px))',
                  pointerEvents: 'none',
                  zIndex: 20,
                  background: 'color-mix(in oklch, var(--card) 92%, var(--accent) 8%)',
                  border: '1px solid color-mix(in oklch, var(--accent) 45%, transparent)',
                  boxShadow: '0 0 14px color-mix(in oklch, var(--accent) 18%, transparent)',
                  padding: '5px 8px',
                  minWidth: 88,
                }}
              >
                <div style={{ fontSize: 8.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 3, textTransform: 'uppercase' }}>
                  {dailyTokens[hoverIdx].date.replace(/-/g, '/')}
                </div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--accent)', lineHeight: 1, marginBottom: 3, textShadow: '0 0 8px color-mix(in oklch, var(--accent) 40%, transparent)' }}>
                  {fmtTokens(dailyTokens[hoverIdx].totalTokens)}
                </div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)', opacity: 0.8, letterSpacing: '0.04em' }}>
                  {'↑'}{fmtTokens(dailyTokens[hoverIdx].inputTokens)}{'  '}{'↓'}{fmtTokens(dailyTokens[hoverIdx].outputTokens)}
                </div>
              </div>
            )}
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
  window,
}: {
  aggregates: OverviewAggregates | null
  loading: boolean
  window: TimeWindow
}) {
  const totalT = aggregates?.totalTokens ?? 0
  const inT = aggregates?.inputTokens ?? 0
  const outT = aggregates?.outputTokens ?? 0
  const totalCost = aggregates?.totalCost ?? null
  const pricingStatus = aggregates?.pricingStatus
  const wLabel = WINDOW_LABELS[window] ?? '30D'
  const windowDays = window === 'today' ? 1 : window === '7d' ? 7 : window === 'all' ? null : 30
  const dailyBurn = totalCost === null || windowDays === null ? null : totalCost / windowDays

  return (
    <div className="flex flex-col gap-[3px]">
      <KpiMini
        label={`TOTAL COST · ${wLabel}`}
        value={loading ? DASH : fmtCost(totalCost, pricingStatus)}
        color="var(--accent)"
        sub={loading ? '…' : pricingSub(pricingStatus, `${fmtTokens(totalT)} tokens`)}
      />
      <KpiMini
        label={`INPUT TOKENS · ${wLabel}`}
        value={loading ? DASH : fmtTokens(inT)}
        color="oklch(0.78 0.12 220)"
        sub={loading ? '…' : `${pctOf(inT, totalT)} of total`}
      />
      <KpiMini
        label={`OUTPUT TOKENS · ${wLabel}`}
        value={loading ? DASH : fmtTokens(outT)}
        color="oklch(0.78 0.15 45)"
        sub={loading ? '…' : `${pctOf(outT, totalT)} of total`}
      />
      {window !== 'today' && (
        <KpiMini
          label="DAILY BURN · AVG"
          value={loading ? DASH : fmtCost(dailyBurn, pricingStatus)}
          color="oklch(0.75 0.17 340)"
          sub={loading ? '…' : pricingSub(pricingStatus, 'est. avg/day')}
        />
      )}
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
  window: TimeWindow
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
  window,
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
      {window === 'today' ? (
        <TodayTokenDisplay
          dailyTokens={dailyTokens}
          loading={dailyTokensLoading}
          error={dailyTokensError}
        />
      ) : (
        <DailyTokenChart
          dailyTokens={dailyTokens}
          loading={dailyTokensLoading}
          error={dailyTokensError}
          window={window}
        />
      )}
      <KpiMiniStack aggregates={aggregates} loading={loading} window={window} />
    </div>
  )
}
