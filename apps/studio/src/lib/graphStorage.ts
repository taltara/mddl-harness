import { starterGraph, type GraphDocument } from '@mddl/graph-schema'

const STORAGE_KEY = 'mddl.graph.v1'

/**
 * Run status is live telemetry, not document state. Persisting it would
 * restore a stale glow on reload.
 */
function withIdleStatus(graph: GraphDocument): GraphDocument {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      data: { ...node.data, status: 'idle' },
    })),
  }
}

export function loadGraphDocument(): GraphDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return starterGraph
    }
    const parsed = JSON.parse(raw) as GraphDocument
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      return starterGraph
    }
    return parsed
  } catch {
    return starterGraph
  }
}

export function saveGraphDocument(graph: GraphDocument): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(withIdleStatus(graph)),
    )
  } catch {
    // Private mode or a full quota. Losing persistence must not break editing.
  }
}
