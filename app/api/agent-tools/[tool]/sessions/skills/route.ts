import { NextRequest, NextResponse } from 'next/server'
import { getIngestBaseUrl } from '@/lib/ingest-url'

const INGEST_BASE = getIngestBaseUrl()

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params
  try {
    const searchParams = _request.nextUrl.searchParams
    const skillName = searchParams.get('skillName')
    const qs = searchParams.toString()

    let path: string
    let query: string

    if (skillName) {
      // Route to detail endpoint: skills-stats/:skillName
      searchParams.delete('skillName')
      const remaining = searchParams.toString()
      path = `/api/v1/sessions/skills-stats/${encodeURIComponent(skillName)}`
      query = remaining ? `?source=${tool}&${remaining}` : `?source=${tool}`
    } else {
      // Route to list endpoint: skills-stats
      path = '/api/v1/sessions/skills-stats'
      query = qs ? `?source=${tool}&${qs}` : `?source=${tool}`
    }

    const res = await fetch(`${INGEST_BASE}${path}${query}`)
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
