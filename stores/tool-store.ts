import { create } from 'zustand'
import type { AgentToolId } from '@/lib/agent-tools/types'

interface ToolState {
  selectedToolId: AgentToolId | null
  setSelectedToolId: (toolId: AgentToolId) => void
  /** Currently selected session ID for right rail detail panel */
  selectedSessionId: string | null
  /** Set the selected session (opens detail in right rail) */
  setSelectedSessionId: (sessionId: string | null) => void
}

export const useToolStore = create<ToolState>((set) => ({
  selectedToolId: null,
  setSelectedToolId: (toolId) => set({ selectedToolId: toolId }),
  selectedSessionId: null,
  setSelectedSessionId: (sessionId) => set({ selectedSessionId: sessionId }),
}))
