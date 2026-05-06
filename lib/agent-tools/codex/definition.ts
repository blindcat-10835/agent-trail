// Minimal stub — RED phase
import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'codex',
  label: 'TODO',
  shortLabel: 'TODO',
  defaultRoute: '',
  capabilities: {
    liveGateway: false,
    sessions: false,
    replay: false,
    activity: false,
    office: false,
    workspace: false,
    subagents: false,
    cost: false,
    approvals: false,
  },
  nav: [],
  ui: {
    brand: { name: 'TODO' },
    sessionColumns: [],
  },
}

export default definition
