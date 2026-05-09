export const AGENT_STATUS_META: Record<string, { label: string; color: string; live: boolean }> = {
  active: { label: 'ACTIVE', color: 'var(--color-accent)', live: true },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)', live: false },
  aborted: { label: 'ABORTED', color: 'var(--color-destructive)', live: false },
  error: { label: 'ERROR', color: 'var(--color-destructive)', live: false },
  unknown: { label: 'UNKNOWN', color: 'var(--color-muted-foreground)', live: false },
}
