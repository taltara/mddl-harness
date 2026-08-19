import { describe, expect, it } from 'vitest'
import { isCatalogToolRowId, MODEL_CATALOG, TOOL_CATALOG } from './catalog.ts'
import {
  agentLoopNode,
  modelNodeFromCatalog,
  toolNodeFromCatalog,
} from './fromCatalog.ts'
import { starterGraph } from './starterGraph.ts'

describe('starterGraph', () => {
  it('is a version 1 document', () => {
    expect(starterGraph.version).toBe(1)
  })

  it('has exactly one agent loop', () => {
    const loops = starterGraph.nodes.filter(
      (node) => node.data.kind === 'agentLoop',
    )
    expect(loops).toHaveLength(1)
  })

  it('gives every node a unique id', () => {
    const ids = starterGraph.nodes.map((node) => node.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('points every edge at nodes that exist', () => {
    const ids = new Set(starterGraph.nodes.map((node) => node.id))
    for (const edge of starterGraph.edges) {
      expect(ids.has(edge.source)).toBe(true)
      expect(ids.has(edge.target)).toBe(true)
    }
  })

  it('wires everything into the agent loop and nothing out of it', () => {
    const loop = starterGraph.nodes.find(
      (node) => node.data.kind === 'agentLoop',
    )
    expect(loop).toBeDefined()
    for (const edge of starterGraph.edges) {
      expect(edge.target).toBe(loop?.id)
      expect(edge.source).not.toBe(loop?.id)
    }
  })

  it('wires at most one model, since the overlay patches a single row', () => {
    const modelIds = new Set(
      starterGraph.nodes
        .filter((node) => node.data.kind === 'model')
        .map((node) => node.id),
    )
    const wiredModels = starterGraph.edges.filter((edge) =>
      modelIds.has(edge.source),
    )
    expect(wiredModels.length).toBeLessThanOrEqual(1)
  })

  it('only uses tools that are in the catalog', () => {
    for (const node of starterGraph.nodes) {
      if (node.data.kind === 'tool') {
        expect(isCatalogToolRowId(node.data.rowId)).toBe(true)
      }
    }
  })
})

describe('catalog factories', () => {
  it('builds every catalog tool', () => {
    for (const entry of TOOL_CATALOG) {
      const node = toolNodeFromCatalog(entry.rowId, entry.rowId, { x: 0, y: 0 })
      expect(node.data.kind).toBe('tool')
      expect(node.data.rowId).toBe(entry.rowId)
    }
  })

  it('builds every catalog model', () => {
    for (const entry of MODEL_CATALOG) {
      const node = modelNodeFromCatalog(entry.model, entry.model, {
        x: 0,
        y: 0,
      })
      expect(node.data.kind).toBe('model')
      expect(node.data.model).toBe(entry.model)
    }
  })

  it('refuses an unknown tool rather than emitting a bad row', () => {
    expect(() => toolNodeFromCatalog('nope', 'nope', { x: 0, y: 0 })).toThrow(
      /Unknown catalog tool/,
    )
  })

  it('refuses an unknown model', () => {
    expect(() => modelNodeFromCatalog('nope', 'nope', { x: 0, y: 0 })).toThrow(
      /Unknown catalog model/,
    )
  })

  it('builds an agent loop that starts with no persona', () => {
    const node = agentLoopNode('loop', { x: 0, y: 0 })
    expect(node.data.kind).toBe('agentLoop')
    if (node.data.kind === 'agentLoop') {
      expect(node.data.persona).toBe('')
    }
  })
})
