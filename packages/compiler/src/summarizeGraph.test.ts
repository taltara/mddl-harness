import { starterGraph } from '@mddl/graph-schema'
import { describe, expect, it } from 'vitest'
import { summarizeGraph } from './summarizeGraph.ts'

describe('summarizeGraph', () => {
  it('explains that wired catalog tools stay in dsh-base', () => {
    const summary = summarizeGraph(starterGraph)
    expect(summary.attached).toBe(false)
    expect(summary.applyCommand).toContain('dsh web --patch')
    expect(summary.facts).toContainEqual({
      kind: 'note',
      text: 'This overlay does not add a DSH UI tab. Web sessions load tools from agent presets, not from wired canvas tools.',
    })
    expect(summary.facts).toContainEqual({
      kind: 'change',
      text: 'Set default model to DeepSeek V4 Flash (agent-default-model).',
    })
    expect(summary.facts).toContainEqual({
      kind: 'keep',
      text: 'Keep Bash from dsh-base (tool-bash).',
    })
    expect(summary.facts).toContainEqual({
      kind: 'keep',
      text: 'Keep Web Search from dsh-base (tool-web).',
    })
  })
})
