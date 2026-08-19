import { compileGraphToPatch } from '@mddl/compiler'
import { describe, expect, it } from 'vitest'
import { graphFromLive } from './graphFromLive.ts'
import type { LiveEntry } from './live.ts'

function entry(over: Partial<LiveEntry> & { id: string }): LiveEntry {
  return {
    name: 'pkg',
    phase: 'active',
    disabled: false,
    group: false,
    inject: [],
    config: null,
    redacted: [],
    omitted: [],
    ...over,
  }
}

const LIVE: LiveEntry[] = [
  entry({
    id: 'agent-default-model',
    config: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
  }),
  entry({ id: 'tool-bash' }),
  entry({ id: 'tool-web', disabled: true, phase: 'disabled' }),
  entry({ id: 'storage-json' }),
  entry({ id: 'webserver' }),
]

describe('graphFromLive', () => {
  it('imports the catalog rows and always adds an agent loop', () => {
    const { graph } = graphFromLive(LIVE)
    const kinds = graph.nodes.map((node) => node.data.kind).sort()
    expect(kinds).toEqual(['agentLoop', 'model', 'tool', 'tool'])
  })

  it('keeps the model the harness actually runs', () => {
    const { graph } = graphFromLive(LIVE)
    const model = graph.nodes.find((node) => node.data.kind === 'model')
    expect(model?.data.model).toBe('deepseek-v4-pro')
  })

  it('carries a disabled row across as an off tool', () => {
    const { graph } = graphFromLive(LIVE)
    const web = graph.nodes.find((node) => node.data.rowId === 'tool-web')
    expect(web?.data.enabled).toBe(false)
  })

  it('does not wire an off tool, so the canvas shows it as off', () => {
    const { graph } = graphFromLive(LIVE)
    const sources = new Set(graph.edges.map((edge) => edge.source))
    expect(sources.has('tool-bash')).toBe(true)
    expect(sources.has('tool-web')).toBe(false)
  })

  it('reports rows the canvas cannot express instead of dropping them silently', () => {
    const { skipped } = graphFromLive(LIVE)
    expect(skipped).toContain('storage-json')
    expect(skipped).toContain('webserver')
    expect(skipped).not.toContain('tool-bash')
  })

  it('round-trips: the imported graph compiles back to the same config', () => {
    // An import that changed the config on the way in would be worse than no
    // import at all.
    const { graph } = graphFromLive(LIVE)
    const ops = compileGraphToPatch(graph)
    expect(ops).toContainEqual({
      id: 'agent-default-model',
      config: { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
    })
    expect(ops).toContainEqual({ id: 'tool-web', disabled: true })
    expect(ops).not.toContainEqual({ id: 'tool-bash', disabled: true })
  })

  it('survives a harness with nothing the canvas understands', () => {
    const { graph, skipped } = graphFromLive([entry({ id: 'webserver' })])
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]?.data.kind).toBe('agentLoop')
    expect(skipped).toEqual(['webserver'])
  })

  it('every edge resolves to a node that exists', () => {
    const { graph } = graphFromLive(LIVE)
    const ids = new Set(graph.nodes.map((node) => node.id))
    for (const edge of graph.edges) {
      expect(ids.has(edge.source)).toBe(true)
      expect(ids.has(edge.target)).toBe(true)
    }
  })
})
