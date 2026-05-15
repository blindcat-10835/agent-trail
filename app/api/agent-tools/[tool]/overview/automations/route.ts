/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/overview/automations
 *
 * Proxies automation summary requests to the ingest service.
 * Source-scoped only — uses assertSourceToolId (rejects 'all').
 * Returns empty array for 'all' scope (automations are source-specific).
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    // Automations are source-specific; 'all' has no aggregate
    if (tool === 'all') {
      return NextResponse.json({ automations: [] })
    }

    const toolId = assertSourceToolId(tool)
    const qs = request.nextUrl.searchParams.toString()
    const data = await fetchIngest(
      `/api/v1/overview/automations?source=${toolId}&${qs}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
