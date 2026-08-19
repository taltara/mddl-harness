import type { AgentLoopNodeData } from '@mddl/graph-schema'
import { type Node, type NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell.tsx'

export type AgentLoopFlowNode = Node<AgentLoopNodeData, 'agentLoop'>

export function AgentLoopNode({
  data,
  selected,
}: NodeProps<AgentLoopFlowNode>) {
  return (
    <NodeShell
      kind="agentLoop"
      selected={selected}
      status={data.status}
      title={data.label}
      subtitle={data.persona.trim() === '' ? 'bundle persona' : 'persona overlay'}
      target
    />
  )
}
