import {
  type AgentLoopNodeData,
  type GraphDocument,
  type ModelNodeData,
  type OrchestratorNodeData,
  starterGraph,
  type ToolNodeData,
} from '@mddl/graph-schema'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import { loadGraphDocument, saveGraphDocument } from '../lib/graphStorage.ts'
import { toGraphDocument } from '../lib/toGraphDocument.ts'

export type ModelFlowNode = Node<ModelNodeData, 'model'>
export type ToolFlowNode = Node<ToolNodeData, 'tool'>
export type AgentLoopFlowNode = Node<AgentLoopNodeData, 'agentLoop'>
export type OrchestratorNode = ModelFlowNode | ToolFlowNode | AgentLoopFlowNode
export type OrchestratorEdge = Edge

function toFlowNodes(graph: GraphDocument): OrchestratorNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: node.data,
  })) as OrchestratorNode[]
}

function toFlowEdges(graph: GraphDocument): OrchestratorEdge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }))
}

interface GraphState {
  nodes: OrchestratorNode[]
  edges: OrchestratorEdge[]
  onNodesChange: (changes: NodeChange<OrchestratorNode>[]) => void
  onEdgesChange: (changes: EdgeChange<OrchestratorEdge>[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: OrchestratorNode) => void
  patchNodeData: (id: string, patch: Partial<OrchestratorNodeData>) => void
  resetGraph: () => void
}

const initialGraph = loadGraphDocument()

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: toFlowNodes(initialGraph),
  edges: toFlowEdges(initialGraph),
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as OrchestratorNode[],
    })
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${crypto.randomUUID().slice(0, 6)}`,
        },
        get().edges,
      ),
    })
  },
  addNode: (node) => {
    set({ nodes: [...get().nodes, node] })
  },
  patchNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== id) {
          return node
        }
        if (patch.kind !== undefined && patch.kind !== node.data.kind) {
          return node
        }
        return {
          ...node,
          data: { ...node.data, ...patch },
        } as OrchestratorNode
      }),
    })
  },
  resetGraph: () => {
    set({
      nodes: toFlowNodes(starterGraph),
      edges: toFlowEdges(starterGraph),
    })
  },
}))

useGraphStore.subscribe((state) => {
  saveGraphDocument(toGraphDocument(state.nodes, state.edges))
})
