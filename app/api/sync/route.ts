import { NextResponse } from 'next/server'
import { fetchIngest, sanitizeError } from '@/lib/agent-tools/server-adapter'

const SOURCE_TYPES = ['openclaw', 'claude-code', 'codex'] as const

export async function POST() {
  const results = []

  for (const type of SOURCE_TYPES) {
    try {
      const result = await fetchIngest<{
        type: string
        syncResult: { sessionsInserted: number; sessionsUpdated: number }
        status: string
      }>(`/api/v1/sources/${type}/sync`, { method: 'POST' })
      results.push(result)
    } catch (err) {
      const { error } = sanitizeError(err)
      results.push({ type, error, status: 'failed' })
    }
  }

  return NextResponse.json({ results })
}
