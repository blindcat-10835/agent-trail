'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useReplayStore } from '@/stores/replay-store'
import type { TraceTurn } from '@/types/trace'

interface ReplaySearchBarProps {
  turns: TraceTurn[]
}

export function ReplaySearchBar({ turns }: ReplaySearchBarProps) {
  const searchQuery = useReplayStore((s) => s.searchQuery)
  const setSearchQuery = useReplayStore((s) => s.setSearchQuery)
  const searchMatches = useReplayStore((s) => s.searchMatches)
  const setSearchMatches = useReplayStore((s) => s.setSearchMatches)
  const currentMatchIndex = useReplayStore((s) => s.currentMatchIndex)
  const setCurrentMatchIndex = useReplayStore((s) => s.setCurrentMatchIndex)
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search execution (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localQuery)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [localQuery, setSearchQuery])

  // Execute search when query or turns change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchMatches([])
      setCurrentMatchIndex(0)
      return
    }
    const q = searchQuery.toLowerCase()
    const matches: { turnId: string; matchCount: number }[] = []
    for (const turn of turns) {
      let count = 0
      if (turn.userMessage?.content?.toLowerCase().includes(q)) count++
      for (const msg of turn.assistantMessages) {
        if (msg.content.toLowerCase().includes(q)) count++
      }
      for (const act of turn.activities) {
        if (act.type === 'tool_call' && act.name.toLowerCase().includes(q)) count++
      }
      if (count > 0) {
        matches.push({ turnId: turn.id, matchCount: count })
      }
    }
    setSearchMatches(matches)
    if (matches.length > 0) {
      setCurrentMatchIndex(1)
      scrollToTurn(matches[0].turnId)
    } else {
      setCurrentMatchIndex(0)
    }
  }, [searchQuery, turns, setSearchMatches, setCurrentMatchIndex])

  // Scroll to current match — target the <mark> inside the turn card
  const scrollToTurn = useCallback((turnId: string) => {
    const turn = turns.find((t) => t.id === turnId)
    if (turn) {
      const card = document.getElementById(`turn-${turn.index}`)
      const mark = card?.querySelector('mark')
      const target = mark ?? card
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [turns])

  // Handle Enter / Shift+Enter for match navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        // Previous match
        const prev = currentMatchIndex > 1 ? currentMatchIndex - 1 : searchMatches.length
        setCurrentMatchIndex(prev)
        scrollToTurn(searchMatches[prev - 1]?.turnId)
      } else {
        // Next match
        const next = currentMatchIndex < searchMatches.length ? currentMatchIndex + 1 : 1
        setCurrentMatchIndex(next)
        scrollToTurn(searchMatches[next - 1]?.turnId)
      }
    }
  }, [currentMatchIndex, searchMatches, setCurrentMatchIndex, scrollToTurn])

  const handleClear = () => {
    setLocalQuery('')
    setSearchQuery('')
    setSearchMatches([])
    setCurrentMatchIndex(0)
  }

  // Expose input ref for "/" key shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="relative flex items-center gap-2">
      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search turns..."
        className="w-full pl-8 pr-16 py-2 text-[12px] bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 transition-colors"
      />
      {localQuery && (
        <button
          onClick={handleClear}
          className="absolute right-10 p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      {searchMatches.length > 0 && (
        <span className="absolute right-12 text-[10px] text-muted-foreground font-mono tabular-nums">
          {currentMatchIndex} of {searchMatches.length}
        </span>
      )}
    </div>
  )
}
