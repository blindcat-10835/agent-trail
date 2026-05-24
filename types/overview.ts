/**
 * Overview Response Types
 *
 * TypeScript interfaces for all BFF overview endpoint response shapes.
 * Matches the ingest API contracts from ingest/api/overview.ts.
 *
 * @module types/overview
 */

// ============================================================================
// Aggregate Types
// ============================================================================

export interface OverviewAggregates {
  sessionCount: number
  turnCount: number
  projectCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens: number
  totalCost: number | null
  pricingStatus: PricingStatus
}

export interface DailyTokenUsage {
  date: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens: number
  cost: number | null
  pricingStatus: PricingStatus
}

export interface DailyTokensResponse {
  days: DailyTokenUsage[]
}

// ============================================================================
// Qoder Usage Types
// ============================================================================

export interface QoderUsageEntry {
  id: string
  sessionId: string
  requestId: string
  sessionTitle: string | null
  project: string
  startedAt: string | null
  source: 'IDE'
  operation: string
  model: string | null
  modelMultiplier: number | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  credits: number | null
  costUsd: number | null
  costSource: string
  pricingStatus: PricingStatus | string | null
}

export interface QoderUsageResponse {
  entries: QoderUsageEntry[]
  totalCredits: number | null
  totalCostUsd: number | null
  costSource: string
  calibration: {
    baseCreditsPerMillionTokensEnv: string | null
    ultimateMultiplierEnv: string | null
    usdPerCreditEnv: string | null
  }
}

// ============================================================================
// Model Ranking Types
// ============================================================================

export interface ModelRanking {
  name: string
  sessionCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens: number
  sharePercent: number
  cost: number | null
  pricingStatus: PricingStatus
}

export interface TopModelsResponse {
  models: ModelRanking[]
}

// ============================================================================
// Project Ranking Types
// ============================================================================

export interface ProjectRanking {
  project: string
  sessionCount: number
  turnCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  totalTokens: number
  rankWeight: number
  cost: number | null
  pricingStatus: PricingStatus
}

export interface TopProjectsResponse {
  projects: ProjectRanking[]
}

// ============================================================================
// Starred Session Types
// ============================================================================

export interface StarredSession {
  id: string
  name?: string
  source: string
  project: string
  status: string
  startedAt: string | null
  updatedAt?: string
  starredAt: string
}

export interface StarredResponse {
  starred: StarredSession[]
}

// ============================================================================
// Timeline Types
// ============================================================================

export type TimelineEventType = 'session_started' | 'session_completed' | 'session_error' | 'sync_error' | 'automation_completed'

export interface TimelineEvent {
  id: string
  source: string
  eventType: TimelineEventType
  eventTime: string | null
  project?: string
  name?: string
  status: string
  errorMessage?: string
}

export interface TimelineResponse {
  timeline: TimelineEvent[]
}

// ============================================================================
// Source Capabilities Types
// ============================================================================

export interface SourceCapabilitySet {
  agents: boolean
  automations: boolean
  cost: boolean
  activity: boolean
  sessions: boolean
  replay: boolean
}

export interface CapabilitiesResponse {
  capabilities: Record<string, SourceCapabilitySet>
  sources: string[]
}

// ============================================================================
// Ingest Status Types
// ============================================================================

export interface OverviewStatus {
  ingest: { status: string; uptime: number; db: string }
  watcher: { status: string; filesWatched: number; lastSyncAt: string | null }
  gateway: { status: string }
}

// ============================================================================
// Automation Summary Types
// ============================================================================

export interface AutomationSummary {
  id?: string
  source?: string
  name: string
  sessionCount: number
  lastActiveAt: string | null
  latestStatus: string
  toolCallCount: number
  schedule?: string
  nextRunAt?: string | null
  model?: string
}

export interface AutomationsResponse {
  automations: AutomationSummary[]
}

// ============================================================================
// Shared Types
// ============================================================================

export type TimeWindow = 'today' | '7d' | '30d' | 'all'
export type PricingStatus = 'priced' | 'partial' | 'unknown'
