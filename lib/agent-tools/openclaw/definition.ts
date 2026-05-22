/**
 * OpenClaw Agent Tool Definition
 *
 * Full-featured tool with live Gateway WebSocket, office/workspace views,
 * cost tracking, and the widest set of nav items.
 */

import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'openclaw',
  label: 'OpenClaw',
  shortLabel: 'OPENCLAW',
  defaultRoute: '/dashboard',
  capabilities: {
    sessions: true,
    replay: true,
    activity: true,
    office: true,
    workspace: true,
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
  ],
  ui: {
    brand: {
      name: 'OpenClaw',
      versionLabel: 'v3.2.1',
      color: 'oklch(0.78 0.15 35)',
    },
    sessionColumns: [
      { id: 'label', header: 'SESSION', accessor: 'label', sortable: true },
      { id: 'status', header: 'STATUS', accessor: 'status' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true },
    ],
  },
}

export default definition
