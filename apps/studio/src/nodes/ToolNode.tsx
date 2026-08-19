import { isCatalogToolRowId, type ToolNodeData } from '@mddl/graph-schema'
import type { Node, NodeProps } from '@xyflow/react'
import { NodeShell } from './NodeShell.tsx'

export type ToolFlowNode = Node<ToolNodeData, 'tool'>

function toolSubtitle(data: ToolNodeData): string {
  if (!data.enabled) {
    return `${data.rowId} · disabled`
  }
  if (isCatalogToolRowId(data.rowId)) {
    return `${data.rowId} · dsh-base`
  }
  return `${data.rowId} · insert`
}

export function ToolNode({ data, selected }: NodeProps<ToolFlowNode>) {
  return (
    <NodeShell
      kind="tool"
      selected={selected}
      status={data.status}
      title={data.label}
      subtitle={toolSubtitle(data)}
      source
    />
  )
}
