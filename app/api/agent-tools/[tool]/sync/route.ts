/**
 * BFF API Proxy — POST /api/agent-tools/[tool]/sync
 *
 * Per-source sync trigger. Validates [tool] and proxies to the ingest
 * source sync endpoint. Accepts optional force parameter to bypass
 * file-hash caching for post-parser-fix reindex verification.
 *
 * Rejects 'all' and any invalid tool ID with 400 — only concrete ingest
 * sources can be synced individually.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 * Per D-08: Unified per-tool routing — shared handler across all 3 tools.
 */

import { NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'

interface IngestSyncResult {
  type: string
  syncResult: {
    sessionsInserted: number
    sessionsUpdated: number
    messagesInserted: number
    toolCallsInserted?: number
    toolResultEventsInserted?: number
    errors: string[]
  }
  status: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    // Validate at trust boundary — 'all' and unknown tools are rejected (T-04-03)
    const toolId = assertSourceToolId(tool)

    // Accept force from query param or request body
    const url = new URL(request.url)
    const queryForce = url.searchParams.get('force')
    let bodyForce = false
    try {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>
      bodyForce = body?.force === true || body?.force === 'true'
    } catch {
      // Body may be absent — ignore parse errors
    }
    const force = queryForce === 'true' || bodyForce

    const result = await fetchIngest<IngestSyncResult>(
      `/api/v1/sources/${toolId}/sync`,
      {
        method: 'POST',
        body: force ? { force: true } : undefined,
      },
    )

    return NextResponse.json({ ...result, force })
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
