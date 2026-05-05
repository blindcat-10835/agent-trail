export const AGENT_STATUS_META: Record<string, { label: string; color: string; live: boolean }> = {
  working: { label: 'WORKING', color: 'var(--color-accent)', live: true },
  tool_calling: { label: 'TOOL', color: 'oklch(0.72 0.14 220)', live: true },
  speaking: { label: 'SPEAKING', color: 'oklch(0.76 0.17 145)', live: true },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)', live: false },
  error: { label: 'ERROR', color: 'var(--color-destructive)', live: false },
}
