/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/agents/[agentName]/avatar
 *
 * Proxies avatar image requests to the ingest service.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { getIngestBaseUrl } from '@/lib/ingest-url'

const INGEST_BASE = getIngestBaseUrl()
const INGEST_FETCH_TIMEOUT_MS = 5_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string; agentName: string }> },
) {
  const { tool, agentName } = await params

  try {
    assertSourceToolId(tool)

    // Validate agent name (prevent path traversal)
    if (!agentName || !/^[a-zA-Z0-9_-]{1,64}$/.test(agentName)) {
      return NextResponse.json({ error: 'Invalid agent name' }, { status: 400 })
    }

    const url = `${INGEST_BASE}/api/v1/agents/${encodeURIComponent(agentName)}/avatar`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), INGEST_FETCH_TIMEOUT_MS)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Avatar not found' },
        { status: res.status },
      )
    }

    const contentType = res.headers.get('content-type') ?? 'image/png'
    const data = await res.arrayBuffer()

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
