import { describe, expect, it } from 'vitest'
import { emitPatchYaml } from './emitYaml.ts'

describe('emitPatchYaml', () => {
  it('emits a replace row and an insert block', () => {
    const yaml = emitPatchYaml([
      {
        id: 'agent-default-model',
        config: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      },
      {
        insert: [{ id: 'hello', name: './plugin.ts' }],
      },
    ])

    expect(yaml).toContain(
      'npx @deepseek-ai/dsh web --patch "$HOME/Downloads/cordis.patch.yml"',
    )
    expect(yaml).toContain('resolved from your terminal cwd')
    expect(yaml).toContain('- id: agent-default-model')
    expect(yaml).toContain('provider: "deepseek-official"')
    expect(yaml).toContain('- insert:')
    expect(yaml).toContain('name: "./plugin.ts"')
  })

  it('emits an empty overlay document when there are no ops', () => {
    expect(emitPatchYaml([])).toContain('[]')
  })
})
