import {
  agentLoopNode,
  modelNodeFromCatalog,
  toolNodeFromCatalog,
} from './fromCatalog.ts'
import type { GraphDocument } from './types.ts'

export const starterGraph: GraphDocument = {
  version: 1,
  nodes: [
    modelNodeFromCatalog('deepseek-v4-flash', 'model-default', {
      x: 80,
      y: 220,
    }),
    toolNodeFromCatalog('tool-bash', 'tool-bash', { x: 80, y: 20 }),
    toolNodeFromCatalog('tool-web', 'tool-web', { x: 80, y: 420 }),
    toolNodeFromCatalog('tool-fs', 'tool-fs', { x: 80, y: 620 }),
    agentLoopNode('agent-loop', { x: 520, y: 260 }),
  ],
  edges: [
    {
      id: 'e-model-agent',
      source: 'model-default',
      target: 'agent-loop',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
    {
      id: 'e-bash-agent',
      source: 'tool-bash',
      target: 'agent-loop',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
    {
      id: 'e-web-agent',
      source: 'tool-web',
      target: 'agent-loop',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
    {
      id: 'e-fs-agent',
      source: 'tool-fs',
      target: 'agent-loop',
      sourceHandle: 'out',
      targetHandle: 'in',
    },
  ],
}
