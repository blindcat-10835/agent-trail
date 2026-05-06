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
    liveGateway: true,
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
      id: 'agt',
      href: (toolId) => `/${toolId}/dashboard?tab=agents`,
      label: 'AGT',
      title: 'Agents',
    },
    {
      id: 'usd',
      href: (toolId) => `/${toolId}/dashboard?tab=costs`,
      label: 'USD',
      title: 'Costs & Usage',
    },
    {
      id: 'skl',
      href: (toolId) => `/${toolId}/dashboard?tab=skills`,
      label: 'SKL',
      title: 'Skills',
    },
    {
      id: 'act',
      href: (toolId) => `/${toolId}/activity`,
      label: 'ACT',
      title: 'Activity',
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
      versionLabel: 'GATEWAY · v3.2.1',
    },
    sessionColumns: [
      { id: 'label', header: 'LABEL', accessor: 'label', sortable: true },
      { id: 'status', header: 'STATUS', accessor: 'status' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true },
    ],
  },
}

export default definition
