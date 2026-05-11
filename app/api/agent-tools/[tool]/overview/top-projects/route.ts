/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/overview/top-projects
 *
 * Proxies top project ranking requests to the ingest service.
 * Supports 'all' scope (omits source param) and per-tool (injects source).
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
    const qs = request.nextUrl.searchParams.toString()
    const sourceParam = toolId === 'all' ? '' : `source=${toolId}&`
    const data = await fetchIngest(
      `/api/v1/overview/top-projects?${sourceParam}${qs}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
