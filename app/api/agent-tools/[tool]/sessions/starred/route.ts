/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/starred
 *
 * Proxies starred session list from the ingest service.
 * Stars are global (not scoped to a specific tool source).
 */

import { NextRequest, NextResponse } from 'next/server'

const INGEST_PORT = process.env.INGEST_PORT || '8078'

export async function GET(_request: NextRequest) {
  try {
    const res = await fetch(`http://localhost:${INGEST_PORT}/api/v1/sessions/starred`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
