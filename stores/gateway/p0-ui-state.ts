// Canonical P0 UI state taxonomy (Wave 2 Contract Freeze)
// All Dashboard P0 pages and selectors use this type exclusively.
// Do not use string literals directly in page components — import this type.
export type P0UIState = "loading" | "success" | "empty" | "unsupported" | "error" | "disconnected" | "stale";

// Special state for agent detail page when agentId is unknown
export type AgentDetailUIState = P0UIState | "invalid-agent";
