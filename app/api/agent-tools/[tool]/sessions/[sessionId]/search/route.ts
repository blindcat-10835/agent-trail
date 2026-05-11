/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/[sessionId]/search
 *
 * Proxies in-session search requests to the ingest service.
 * Validates session ID format and search query before proxying.
 * Accepts 'all' tool since search works across any session regardless of source.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertAgentToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError, validateSessionId } from '@/lib/agent-tools/server-adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string; sessionId: string }> },
) {
  const { tool, sessionId } = await params

  try {
    assertAgentToolId(tool)
    validateSessionId(sessionId)

    const q = request.nextUrl.searchParams.get('q')
    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query (q) is required' },
        { status: 400 },
      )
    }

    const data = await fetchIngest(
      `/api/v1/sessions/${encodeURIComponent(sessionId)}/search?q=${encodeURIComponent(q)}`,
      { cache: 'no-store' },
    )
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
