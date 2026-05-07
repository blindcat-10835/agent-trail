/**
 * BFF SSE Proxy — GET /api/agent-tools/[tool]/events
 *
 * Proxies Server-Sent Events from the ingest service to the browser.
 * The ingest service emits events when sessions are created, updated,
 * removed, or when sync completes. This route passes them through
 * to the frontend EventSource without buffering or transformation.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 *
 * SSE considerations: Next.js API routes have a default 60-second timeout.
 * SSE connections may run longer. Using Node.js runtime with no maxDuration
 * limit for long-lived SSE connections.
 */

import { NextRequest } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    assertSourceToolId(tool)

    // Proxy SSE stream from ingest
    const ingestUrl = process.env.INGEST_URL || 'http://localhost:8078'

    // Forward sessionId query param if present (for per-session SSE)
    const sessionId = request.nextUrl.searchParams.get('sessionId')
    const ingestEventUrl = sessionId
      ? `${ingestUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/events`
      : `${ingestUrl}/api/v1/events`

    const ingestRes = await fetch(ingestEventUrl, {
      headers: { Accept: 'text/event-stream' },
      cache: 'no-store',
      // Pass through the abort signal so client disconnect propagates to ingest
      signal: request.signal,
    })

    if (!ingestRes.ok || !ingestRes.body) {
      return new Response(JSON.stringify({ error: 'Ingest SSE unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stream the ingest SSE response directly to the client
    return new Response(ingestRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'SSE proxy error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
