// Minimal stub — RED phase
export type AgentToolId = 'openclaw'

export interface AgentToolCapabilities {
  liveGateway: boolean
  sessions: boolean
  replay: boolean
  activity: boolean
  office: boolean
  workspace: boolean
  subagents: boolean
  cost: boolean
  approvals: boolean
}

export interface SessionColumnDef {
  id: string
  header: string
  accessor: string
  sortable?: boolean
  width?: string
}

export interface ToolNavItem {
  id: string
  href: (toolId: AgentToolId) => string
  label: string
  title: string
  requiredCapability?: keyof AgentToolCapabilities
}

export interface AgentToolUIProfile {
  brand: {
    name: string
    versionLabel?: string
    accentToken?: string
  }
  sessionColumns: SessionColumnDef[]
}

export interface AgentToolDefinition {
  id: AgentToolId
  label: string
  shortLabel: string
  defaultRoute: string
  capabilities: AgentToolCapabilities
  nav: ToolNavItem[]
  ui: AgentToolUIProfile
}

export interface AgentToolContextValue {
  toolId: AgentToolId
  definition: AgentToolDefinition
  capabilities: AgentToolCapabilities
  href: (route: string) => string
}
