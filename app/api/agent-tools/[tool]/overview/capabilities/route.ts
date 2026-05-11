/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/overview/capabilities
 *
 * Proxies source capability metadata from the ingest service.
 * Global endpoint — no source param needed (returns all source capabilities).
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
    // Validate tool param even though capabilities is global
    assertAgentToolId(tool)
    const data = await fetchIngest('/api/v1/overview/capabilities', {
      cache: 'no-store',
    })
    return NextResponse.json(data)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
