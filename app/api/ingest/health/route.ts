import { NextResponse } from 'next/server'
import { fetchIngest } from '@/lib/agent-tools/server-adapter'

export async function GET() {
  try {
    const result = await fetchIngest<{
      status: string
      ready?: boolean
      version?: string
      sync?: unknown
    }>('/health')
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest service unreachable'
    return NextResponse.json({ status: 'error', error: message }, { status: 502 })
  }
}
