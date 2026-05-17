/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/overview/starred
 *
 * Proxies starred sessions requests to the ingest service.
 * Supports 'all' scope (omits source param) and per-tool (injects source).
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
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
    const qs = request.nextUrl.searchParams.toString()
    const sourceParam = toolId === 'all' ? '' : `source=${toolId}&`
    const data = await fetchIngest(
      `/api/v1/overview/starred?${sourceParam}${qs}`,
      { cache: 'no-store', timeout: INGEST_OVERVIEW_FETCH_TIMEOUT_MS },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
