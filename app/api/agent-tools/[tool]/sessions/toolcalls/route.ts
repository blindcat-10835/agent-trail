import { NextRequest, NextResponse } from 'next/server'
import { getIngestBaseUrl } from '@/lib/ingest-url'

const INGEST_BASE = getIngestBaseUrl()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params
  try {
    const qs = _request.nextUrl.searchParams.toString()
    const query = qs ? `?source=${tool}&${qs}` : `?source=${tool}`
    const res = await fetch(`${INGEST_BASE}/api/v1/sessions/toolcall-stats${query}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
