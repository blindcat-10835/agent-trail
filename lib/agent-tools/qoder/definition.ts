/**
 * Qoder Agent Tool Definition
 *
 * Session browsing + replay focused with subagent support.
 * No live Gateway, no office/workspace, no approvals UI.
 * Cost is estimated from token usage calibrated against Qoder Credits.
 */

import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'qoder',
  label: 'Qoder',
  shortLabel: 'QODER',
  defaultRoute: '/dashboard',
  capabilities: {
    sessions: true,
    replay: true,
    activity: true,
    office: false,
    workspace: false,
    subagents: true,
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
      name: 'Qoder',
      versionLabel: 'QODER',
      color: 'oklch(0.75 0.20 142)',
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
