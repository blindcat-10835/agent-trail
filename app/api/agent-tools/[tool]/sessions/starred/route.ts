/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/starred
 *
 * Proxies starred session list from the ingest service.
 * Stars are global (not scoped to a specific tool source).
 */

import { NextResponse } from 'next/server'
import { getIngestBaseUrl } from '@/lib/ingest-url'

const INGEST_BASE = getIngestBaseUrl()

export async function GET() {
  try {
    const res = await fetch(`${INGEST_BASE}/api/v1/sessions/starred`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
