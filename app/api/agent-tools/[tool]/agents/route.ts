/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/agents
 *
 * Proxies agent list requests to the ingest service.
 * Automatically injects source filter based on the [tool] URL segment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAgentToolId, assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    if (assertAgentToolId(tool) === 'all') {
      return NextResponse.json({ agents: [] })
    }

    const toolId = assertSourceToolId(tool)
    const data = await fetchIngest<{ agents: unknown[] }>(
      `/api/v1/agents?source=${toolId}`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
