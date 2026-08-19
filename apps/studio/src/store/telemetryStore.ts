import type { NodeRunStatus } from '@mddl/graph-schema'
import { create } from 'zustand'
import { useGraphStore } from './graphStore.ts'

let previewTimers: number[] = []

function clearPreviewTimers(): void {
  for (const timer of previewTimers) {
    window.clearTimeout(timer)
  }
  previewTimers = []
}

function setStatus(id: string, status: NodeRunStatus): void {
  useGraphStore.getState().patchNodeData(id, { status })
}

interface TelemetryState {
  previewing: boolean
  activeEdgeIds: string[]
  startPreview: () => void
  stopPreview: () => void
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  previewing: false,
  activeEdgeIds: [],
  stopPreview: () => {
    clearPreviewTimers()
    for (const node of useGraphStore.getState().nodes) {
      setStatus(node.id, 'idle')
    }
    set({ previewing: false, activeEdgeIds: [] })
  },
  startPreview: () => {
    get().stopPreview()
    const { nodes, edges } = useGraphStore.getState()
    const agent = nodes.find((node) => node.type === 'agentLoop')
    if (agent === undefined) {
      return
    }
    const incoming = edges.filter((edge) => edge.target === agent.id)
    set({
      previewing: true,
      activeEdgeIds: incoming.map((edge) => edge.id),
    })
    setStatus(agent.id, 'running')

    incoming.forEach((edge, index) => {
      const timer = window.setTimeout(
        () => {
          const source = useGraphStore
            .getState()
            .nodes.find((node) => node.id === edge.source)
          if (source !== undefined) {
            setStatus(source.id, 'active')
          }
        },
        350 * (index + 1),
      )
      previewTimers.push(timer)
    })

    const doneTimer = window.setTimeout(
      () => {
        for (const node of useGraphStore.getState().nodes) {
          setStatus(node.id, 'done')
        }
        set({ previewing: false })
      },
      350 * incoming.length + 900,
    )
    previewTimers.push(doneTimer)
  },
}))
