/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/search
 *
 * Proxies global session-content search requests to the ingest service.
 * Accepts `all` for cross-source search and source tools for source-scoped search.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAgentToolId, assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'
import { parseSessionSearchLimit } from '@/lib/session-search'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    const toolId = assertAgentToolId(tool)
    const q = request.nextUrl.searchParams.get('q')

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 },
      )
    }

    const upstreamParams = new URLSearchParams()
    upstreamParams.set('q', q)

    const limit = request.nextUrl.searchParams.get('limit')
    if (limit !== null) {
      const parsedLimit = parseSessionSearchLimit(limit)
      if (parsedLimit === null) {
        return NextResponse.json(
          { error: 'Invalid limit parameter, must be non-negative integer' },
          { status: 400 },
        )
      }

      upstreamParams.set('limit', String(parsedLimit))
    }

    const includeChildren = request.nextUrl.searchParams.get('includeChildren')
    if (includeChildren !== null) {
      upstreamParams.set('includeChildren', includeChildren)
    }

    if (toolId !== 'all') {
      upstreamParams.set('source', assertSourceToolId(toolId))
    }

    const data = await fetchIngest(
      `/api/v1/sessions/search?${upstreamParams.toString()}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
