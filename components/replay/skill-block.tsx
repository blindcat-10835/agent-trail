'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import type { TraceSkillUse } from '@/types/trace'

interface SkillBlockProps {
  skill: TraceSkillUse
}

const SKILL_COLOR = 'oklch(0.78 0.15 50)'

export function SkillBlock({ skill }: SkillBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const dotColor = skill.status === 'success' ? 'oklch(0.76 0.17 145)' : 'var(--destructive)'
  const durationText = skill.durationMs != null
    ? (skill.durationMs < 1000 ? `${skill.durationMs}ms` : `${(skill.durationMs / 1000).toFixed(1)}s`)
    : ''
  const summary = skill.inputSummary.length > 60
    ? skill.inputSummary.slice(0, 60) + '…'
    : skill.inputSummary

  return (
    <div className={`act-row${skill.status === 'error' ? ' err' : ''}`}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="act-head"
      >
        <Sparkles style={{ width: 12, height: 12, color: SKILL_COLOR, flexShrink: 0 }} />
        <span className="act-tag" style={{ color: SKILL_COLOR, borderColor: SKILL_COLOR }}>SKILL</span>
        <span className="act-name">{skill.displayName || skill.name}</span>
        <span className="act-path mono">{summary}</span>
        <span className="act-time mono">{durationText}</span>
        <span
          className="act-dot"
          style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
        />
        <span className="act-chev">
          {expanded
            ? <ChevronDown style={{ width: 12, height: 12 }} />
            : <ChevronRight style={{ width: 12, height: 12 }} />}
        </span>
      </button>

      {expanded && (
        <div className="act-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 4 }}>INPUT</div>
            <pre className="act-pre">{skill.inputSummary}</pre>
          </div>
          {skill.result && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 4 }}>RESULT</div>
              <pre className="act-pre">{skill.result}</pre>
            </div>
          )}
          {skill.error && (
            <pre className="act-pre err">{skill.error}</pre>
          )}
        </div>
      )}
    </div>
  )
}
