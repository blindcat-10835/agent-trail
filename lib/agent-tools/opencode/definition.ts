import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'opencode',
  label: 'OpenCode',
  shortLabel: 'OPENCODE',
  defaultRoute: '/dashboard',
  capabilities: {
    sessions: true,
    replay: true,
    activity: true,
    office: false,
    workspace: false,
    subagents: false,
    cost: true,
    approvals: false,
  },
  nav: [
    {
      id: 'ovr',
      href: (toolId) => `/${toolId}/dashboard`,
      label: 'OVR',
      title: 'Overview',
    },
    {
      id: 'ses',
      href: (toolId) => `/${toolId}/sessions`,
      label: 'SES',
      title: 'Sessions',
    },
    {
      id: 'act',
      href: (toolId) => `/${toolId}/activity`,
      label: 'ACT',
      title: 'Activity',
    },
  ],
  ui: {
    brand: {
      name: 'OpenCode',
      versionLabel: 'OPENCODE',
    },
    sessionColumns: [
      { id: 'label', header: 'SESSION', accessor: 'label', sortable: true },
      { id: 'status', header: 'STATUS', accessor: 'status' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true },
      { id: 'cost', header: 'COST', accessor: 'estimatedCost', sortable: true },
      { id: 'project', header: 'PROJECT', accessor: 'project' },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true },
    ],
  },
}

export default definition
