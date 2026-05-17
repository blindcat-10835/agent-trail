/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/overview/automations
 *
 * Proxies automation summary requests to the ingest service.
 * Source routes are scoped to the URL tool; the synthetic 'all' route returns
 * an aggregate of all automation-capable sources.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAgentToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    const toolId = assertAgentToolId(tool)
    const qs = new URLSearchParams(request.nextUrl.searchParams)

    if (toolId === 'all') {
      qs.delete('source')
    } else {
      qs.set('source', toolId)
    }

    const query = qs.toString()
    const data = await fetchIngest(
      `/api/v1/overview/automations${query ? `?${query}` : ''}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
