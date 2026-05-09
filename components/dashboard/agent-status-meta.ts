/**
 * Agent status to visual meta mapping
 *
 * Maps session statuses to display labels and semantic color tokens.
 */

export const AGENT_STATUS_META: Record<
  string,
  { label: string; color: string }
> = {
  active: { label: 'ACTIVE', color: 'var(--color-accent)' },
  idle: { label: 'IDLE', color: 'var(--color-muted-foreground)' },
  aborted: { label: 'ABORTED', color: 'var(--color-destructive)' },
  error: { label: 'ERROR', color: 'var(--color-destructive)' },
  unknown: { label: 'UNKNOWN', color: 'var(--color-muted-foreground)' },
}
