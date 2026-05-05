'use client'

import { useGatewayStore } from '@/stores/gateway/gateway-store'
import { Badge } from '@/components/ui/badge'

export function SkillsTab() {
  const skills = useGatewayStore((state) => state.skills)

  return (
    <div className="p-4 space-y-2">
      {skills.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          No skills available
        </div>
      ) : (
        skills.map((skill) => (
          <div
            key={skill.id}
            className="p-3 bg-card border border-border rounded space-y-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{skill.icon}</span>
              <span className="text-xs font-semibold text-foreground">{skill.name}</span>
            </div>
            {skill.description && (
              <div className="text-xs text-muted-foreground line-clamp-2">
                {skill.description}
              </div>
            )}
            <div className="flex items-center gap-2">
              {skill.version && (
                <Badge variant="secondary" className="text-xs">
                  v{skill.version}
                </Badge>
              )}
              {skill.author && (
                <span className="text-xs text-muted-foreground">by {skill.author}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
