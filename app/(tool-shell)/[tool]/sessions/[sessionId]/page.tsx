'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAgentTool, useSessionDetail, useSessionTurns } from '@/lib/agent-tools/client-hooks'
import { TraceThread } from '@/components/replay/trace-thread'
import { Skeleton } from '@/components/ui/skeleton'

export default function SessionReplayPage({
  params,
}: {
  params: Promise<{ tool: string; sessionId: string }>
}) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { toolId, href } = useAgentTool()
  const { session, loading: sessionLoading, error: sessionError } = useSessionDetail(toolId, sessionId)

  const {
    turns,
    pagination,
    loading: turnsLoading,
    error: turnsError,
    isLoadingMore,
    loadMore,
    refetch,
  } = useSessionTurns(
    toolId,
    sessionId,
    { limit: 100 },
  )

  const hasMore = pagination?.hasMore ?? false

  if (!sessionLoading && !sessionError && !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          NOT FOUND
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          Session data is not available. It may have been removed or the ID is invalid.
        </div>
        <button
          onClick={() => router.push(href('/sessions'))}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border hover:bg-accent/10 transition-colors"
        >
          BACK TO SESSIONS
        </button>
      </div>
    )
  }

  if (sessionError || turnsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-[14px] font-bold text-destructive uppercase tracking-wider">
          ERR
        </div>
        <div className="text-[11px] text-muted-foreground max-w-sm text-center leading-relaxed">
          Could not load session turns.
        </div>
        <button
          onClick={refetch}
          className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border border-border hover:bg-accent/10 transition-colors"
        >
          RETRY LOAD
        </button>
      </div>
    )
  }

  if (turnsLoading && turns.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <TraceThread
      session={session}
      turns={turns}
      sessionId={sessionId}
      onBackToSessions={() => router.push(href('/sessions'))}
      hasMore={hasMore}
      loadingMore={isLoadingMore}
      onLoadMore={loadMore}
      totalTurns={pagination?.total ?? session?.totalTurns}
    />
  )
}
