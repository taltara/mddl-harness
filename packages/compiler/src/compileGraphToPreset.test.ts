import { type GraphDocument, starterGraph } from '@mddl/graph-schema'
import { describe, expect, it } from 'vitest'
import {
  compileGraphToPreset,
  compilePresetManifest,
  isPresetId,
} from './compileGraphToPreset.ts'

function withPersona(text: string): GraphDocument {
  return {
    ...starterGraph,
    nodes: starterGraph.nodes.map((node) =>
      node.data.kind === 'agentLoop'
        ? { ...node, data: { ...node.data, persona: text } }
        : node,
    ),
  }
}

describe('compileGraphToPreset', () => {
  it('emits one flat row per wired tool, as the shipped presets do', () => {
    const yaml = compileGraphToPreset(starterGraph)
    expect(yaml).toContain('- id: tool-bash')
    expect(yaml).toContain("  name: '@deepseek-ai/dsh-tool-bash'")
    expect(yaml).toContain('- id: tool-web')
    expect(yaml).toContain('- id: tool-fs')
  })

  it('omits the persona row when none was written', () => {
    expect(compileGraphToPreset(starterGraph)).not.toContain('- id: persona')
  })

  it('includes a single-line persona inline', () => {
    const yaml = compileGraphToPreset(withPersona('You are terse.'))
    expect(yaml).toContain('- id: persona')
    expect(yaml).toContain('    text: "You are terse."')
  })

  it('writes a multi-line persona as a block scalar', () => {
    const yaml = compileGraphToPreset(withPersona('Line one.\nLine two.'))
    expect(yaml).toContain('    text: |-')
    expect(yaml).toContain('      Line one.')
    expect(yaml).toContain('      Line two.')
  })

  it('leaves out a tool that is switched off', () => {
    const off: GraphDocument = {
      ...starterGraph,
      nodes: starterGraph.nodes.map((node) =>
        node.data.kind === 'tool' && node.data.rowId === 'tool-web'
          ? { ...node, data: { ...node.data, enabled: false } }
          : node,
      ),
    }
    const yaml = compileGraphToPreset(off)
    expect(yaml).not.toContain('- id: tool-web')
    expect(yaml).toContain('- id: tool-bash')
  })

  it('leaves out a tool that is on the canvas but unwired', () => {
    const unwired: GraphDocument = {
      ...starterGraph,
      edges: starterGraph.edges.filter((edge) => edge.source !== 'tool-fs'),
    }
    expect(compileGraphToPreset(unwired)).not.toContain('- id: tool-fs')
  })

  it('never emits a model row: the preset does not own the model', () => {
    expect(compileGraphToPreset(starterGraph)).not.toContain(
      'agent-default-model',
    )
  })

  it('ends with exactly one trailing newline', () => {
    const yaml = compileGraphToPreset(starterGraph)
    expect(yaml.endsWith('\n')).toBe(true)
    expect(yaml.endsWith('\n\n')).toBe(false)
  })
})

describe('compilePresetManifest', () => {
  it('quotes values so a name with a colon stays valid YAML', () => {
    const manifest = compilePresetManifest('Mine: the good one', 'From mddl')
    expect(manifest).toContain('name: "Mine: the good one"')
    expect(manifest).toContain('order: 50')
  })
})

describe('isPresetId', () => {
  it('accepts a directory-safe id', () => {
    expect(isPresetId('my-preset')).toBe(true)
    expect(isPresetId('a1')).toBe(true)
  })

  it('refuses anything that could not be a preset directory', () => {
    // Discovery skips these outright, so writing one would create a folder
    // that silently never appears.
    expect(isPresetId('-leading')).toBe(false)
    expect(isPresetId('Upper')).toBe(false)
    expect(isPresetId('has space')).toBe(false)
    expect(isPresetId('../escape')).toBe(false)
    expect(isPresetId('')).toBe(false)
  })
})
