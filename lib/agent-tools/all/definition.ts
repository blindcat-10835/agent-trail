/**
 * All Sources synthetic tool definition.
 *
 * This is not an ingest source. It is a shell-scoped aggregate view that
 * merges source-backed sessions from OpenClaw, Claude Code, and Codex.
 */

import type { AgentToolDefinition } from '../types'

const definition: AgentToolDefinition = {
  id: 'all',
  label: 'All Sources',
  shortLabel: 'ALL',
  defaultRoute: '/dashboard',
  capabilities: {
    sessions: true,
    replay: true,
    activity: false,
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
  ],
  ui: {
    brand: {
      name: 'All Sources',
      versionLabel: 'AGGREGATE',
    },
    sessionColumns: [
      { id: 'label', header: 'SESSION', accessor: 'label', sortable: true, width: 'minmax(180px,2fr)' },
      { id: 'status', header: 'STATUS', accessor: 'status', width: '80px' },
      { id: 'project', header: 'PROJECT', accessor: 'project', sortable: true, width: 'minmax(120px,1fr)' },
      { id: 'model', header: 'MODEL', accessor: 'model', sortable: true, width: 'minmax(120px,1fr)' },
      { id: 'updatedAt', header: 'UPDATED', accessor: 'updatedAt', sortable: true, width: '80px' },
    ],
  },
}

export default definition
