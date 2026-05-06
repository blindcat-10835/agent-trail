/**
 * Codex Agent Tool Definition
 *
 * Session browsing + replay focused. Same capability set as Claude Code —
 * no live Gateway, no office/workspace, no cost tracking, no approvals UI.
 */

import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'codex',
  label: 'Codex',
  shortLabel: 'CODEX',
  defaultRoute: '/dashboard',
  capabilities: {
    liveGateway: false,
    sessions: true,
    replay: true,
    activity: true,
    office: false,
    workspace: false,
    subagents: false,
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
      name: 'Codex',
      versionLabel: 'CODEX',
    },
    sessionColumns: [
      { id: 'label', header: 'LABEL', accessor: 'label', sortable: true },
      { id: 'status', header: 'STATUS', accessor: 'status' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true },
      { id: 'project', header: 'PROJECT', accessor: 'project' },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true },
    ],
  },
}

export default definition
