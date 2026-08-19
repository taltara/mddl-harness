import { describe, expect, it } from 'vitest'
import {
  injectNames,
  phaseOf,
  projectEntries,
  redactConfig,
  type EntryLike,
} from './live.ts'
import { lintLive } from './lintLive.ts'

describe('redactConfig', () => {
  it('withholds credential-shaped keys and reports them', () => {
    const { config, redacted } = redactConfig({
      model: 'deepseek-v4-flash',
      apiKey: 'secret-value',
      DEEPSEEK_TOKEN: 'another',
    })
    expect(config).toEqual({ model: 'deepseek-v4-flash' })
    expect(redacted.sort()).toEqual(['DEEPSEEK_TOKEN', 'apiKey'])
  })

  it('withholds credential-shaped values under an innocent key', () => {
    const { config, redacted } = redactConfig({ endpoint: 'sk-abcdef123456' })
    expect(config).toEqual({})
    expect(redacted).toEqual(['endpoint'])
  })

  it('drops nested objects rather than partially redacting them', () => {
    const { config, omitted } = redactConfig({ nested: { apiKey: 'x' }, flag: true })
    expect(config).toEqual({ flag: true })
    expect(omitted).toEqual(['nested'])
  })

  it('does not call an ordinary nested value a credential', () => {
    const { redacted, omitted } = redactConfig({ port: { $expr: 'x' } })
    expect(redacted).toEqual([])
    expect(omitted).toEqual(['port'])
  })

  it('keeps a numeric setting whose name contains a trigger word', () => {
    const { config, redacted } = redactConfig({ maxOutputTokens: 8192 })
    expect(config).toEqual({ maxOutputTokens: 8192 })
    expect(redacted).toEqual([])
  })

  it('returns null for a non-object config', () => {
    expect(redactConfig(undefined).config).toBeNull()
  })
})

describe('phaseOf', () => {
  it('maps the documented fiber states', () => {
    expect(phaseOf(2, false)).toBe('active')
    expect(phaseOf(3, false)).toBe('failed')
    expect(phaseOf(0, false)).toBe('pending')
  })

  it('reports disabled ahead of any fiber state', () => {
    expect(phaseOf(2, true)).toBe('disabled')
  })

  it('degrades to unknown on an unrecognized state', () => {
    expect(phaseOf(99, false)).toBe('unknown')
    expect(phaseOf(undefined, false)).toBe('unknown')
  })
})

describe('injectNames', () => {
  it('accepts a list', () => {
    expect(injectNames(['loader', 'webServer'])).toEqual(['loader', 'webServer'])
  })

  it('flattens the required/optional form', () => {
    expect(injectNames({ required: ['loader'], optional: ['locale'] })).toEqual([
      'loader',
      'locale',
    ])
  })

  it('ignores anything else', () => {
    expect(injectNames(undefined)).toEqual([])
  })
})

function entry(over: EntryLike['options'], fiberState?: number): EntryLike {
  return { options: over, fiber: fiberState === undefined ? undefined : { state: fiberState } }
}

describe('projectEntries', () => {
  it('projects a live entry without leaking secrets', () => {
    const [projected] = projectEntries([
      entry({ id: 'agent-default-model', name: '@deepseek-ai/dsh-llm-deepseek', config: { model: 'x', apiKey: 'k' }, inject: ['loader'] }, 2),
    ])
    expect(projected).toEqual({
      id: 'agent-default-model',
      name: '@deepseek-ai/dsh-llm-deepseek',
      phase: 'active',
      disabled: false,
      group: false,
      inject: ['loader'],
      config: { model: 'x' },
      redacted: ['apiKey'],
      omitted: [],
    })
  })

  it('survives a malformed entry', () => {
    const [projected] = projectEntries([{}])
    expect(projected?.id).toBe('(unnamed)')
    expect(projected?.phase).toBe('unknown')
  })
})

describe('lintLive', () => {
  it('passes a healthy tree', () => {
    const entries = projectEntries([entry({ id: 'tool-bash', name: 'pkg' }, 2)])
    expect(lintLive(entries)).toEqual([])
  })

  it('reports an entry that is configured but failed to load', () => {
    const entries = projectEntries([entry({ id: 'tool-bash', name: 'pkg' }, 3)])
    expect(lintLive(entries).map((w) => w.code)).toEqual(['entry-failed'])
  })

  it('reports an entry stuck waiting on a service', () => {
    const entries = projectEntries([
      entry({ id: 'tool-web', name: 'pkg', inject: ['sandbox'] }, 0),
    ])
    const [warning] = lintLive(entries)
    expect(warning?.code).toBe('entry-pending')
    expect(warning?.text).toContain('sandbox')
  })

  it('reports a disabled entry that something enabled still requires', () => {
    const entries = projectEntries([
      entry({ id: 'storage', name: 'pkg', disabled: true }),
      entry({ id: 'sessions', name: 'pkg', inject: ['storage'] }, 2),
    ])
    const codes = lintLive(entries).map((w) => w.code)
    expect(codes).toContain('disabled-dependency')
  })

  it('does not fault a disabled entry nothing requires', () => {
    const entries = projectEntries([entry({ id: 'tool-web', name: 'pkg', disabled: true })])
    expect(lintLive(entries)).toEqual([])
  })

  it('accepts the same id in several trees, as agent presets produce', () => {
    // loader.entries() walks nested subtrees, so every preset contributes its
    // own tool-bash. Flagging that buried the real findings under 21 errors.
    const entries = projectEntries([
      entry({ id: 'tool-bash', name: 'pkg' }, 2),
      entry({ id: 'tool-bash', name: 'pkg' }, 2),
      entry({ id: 'tool-bash', name: 'pkg' }, 2),
    ])
    expect(lintLive(entries)).toEqual([])
  })
})
