/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/qoder-usage
 *
 * Proxies Qoder estimated usage rows to ingest. This endpoint is intentionally
 * Qoder-only because other sources do not have Qoder Credits semantics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAgentToolId } from '@/lib/agent-tools/registry'
import {
  INGEST_OVERVIEW_FETCH_TIMEOUT_MS,
  fetchIngest,
  sanitizeError,
} from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    const toolId = assertAgentToolId(tool)
    if (toolId !== 'qoder') {
      return NextResponse.json({ error: 'Qoder usage is only available for qoder' }, { status: 404 })
    }

    const qs = request.nextUrl.searchParams.toString()
    const data = await fetchIngest(
      `/api/v1/qoder/usage${qs ? `?${qs}` : ''}`,
      { cache: 'no-store', timeout: INGEST_OVERVIEW_FETCH_TIMEOUT_MS },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
