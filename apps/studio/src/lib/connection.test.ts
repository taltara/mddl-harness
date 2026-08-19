import { describe, expect, it } from 'vitest'
import type { OrchestratorEdge, OrchestratorNode } from '../store/graphStore.ts'
import { canConnect } from './connection.ts'

function node(id: string, type: OrchestratorNode['type']): OrchestratorNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { kind: type, label: id, rowId: id, status: 'idle' },
  } as OrchestratorNode
}

function edge(source: string, target: string): OrchestratorEdge {
  return { id: `e-${source}-${target}`, source, target }
}

const NODES = [
  node('model-a', 'model'),
  node('model-b', 'model'),
  node('tool-a', 'tool'),
  node('tool-b', 'tool'),
  node('loop', 'agentLoop'),
]

describe('canConnect', () => {
  it('allows a tool into the agent loop', () => {
    expect(canConnect(NODES, [], { source: 'tool-a', target: 'loop' })).toBe(
      true,
    )
  })

  it('allows a model into the agent loop', () => {
    expect(canConnect(NODES, [], { source: 'model-a', target: 'loop' })).toBe(
      true,
    )
  })

  it('refuses a connection whose target is not an agent loop', () => {
    expect(canConnect(NODES, [], { source: 'tool-a', target: 'tool-b' })).toBe(
      false,
    )
  })

  it('refuses the agent loop as a source', () => {
    expect(canConnect(NODES, [], { source: 'loop', target: 'loop' })).toBe(
      false,
    )
  })

  it('refuses an edge that already exists', () => {
    const edges = [edge('tool-a', 'loop')]
    expect(canConnect(NODES, edges, { source: 'tool-a', target: 'loop' })).toBe(
      false,
    )
  })

  it('refuses a second model, which would silently overwrite the first', () => {
    const edges = [edge('model-a', 'loop')]
    expect(canConnect(NODES, edges, { source: 'model-b', target: 'loop' })).toBe(
      false,
    )
  })

  it('still allows tools once a model is wired', () => {
    const edges = [edge('model-a', 'loop')]
    expect(canConnect(NODES, edges, { source: 'tool-a', target: 'loop' })).toBe(
      true,
    )
  })

  it('allows several tools on one loop', () => {
    const edges = [edge('tool-a', 'loop')]
    expect(canConnect(NODES, edges, { source: 'tool-b', target: 'loop' })).toBe(
      true,
    )
  })

  it('refuses ends that are not on the canvas', () => {
    expect(canConnect(NODES, [], { source: 'ghost', target: 'loop' })).toBe(
      false,
    )
    expect(canConnect(NODES, [], { source: 'tool-a', target: null })).toBe(
      false,
    )
  })
})
