/**
 * Claude Code Agent Tool Definition
 *
 * Session browsing + replay focused. No live Gateway, no office/workspace,
 * no cost tracking. Supports subagent relationships.
 */

import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'claude-code',
  label: 'Claude Code',
  shortLabel: 'CLAUDE',
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
    skills: true,
    toolcalls: true,
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
      id: 'skl',
      href: (toolId) => `/${toolId}/skills`,
      label: 'SKL',
      title: 'Skills',
    },
    {
      id: 'tcl',
      href: (toolId) => `/${toolId}/toolcalls`,
      label: 'TCL',
      title: 'Tool Calls',
    },
  ],
  ui: {
    brand: {
      name: 'Claude',
      versionLabel: 'CLAUDE',
      color: 'oklch(0.80 0.17 75)',
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
