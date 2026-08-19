import type { NodeTypes } from '@xyflow/react'
import { AgentLoopNode } from './AgentLoopNode.tsx'
import { ModelNode } from './ModelNode.tsx'
import { ToolNode } from './ToolNode.tsx'

export const nodeTypes = {
  model: ModelNode,
  tool: ToolNode,
  agentLoop: AgentLoopNode,
} satisfies NodeTypes
