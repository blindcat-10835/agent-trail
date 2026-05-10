'use client'

import { useEffect, useCallback, useState } from 'react'
import { ChevronUp, ChevronDown, Copy, Check } from 'lucide-react'
import { useReplayStore } from '@/stores/replay-store'
import type { TraceTurn } from '@/types/trace'

interface TurnNavigatorProps {
  turns: TraceTurn[]
  sessionId?: string
}

export function TurnNavigator({ turns, sessionId }: TurnNavigatorProps) {
  const currentTurnIndex = useReplayStore((s) => s.currentTurnIndex)
  const setCurrentTurnIndex = useReplayStore((s) => s.setCurrentTurnIndex)
  const collapseAll = useReplayStore((s) => s.collapseAll)
  const [jumpValue, setJumpValue] = useState('')
  const [hashCopied, setHashCopied] = useState(false)

  const total = turns.length

  const scrollToTurn = useCallback((index: number) => {
    const el = document.getElementById(`turn-${index}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const goToPrev = useCallback(() => {
    const prev = currentTurnIndex > 0 ? currentTurnIndex - 1 : 0
    setCurrentTurnIndex(prev)
    scrollToTurn(prev)
  }, [currentTurnIndex, setCurrentTurnIndex, scrollToTurn])

  const goToNext = useCallback(() => {
    const next = currentTurnIndex < total - 1 ? currentTurnIndex + 1 : total - 1
    setCurrentTurnIndex(next)
    scrollToTurn(next)
  }, [currentTurnIndex, total, setCurrentTurnIndex, scrollToTurn])

  const handleJump = useCallback(() => {
    const num = parseInt(jumpValue, 10)
    if (!isNaN(num) && num >= 1 && num <= total) {
      const idx = num - 1
      setCurrentTurnIndex(idx)
      scrollToTurn(idx)
    }
    setJumpValue('')
  }, [jumpValue, total, setCurrentTurnIndex, scrollToTurn])

  // Keyboard shortcuts (scoped to replay page)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        goToNext()
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'Escape') {
        collapseAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goToNext, goToPrev, collapseAll])

  return (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-card flex-shrink-0">
      {/* Prev */}
      <button
        onClick={goToPrev}
        disabled={currentTurnIndex <= 0}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="w-3 h-3" />
        Prev
      </button>

      {/* Next */}
      <button
        onClick={goToNext}
        disabled={currentTurnIndex >= total - 1}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
      >
        Next
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Current position */}
      <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
        Turn {currentTurnIndex + 1} of {total}
      </span>

      {/* Session hash */}
      {sessionId && (
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(sessionId)
            setHashCopied(true)
            setTimeout(() => setHashCopied(false), 2000)
          }}
          className="flex items-center gap-1.5 ml-auto px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors group"
          title={`Copy session ID: ${sessionId}`}
        >
          <span>{sessionId.slice(0, 8)}</span>
          {hashCopied ? (
            <Check className="w-3 h-3 text-[oklch(0.76_0.17_145)]" />
          ) : (
            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      )}

      {/* Jump to turn */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={total}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleJump() }}
          placeholder={`1-${total}`}
          className="w-16 px-2 py-1 text-[10px] font-mono bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 text-center"
        />
        <button
          onClick={handleJump}
          className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border border-border rounded hover:bg-accent/10 hover:border-accent transition-colors text-accent"
        >
          Go
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <span className="text-[9px] text-muted-foreground hidden sm:inline">
        j/k to navigate
      </span>
    </div>
  )
}
