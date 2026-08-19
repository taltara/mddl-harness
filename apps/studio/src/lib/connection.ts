import type { OrchestratorEdge, OrchestratorNode } from '../store/graphStore.ts'

/** The pair a connection would join. Handles are irrelevant to the rules. */
export interface ConnectionEnds {
  source?: string | null
  target?: string | null
}

/**
 * Whether a connection can exist, given the graph the compiler expects.
 *
 * Everything flows into one agent loop, a loop never feeds another node, an
 * edge is never drawn twice, and a loop takes at most one model — the overlay
 * patches a single `agent-default-model` row, so a second model would be a
 * silent overwrite. Refusing the edge while dragging is how the canvas keeps
 * a graph from compiling into something the harness cannot resolve.
 */
export function canConnect(
  nodes: OrchestratorNode[],
  edges: OrchestratorEdge[],
  connection: ConnectionEnds,
): boolean {
  const source = nodes.find((node) => node.id === connection.source)
  const target = nodes.find((node) => node.id === connection.target)
  if (source === undefined || target === undefined) {
    return false
  }
  if (target.type !== 'agentLoop' || source.type === 'agentLoop') {
    return false
  }
  const duplicate = edges.some(
    (edge) => edge.source === source.id && edge.target === target.id,
  )
  if (duplicate) {
    return false
  }
  if (source.type === 'model') {
    const modelAlreadyWired = edges.some((edge) => {
      if (edge.target !== target.id) {
        return false
      }
      const other = nodes.find((node) => node.id === edge.source)
      return other?.type === 'model'
    })
    return !modelAlreadyWired
  }
  return true
}
