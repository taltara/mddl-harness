export const NODE_KINDS = ['model', 'tool', 'agentLoop'] as const

export type NodeKind = (typeof NODE_KINDS)[number]

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  model: 'Model',
  tool: 'Tool',
  agentLoop: 'Agent loop',
}

export const NODE_RUN_STATUSES = [
  'idle',
  'running',
  'active',
  'done',
  'error',
] as const

export type NodeRunStatus = (typeof NODE_RUN_STATUSES)[number]

export type ModelNodeData = {
  kind: 'model'
  label: string
  rowId: string
  adapterPackage: string
  provider: string
  model: string
  status: NodeRunStatus
} & Record<string, unknown>

export type ToolNodeData = {
  kind: 'tool'
  label: string
  rowId: string
  packageName: string
  enabled: boolean
  status: NodeRunStatus
} & Record<string, unknown>

export type AgentLoopNodeData = {
  kind: 'agentLoop'
  label: string
  rowId: 'agent-loop'
  systemPromptRowId: 'system-prompt'
  persona: string
  status: NodeRunStatus
} & Record<string, unknown>

export type OrchestratorNodeData =
  | ModelNodeData
  | ToolNodeData
  | AgentLoopNodeData

export type GraphPosition = {
  x: number
  y: number
}

export type GraphNode = {
  id: string
  type: NodeKind
  position: GraphPosition
  data: OrchestratorNodeData
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export type GraphDocument = {
  version: 1
  nodes: GraphNode[]
  edges: GraphEdge[]
}
