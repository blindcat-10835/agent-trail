/**
 * Qoder Agent Tool Definition
 *
 * Session browsing + replay focused with subagent support.
 * No live Gateway, no office/workspace, no cost tracking, no approvals UI.
 * Cost is intentionally excluded — Qoder records only product-tier model keys
 * (ultimate / experts-ultimate) without verifiable underlying provider billing.
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
    cost: false,
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
      name: 'Qoder',
      versionLabel: 'QODER',
      color: 'oklch(0.75 0.20 142)',
    },
    sessionColumns: [
      { id: 'label', header: 'SESSION', accessor: 'label', sortable: true },
      { id: 'status', header: 'STATUS', accessor: 'status' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true },
      { id: 'project', header: 'PROJECT', accessor: 'project' },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true },
    ],
  },
}

export default definition
