import { beforeEach, describe, expect, it } from 'vitest'
import { createNodeData, createNodeId } from '../lib/createNode.ts'
import { toGraphDocument } from '../lib/toGraphDocument.ts'
import { type OrchestratorNode, useGraphStore } from './graphStore.ts'

const KEY = 'mddl.graph.v1'

beforeEach(() => {
  window.localStorage.clear()
  useGraphStore.getState().resetGraph()
})

describe('graphStore', () => {
  it('starts from the starter graph with one agent loop', () => {
    const loops = useGraphStore
      .getState()
      .nodes.filter((node) => node.type === 'agentLoop')
    expect(loops).toHaveLength(1)
  })

  it('persists every change to localStorage', () => {
    useGraphStore.getState().patchNodeData('agent-loop', { persona: 'hello' })
    const stored = window.localStorage.getItem(KEY)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? '{}')).toMatchObject({ version: 1 })
    expect(stored).toContain('hello')
  })

  it('restores the starter graph on reset', () => {
    const [first] = useGraphStore.getState().nodes
    useGraphStore
      .getState()
      .onNodesChange([{ type: 'remove', id: first?.id ?? '' }])
    expect(useGraphStore.getState().nodes.length).toBeLessThan(5)
    useGraphStore.getState().resetGraph()
    expect(useGraphStore.getState().nodes).toHaveLength(5)
  })

  it('refuses a patch that would change a node kind', () => {
    // The compiler switches on kind; letting a tool become a model would
    // produce an op for a row the node never described.
    useGraphStore.getState().patchNodeData('tool-bash', { kind: 'model' })
    const node = useGraphStore
      .getState()
      .nodes.find((item) => item.id === 'tool-bash')
    expect(node?.data.kind).toBe('tool')
  })

  it('adds a node from a palette item', () => {
    const item = {
      kind: 'tool' as const,
      entry: {
        rowId: 'tool-x',
        packageName: '@scope/tool-x',
        label: 'Tool X',
        description: 'x',
      },
    }
    const node = {
      id: createNodeId(item.kind),
      type: item.kind,
      position: { x: 1, y: 2 },
      data: createNodeData(item),
    } as OrchestratorNode
    useGraphStore.getState().addNode(node)
    expect(
      useGraphStore.getState().nodes.some((n) => n.data.rowId === 'tool-x'),
    ).toBe(true)
  })
})

describe('toGraphDocument', () => {
  it('emits a version 1 document the compiler accepts', () => {
    const { nodes, edges } = useGraphStore.getState()
    const doc = toGraphDocument(nodes, edges)
    expect(doc.version).toBe(1)
    expect(doc.nodes).toHaveLength(nodes.length)
    expect(doc.edges).toHaveLength(edges.length)
  })

  it('drops null handles rather than serializing them', () => {
    const doc = toGraphDocument(
      [],
      [{ id: 'e1', source: 'a', target: 'b', sourceHandle: null }],
    )
    expect(doc.edges[0]).not.toHaveProperty('sourceHandle')
  })

  it('keeps every edge end pointing at a node that exists', () => {
    const { nodes, edges } = useGraphStore.getState()
    const doc = toGraphDocument(nodes, edges)
    const ids = new Set(doc.nodes.map((node) => node.id))
    for (const edge of doc.edges) {
      expect(ids.has(edge.source)).toBe(true)
      expect(ids.has(edge.target)).toBe(true)
    }
  })
})
