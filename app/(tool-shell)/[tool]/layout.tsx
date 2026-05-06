import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { assertAgentToolId } from '@/lib/agent-tools/registry'
import { ToolLayoutClient } from './tool-layout-client'

interface ToolLayoutProps {
  children: ReactNode
  params: Promise<{ tool: string }>
}

export async function generateMetadata({ params }: ToolLayoutProps): Promise<Metadata> {
  const { tool } = await params
  try {
    const toolId = assertAgentToolId(tool)
    return { title: `${toolId} — agent-tracing-dashboard` }
  } catch {
    return { title: 'agent-tracing-dashboard' }
  }
}

export default async function ToolLayout({ children, params }: ToolLayoutProps) {
  const { tool } = await params

  // Validate tool param — return 404 for unknown tools
  let toolId: ReturnType<typeof assertAgentToolId>
  try {
    toolId = assertAgentToolId(tool)
  } catch {
    notFound()
  }

  return (
    <ToolLayoutClient toolId={toolId}>
      {children}
    </ToolLayoutClient>
  )
}
