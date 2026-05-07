/**
 * BFF API Proxy — GET /api/agent-tools/[tool]/sessions/lookup
 *
 * Proxies Gateway session key → ingest session ID lookup.
 * Used by the OpenClaw dashboard to match live Gateway sessions
 * to indexed replay sessions for drilldown linking.
 *
 * Per D-07: BFF proxy — frontend never calls ingest directly.
 * Per D-10: Only OpenClaw supports Gateway-based lookup (no Gateway for Claude/Codex).
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertSourceToolId } from '@/lib/agent-tools/registry'
import { openclawAdapter } from '@/lib/agent-tools/openclaw/server-adapter'
import { sanitizeError } from '@/lib/agent-tools/server-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params

  try {
    const toolId = assertSourceToolId(tool)
    const key = request.nextUrl.searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: 'key parameter is required' },
        { status: 400 },
      )
    }

    // Only OpenClaw supports Gateway-based lookup (per CONTEXT.md)
    if (toolId !== 'openclaw') {
      return NextResponse.json(
        { error: 'Gateway lookup is only available for OpenClaw' },
        { status: 400 },
      )
    }

    const session = await openclawAdapter.lookupSessionByKey(key)
    if (!session) {
      return NextResponse.json(
        { error: 'No matching indexed session found', key },
        { status: 404 },
      )
    }

    return NextResponse.json(session)
  } catch (err) {
    const { error, code } = sanitizeError(err)
    return NextResponse.json({ error }, { status: code })
  }
}
