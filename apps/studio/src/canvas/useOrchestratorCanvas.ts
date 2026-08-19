import {
  type Connection,
  type Edge,
  type IsValidConnection,
  useReactFlow,
} from '@xyflow/react'
import { type DragEvent, useCallback } from 'react'
import { canConnect } from '../lib/connection.ts'
import {
  createNodeData,
  createNodeId,
  PALETTE_MIME,
  type PaletteItem,
} from '../lib/createNode.ts'
import { type OrchestratorNode, useGraphStore } from '../store/graphStore.ts'

function parsePaletteItem(raw: string): PaletteItem | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'kind' in parsed &&
      (parsed.kind === 'model' ||
        parsed.kind === 'tool' ||
        parsed.kind === 'agentLoop')
    ) {
      return parsed as PaletteItem
    }
    return undefined
  } catch {
    return undefined
  }
}

export function useOrchestratorCanvas() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const onNodesChange = useGraphStore((state) => state.onNodesChange)
  const onEdgesChange = useGraphStore((state) => state.onEdgesChange)
  const onConnect = useGraphStore((state) => state.onConnect)
  const addNode = useGraphStore((state) => state.addNode)
  const { screenToFlowPosition } = useReactFlow()

  const isValidConnection = useCallback<IsValidConnection<Edge>>(
    (connection: Connection | Edge) => canConnect(nodes, edges, connection),
    [edges, nodes],
  )

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const item = parsePaletteItem(event.dataTransfer.getData(PALETTE_MIME))
      if (item === undefined) {
        return
      }
      // The compiler patches a single agent loop, so the canvas holds one.
      if (
        item.kind === 'agentLoop' &&
        useGraphStore.getState().nodes.some((node) => node.type === 'agentLoop')
      ) {
        return
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const node: OrchestratorNode = {
        id: createNodeId(item.kind),
        type: item.kind,
        position,
        data: createNodeData(item),
      } as OrchestratorNode
      addNode(node)
    },
    [addNode, screenToFlowPosition],
  )

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    onDragOver,
    onDrop,
  }
}
