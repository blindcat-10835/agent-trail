'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { TraceTurn } from '@/types/trace'
import { useReplayStore } from '@/stores/replay-store'
import { TurnCard } from './turn-card'

interface TurnTimelineProps {
  turns: TraceTurn[]
  sessionId: string
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

const VIRTUALIZATION_THRESHOLD = 15

export function TurnTimeline({ turns, sessionId, hasMore, loadingMore, onLoadMore }: TurnTimelineProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const expandedTurns = useReplayStore((s) => s.expandedTurns)
  const expandAll = useReplayStore((s) => s.expandAll)
  const collapseAll = useReplayStore((s) => s.collapseAll)
  const scrollPositions = useReplayStore((s) => s.scrollPositions)
  const setScrollPosition = useReplayStore((s) => s.setScrollPosition)

  const isLongSession = turns.length > VIRTUALIZATION_THRESHOLD || hasMore
  const allExpanded = turns.length > 0 && turns.every((t) => expandedTurns.has(t.id))

  // Auto-expand short sessions on first load
  useEffect(() => {
    if (!isLongSession && turns.length > 0 && turns.length <= 10) {
      expandAll(turns.map((t) => t.id))
    }
  }, [turns.length, isLongSession]) // eslint-disable-line react-hooks/exhaustive-deps

  // Virtualizer (only for long sessions)
  const virtualizer = useVirtualizer({
    count: turns.length + (hasMore ? 1 : 0), // +1 for loading indicator
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // approximate collapsed turn height
    overscan: 5,
    enabled: isLongSession,
  })

  // Restore scroll position on mount
  useEffect(() => {
    const saved = scrollPositions[sessionId]
    if (saved && parentRef.current) {
      parentRef.current.scrollTop = saved
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save scroll position on scroll (throttled via RAF)
  const handleScroll = useCallback(() => {
    if (parentRef.current) {
      setScrollPosition(sessionId, parentRef.current.scrollTop)
    }
  }, [sessionId, setScrollPosition])

  // Pre-fetch next page when within 5 items of the end
  const handleScrollWithPrefetch = useCallback(() => {
    handleScroll()
    if (!parentRef.current || !hasMore || loadingMore) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    if (distanceFromBottom < 300) {
      // ~5 items × ~60px/item
      onLoadMore()
    }
  }, [handleScroll, hasMore, loadingMore, onLoadMore])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Expand All / Collapse All toggle */}
      {isLongSession && turns.length > 10 && (
        <div className="flex items-center gap-3 px-6 pt-4 pb-2 flex-shrink-0">
          <button
            onClick={() => expandAll(turns.map((t) => t.id))}
            className="text-[10px] font-semibold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Virtualized or direct turn list */}
      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-auto px-6 pb-4"
        onScroll={handleScrollWithPrefetch}
      >
        {isLongSession ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const turn = turns[virtualItem.index]
              // Loading indicator at the bottom
              if (!turn) {
                return (
                  <div
                    key="load-more"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    className="flex items-center justify-center py-4"
                  >
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
                  </div>
                )
              }
              return (
                <div
                  key={turn.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="pb-4"
                >
                  <TurnCard turn={turn} />
                </div>
              )
            })}
          </div>
        ) : (
          // Direct rendering for short sessions
          <div className="space-y-4 pt-4">
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
          </div>
        )}

        {/* End-of-session marker */}
        {!hasMore && turns.length > 0 && (
          <div className="flex items-center justify-center py-6">
            <div className="h-px flex-1 bg-border" />
            <span className="px-3 text-[9px] text-muted-foreground uppercase tracking-[0.2em]">
              END OF SESSION
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
      </div>
    </div>
  )
}
