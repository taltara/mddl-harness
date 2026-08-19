import type { ModelNodeData } from '@mddl/graph-schema'
import { type Node, type NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell.tsx'

export type ModelFlowNode = Node<ModelNodeData, 'model'>

export function ModelNode({ data, selected }: NodeProps<ModelFlowNode>) {
  return (
    <NodeShell
      kind="model"
      selected={selected}
      status={data.status}
      title={data.label}
      subtitle={data.model}
      source
    />
  )
}
