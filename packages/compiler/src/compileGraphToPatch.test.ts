import { starterGraph, type GraphDocument } from '@mddl/graph-schema'
import { describe, expect, it } from 'vitest'
import { compileGraphToPatch } from './compileGraphToPatch.ts'
import { isInsertOp } from './types.ts'

function withUnwiredTool(): GraphDocument {
  return {
    ...starterGraph,
    edges: starterGraph.edges.filter((edge) => edge.source !== 'tool-web'),
  }
}

function withCustomTool(): GraphDocument {
  return {
    version: 1,
    nodes: [
      ...starterGraph.nodes,
      {
        id: 'tool-custom',
        type: 'tool',
        position: { x: 80, y: 820 },
        data: {
          kind: 'tool',
          label: 'custom',
          rowId: 'mddl-custom-tool',
          packageName: '@mddl/dsh-tool-custom',
          enabled: true,
          status: 'idle',
        },
      },
    ],
    edges: [
      ...starterGraph.edges,
      {
        id: 'e-custom-agent',
        source: 'tool-custom',
        target: 'agent-loop',
        sourceHandle: 'out',
        targetHandle: 'in',
      },
    ],
  }
}

function withPersona(): GraphDocument {
  return {
    ...starterGraph,
    nodes: starterGraph.nodes.map((node) => {
      if (node.data.kind !== 'agentLoop') {
        return node
      }
      return {
        ...node,
        data: {
          ...node.data,
          persona: 'You are a visual orchestrator.',
        },
      }
    }),
  }
}

describe('compileGraphToPatch', () => {
  it('emits the wired model default and nothing for catalog tools', () => {
    const ops = compileGraphToPatch(starterGraph)
    expect(ops).toEqual([
      {
        id: 'agent-default-model',
        config: {
          provider: 'deepseek-official',
          model: 'deepseek-v4-flash',
        },
      },
    ])
  })

  it('disables catalog tools that are not wired into the agent loop', () => {
    const ops = compileGraphToPatch(withUnwiredTool())
    expect(ops).toContainEqual({ id: 'tool-web', disabled: true })
  })

  it('inserts out-of-catalog tools that are wired and enabled', () => {
    const ops = compileGraphToPatch(withCustomTool())
    const insert = ops.find(isInsertOp)
    expect(insert).toEqual({
      insert: [
        {
          id: 'mddl-custom-tool',
          name: '@mddl/dsh-tool-custom',
        },
      ],
    })
  })

  it('emits nothing for an out-of-catalog tool that is not wired', () => {
    const graph = withCustomTool()
    const ops = compileGraphToPatch({
      ...graph,
      edges: graph.edges.filter((edge) => edge.source !== 'tool-custom'),
    })
    expect(ops.find(isInsertOp)).toBeUndefined()
    expect(ops).not.toContainEqual({ id: 'mddl-custom-tool', disabled: true })
  })

  it('patches system-prompt when the agent loop has a persona', () => {
    const ops = compileGraphToPatch(withPersona())
    expect(ops).toContainEqual({
      id: 'system-prompt',
      config: { persona: 'You are a visual orchestrator.' },
    })
  })
})
