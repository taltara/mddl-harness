import { describe, expect, it } from 'vitest'
import {
  BLOCK_END,
  BLOCK_START,
  composePatchFile,
  diffLines,
  hasManagedBlock,
  revisionOf,
  splitManagedBlock,
} from './patchFile.ts'

const ROWS = "- id: agent-default-model\n  config:\n    model: 'x'"

const HAND_WRITTEN = `# my own notes
- id: tool-bash
  config:
    timeout: !!js env.TIMEOUT
`

describe('splitManagedBlock', () => {
  it('reports no block for a file that has none', () => {
    const split = splitManagedBlock(HAND_WRITTEN)
    expect(split.managed).toBeUndefined()
    expect(split.before).toBe(HAND_WRITTEN)
  })

  it('extracts the rows between the markers', () => {
    const file = `${BLOCK_START}\n${ROWS}\n${BLOCK_END}\n`
    expect(splitManagedBlock(file).managed).toBe(ROWS)
  })

  it('refuses a block that was left open by hand', () => {
    expect(() => splitManagedBlock(`${BLOCK_START}\n${ROWS}\n`)).toThrow(
      /no matching/,
    )
  })

  it('ignores a marker that is indented inside a block scalar', () => {
    // The same text nested in YAML content must not be read as a marker.
    const file = `- id: x\n  config:\n    note: |\n      ${BLOCK_START}\n      still content\n`
    expect(splitManagedBlock(file).managed).toBeUndefined()
    expect(hasManagedBlock(file)).toBe(false)
  })
})

describe('composePatchFile', () => {
  it('adds a block to a file that had none, keeping the original bytes', () => {
    const out = composePatchFile(HAND_WRITTEN, ROWS)
    expect(out).toContain('# my own notes')
    expect(out).toContain('timeout: !!js env.TIMEOUT')
    expect(out).toContain(ROWS)
  })

  it('replaces only the block on a second write', () => {
    const first = composePatchFile(HAND_WRITTEN, ROWS)
    const second = composePatchFile(first, '- id: tool-web\n  disabled: true')
    expect(second).toContain('# my own notes')
    expect(second).toContain('timeout: !!js env.TIMEOUT')
    expect(second).toContain('- id: tool-web')
    expect(second).not.toContain('agent-default-model')
  })

  it('leaves hand-written content byte for byte across a round trip', () => {
    const withBlock = composePatchFile(HAND_WRITTEN, ROWS)
    const removed = composePatchFile(withBlock, '')
    expect(removed.trim()).toBe(HAND_WRITTEN.trim())
  })

  it('removes the block entirely when there are no rows', () => {
    const withBlock = composePatchFile(HAND_WRITTEN, ROWS)
    expect(hasManagedBlock(composePatchFile(withBlock, ''))).toBe(false)
  })

  it('preserves content written after the block', () => {
    const file = `${BLOCK_START}\n${ROWS}\n${BLOCK_END}\n\n- id: after-the-block\n`
    const out = composePatchFile(file, '- id: replaced')
    expect(out).toContain('- id: after-the-block')
    expect(out).toContain('- id: replaced')
  })

  it('produces an empty file when there is nothing to keep', () => {
    expect(composePatchFile('', '')).toBe('')
  })

  it('is stable: composing the same rows twice changes nothing', () => {
    const once = composePatchFile(HAND_WRITTEN, ROWS)
    expect(composePatchFile(once, ROWS)).toBe(once)
  })
})

describe('revisionOf', () => {
  it('matches for identical content and differs for a single byte', () => {
    expect(revisionOf('a')).toBe(revisionOf('a'))
    expect(revisionOf('a')).not.toBe(revisionOf('b'))
  })
})

describe('diffLines', () => {
  it('keeps unchanged lines visible between scattered edits', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f'].join('\n')
    const after = ['a', 'B', 'c', 'd', 'e', 'F'].join('\n')
    const diff = diffLines(before, after)
    // A prefix/suffix diff would collapse this into one big delete and one
    // big add. Unchanged lines in the middle are the point.
    expect(
      diff.filter((row) => row.kind === 'same').map((r) => r.text),
    ).toEqual(['a', 'c', 'd', 'e'])
    expect(diff.filter((row) => row.kind === 'add').map((r) => r.text)).toEqual(
      ['B', 'F'],
    )
  })

  it('reports a pure addition', () => {
    const diff = diffLines('a', 'a\nb')
    expect(diff).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'add', text: 'b' },
    ])
  })

  it('reports no change for identical input', () => {
    expect(diffLines('a\nb', 'a\nb').every((r) => r.kind === 'same')).toBe(true)
  })
})
