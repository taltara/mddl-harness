import { starterGraph } from '@mddl/graph-schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadGraphDocument, saveGraphDocument } from './graphStorage.ts'

const KEY = 'mddl.graph.v1'

beforeEach(() => {
  window.localStorage.clear()
})

describe('loadGraphDocument', () => {
  it('falls back to the starter graph when nothing is stored', () => {
    expect(loadGraphDocument()).toEqual(starterGraph)
  })

  it('falls back when the stored value is not JSON', () => {
    window.localStorage.setItem(KEY, 'not json {')
    expect(loadGraphDocument()).toEqual(starterGraph)
  })

  it('falls back on an unknown schema version', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, nodes: [], edges: [] }),
    )
    expect(loadGraphDocument()).toEqual(starterGraph)
  })

  it('falls back when nodes or edges are missing', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, nodes: [] }))
    expect(loadGraphDocument()).toEqual(starterGraph)
  })
})

describe('saveGraphDocument', () => {
  it('round-trips a graph', () => {
    saveGraphDocument(starterGraph)
    expect(loadGraphDocument()).toEqual(starterGraph)
  })

  it('normalizes run status to idle', () => {
    // Status is live telemetry. Persisting "running" would restore a stale
    // glow on a canvas that is not doing anything.
    const running = {
      ...starterGraph,
      nodes: starterGraph.nodes.map((node) => ({
        ...node,
        data: { ...node.data, status: 'running' as const },
      })),
    }
    saveGraphDocument(running)
    const statuses = new Set(
      loadGraphDocument().nodes.map((node) => node.data.status),
    )
    expect([...statuses]).toEqual(['idle'])
  })

  it('does not throw when storage refuses to write', () => {
    const original = window.localStorage.setItem
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => saveGraphDocument(starterGraph)).not.toThrow()
    window.localStorage.setItem = original
  })
})
