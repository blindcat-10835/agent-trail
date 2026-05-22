/**
 * BFF API Proxy — POST/DELETE /api/agent-tools/[tool]/sessions/[sessionId]/star
 *
 * Proxies star/unstar requests to the ingest service.
 * Stars are global (not scoped to a specific tool source).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getIngestBaseUrl } from '@/lib/ingest-url'

const INGEST_BASE = getIngestBaseUrl()

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  try {
    const res = await fetch(
      `${INGEST_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/star`,
      { method: 'POST' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params
  try {
    const res = await fetch(
      `${INGEST_BASE}/api/v1/sessions/${encodeURIComponent(sessionId)}/star`,
      { method: 'DELETE' },
    )
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
