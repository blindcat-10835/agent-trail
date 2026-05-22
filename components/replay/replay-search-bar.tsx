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
    setCurrentMatchIndex(matches.length > 0 ? 1 : 0)
  }, [searchQuery, turns, setSearchMatches, setCurrentMatchIndex])

  // Handle Enter / Shift+Enter for match navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        const prev = currentMatchIndex > 1 ? currentMatchIndex - 1 : searchMatches.length
        setCurrentMatchIndex(prev)
      } else {
        const next = currentMatchIndex < searchMatches.length ? currentMatchIndex + 1 : 1
        setCurrentMatchIndex(next)
      }
    }
  }, [currentMatchIndex, searchMatches.length, setCurrentMatchIndex])

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
    <>
      <span className="v2-search-icon">
        <Search size={13} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search turns…"
        className="v2-search-input"
      />
      {searchMatches.length > 0 && (
        <span
          className="mono"
          style={{
            position: 'absolute',
            right: localQuery ? 34 : 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9,
            color: 'var(--muted-foreground)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {currentMatchIndex}/{searchMatches.length}
        </span>
      )}
      {localQuery ? (
        <button
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'inline-flex',
          }}
        >
          <X className="w-3 h-3" />
        </button>
      ) : (
        <span className="v2-kbd mono">/</span>
      )}
    </>
  )
}
