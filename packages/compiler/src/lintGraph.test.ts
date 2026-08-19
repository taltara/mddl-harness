import { starterGraph, type GraphDocument } from '@mddl/graph-schema'
import { describe, expect, it } from 'vitest'
import { lintGraph } from './lintGraph.ts'

function codes(graph: GraphDocument): string[] {
  return lintGraph(graph).map((warning) => warning.code)
}

function withoutAgentLoop(): GraphDocument {
  return {
    ...starterGraph,
    nodes: starterGraph.nodes.filter((node) => node.data.kind !== 'agentLoop'),
    edges: [],
  }
}

describe('lintGraph', () => {
  it('passes the starter graph', () => {
    expect(lintGraph(starterGraph)).toEqual([])
  })

  it('flags a duplicate patched row id', () => {
    // Drag Bash twice more and wire neither: each unwired copy emits its own
    // disable row for tool-bash, so one id carries two rows.
    const copy = (id: string) => ({
      id,
      type: 'tool' as const,
      position: { x: 80, y: 900 },
      data: {
        kind: 'tool' as const,
        label: 'Bash',
        rowId: 'tool-bash',
        packageName: '@deepseek-ai/dsh-tool-bash',
        enabled: true,
        status: 'idle' as const,
      },
    })
    const duplicated: GraphDocument = {
      ...starterGraph,
      nodes: [...starterGraph.nodes, copy('bash-2'), copy('bash-3')],
    }
    expect(codes(duplicated)).toContain('duplicate-row-id')
  })

  it('warns when no agent loop anchors the graph', () => {
    expect(codes(withoutAgentLoop())).toContain('no-agent-loop')
  })

  it('warns when every tool is disabled', () => {
    const allOff: GraphDocument = {
      ...starterGraph,
      nodes: starterGraph.nodes.map((node) =>
        node.data.kind === 'tool'
          ? { ...node, data: { ...node.data, enabled: false } }
          : node,
      ),
    }
    expect(codes(allOff)).toContain('all-tools-disabled')
  })
})
