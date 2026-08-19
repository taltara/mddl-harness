import type { GraphDocument } from '@mddl/graph-schema'
import type { OrchestratorEdge, OrchestratorNode } from '../store/graphStore.ts'

export function toGraphDocument(
  nodes: OrchestratorNode[],
  edges: OrchestratorEdge[],
): GraphDocument {
  return {
    version: 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle === null || edge.sourceHandle === undefined
        ? {}
        : { sourceHandle: edge.sourceHandle }),
      ...(edge.targetHandle === null || edge.targetHandle === undefined
        ? {}
        : { targetHandle: edge.targetHandle }),
    })),
  }
}
