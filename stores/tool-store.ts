import { create } from 'zustand'
import type { AgentToolId } from '@/lib/agent-tools/types'

interface ToolState {
  selectedToolId: AgentToolId | null
  setSelectedToolId: (toolId: AgentToolId) => void
}

export const useToolStore = create<ToolState>((set) => ({
  selectedToolId: null,
  setSelectedToolId: (toolId) => set({ selectedToolId: toolId }),
}))
