'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'

export function SkillsList({ onViewAll }: { onViewAll?: () => void }) {
  const skills = useGatewayStore((s) => s.skills)
  if (skills.length === 0) {
    return <div className="px-3 py-4 text-muted-foreground">No skills registered.</div>
  }
  const visible = skills.slice(0, 5)
  const hasMore = skills.length > 5
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-px bg-border border border-border">
        {visible.map((s) => (
          <div key={s.id} className="bg-card p-3.5 grid gap-1.5">
            <div className="text-[13px] text-accent font-semibold tracking-[0.02em]">{s.icon} {s.name}</div>
            <div className="text-[11px] text-foreground/65">{s.description || 'No description'}</div>
            <div className="text-[10px] text-muted-foreground tracking-[0.1em]">v{s.version}{s.author ? ` · ${s.author}` : ''}</div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={onViewAll}
          className="w-full mt-1 px-3 py-2 text-[10px] text-accent tracking-[0.2em] uppercase font-semibold hover:bg-accent/5 transition-colors text-right"
        >
          VIEW ALL ({skills.length}) →
        </button>
      )}
    </div>
  )
}
