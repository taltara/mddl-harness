import { describe, expect, it } from 'vitest'
import type { PaletteItem } from '../lib/createNode.ts'
import {
  matchesQuery,
  paletteItemKey,
  paletteItems,
  paletteSubtitle,
  searchTerms,
} from './usePalette.ts'

function find(predicate: (item: PaletteItem) => boolean): PaletteItem {
  const item = paletteItems().find(predicate)
  if (item === undefined) {
    throw new Error('palette item not found')
  }
  return item
}

const bash = find(
  (item) => item.kind === 'tool' && item.entry.rowId === 'tool-bash',
)
const fsSearch = find(
  (item) => item.kind === 'tool' && item.entry.rowId === 'tool-fs-search',
)
const flash = find(
  (item) => item.kind === 'model' && item.entry.model === 'deepseek-v4-flash',
)
const pro = find(
  (item) => item.kind === 'model' && item.entry.model === 'deepseek-v4-pro',
)

describe('paletteItems', () => {
  it('offers exactly one agent loop', () => {
    const loops = paletteItems().filter((item) => item.kind === 'agentLoop')
    expect(loops).toHaveLength(1)
  })
})

describe('paletteItemKey', () => {
  it('separates two models that share a row id', () => {
    // Both models patch agent-default-model, so the row id alone would
    // collide and mark both placed when only one is.
    expect(flash.entry.rowId).toBe(pro.entry.rowId)
    expect(paletteItemKey(flash)).not.toBe(paletteItemKey(pro))
  })

  it('is stable for the same item', () => {
    expect(paletteItemKey(bash)).toBe(paletteItemKey(bash))
  })
})

describe('paletteSubtitle', () => {
  it('shows the model name for models and the row id for tools', () => {
    expect(paletteSubtitle(flash)).toBe('deepseek-v4-flash')
    expect(paletteSubtitle(bash)).toBe('tool-bash')
  })
})

describe('searchTerms', () => {
  it('splits on whitespace and lowercases', () => {
    expect(searchTerms('  FS  Search ')).toEqual(['fs', 'search'])
  })

  it('is empty for a blank query', () => {
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('matchesQuery', () => {
  it('matches on label', () => {
    expect(matchesQuery(bash, searchTerms('bash'))).toBe(true)
  })

  it('matches on row id', () => {
    expect(matchesQuery(bash, searchTerms('tool-bash'))).toBe(true)
  })

  it('matches on package name', () => {
    expect(matchesQuery(bash, searchTerms('dsh-tool-bash'))).toBe(true)
  })

  it('matches on description', () => {
    expect(matchesQuery(bash, searchTerms('sandboxed'))).toBe(true)
  })

  it('is case insensitive', () => {
    expect(matchesQuery(bash, searchTerms('BASH'))).toBe(true)
  })

  it('narrows with every extra term rather than widening', () => {
    // "fs search" must find Filesystem Search and not plain Bash.
    expect(matchesQuery(fsSearch, searchTerms('fs search'))).toBe(true)
    expect(matchesQuery(bash, searchTerms('fs search'))).toBe(false)
  })

  it('matches everything on an empty query', () => {
    expect(matchesQuery(bash, searchTerms(''))).toBe(true)
  })

  it('rejects a term that appears nowhere', () => {
    expect(matchesQuery(bash, searchTerms('zzz'))).toBe(false)
  })
})
