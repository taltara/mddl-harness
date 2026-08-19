import { createHash } from 'node:crypto'

/**
 * Blueprint owns one marker-delimited region of the profile's
 * `cordis.patch.yml` and nothing else. Everything outside the markers — hand
 * written rows, comments, `!!js` expressions — survives byte for byte, because
 * a config file a GUI cannot share is a config file people stop hand editing.
 */
export const BLOCK_START = '# >>> dsh-blueprint managed block'
export const BLOCK_END = '# <<< dsh-blueprint managed block'

const BLOCK_HEADER = [
  BLOCK_START,
  '# Written by the Blueprint tab. Edit it there, or delete the whole block',
  '# (markers included) to take these rows back by hand.',
].join('\n')

export interface ManagedSplit {
  /** Everything before the block. Empty when the file has no block yet. */
  before: string
  /** The rows Blueprint owns, without the markers. Undefined when absent. */
  managed: string | undefined
  /** Everything after the block. */
  after: string
}

/**
 * A marker only counts on its own line at column 0, so the same text inside a
 * YAML block scalar or a comment body is not mistaken for one.
 */
function markerIndex(lines: string[], marker: string, from = 0): number {
  for (let i = from; i < lines.length; i += 1) {
    if (lines[i]?.trimEnd() === marker) {
      return i
    }
  }
  return -1
}

export function splitManagedBlock(source: string): ManagedSplit {
  const lines = source.split('\n')
  const start = markerIndex(lines, BLOCK_START)
  if (start === -1) {
    return { before: source, managed: undefined, after: '' }
  }
  const end = markerIndex(lines, BLOCK_END, start + 1)
  if (end === -1) {
    // A start without an end means someone edited the block by hand and left
    // it open. Refusing is safer than guessing where their content resumes.
    throw new Error(
      `${BLOCK_START} has no matching ${BLOCK_END}. Fix or remove the block by hand before applying.`,
    )
  }
  // The header comments belong to the block, so rewind past them.
  let headerStart = start
  while (headerStart > 0 && lines[headerStart - 1]?.startsWith('# ')) {
    headerStart -= 1
  }
  return {
    before: lines.slice(0, start).join('\n'),
    managed: lines.slice(start + 1, end).join('\n'),
    after: lines.slice(end + 1).join('\n'),
  }
}

/** Whether a file already carries a Blueprint block. */
export function hasManagedBlock(source: string): boolean {
  return markerIndex(source.split('\n'), BLOCK_START) !== -1
}

function trimTrailingBlankLines(value: string): string {
  return value.replace(/\n+$/, '')
}

/**
 * Rebuild a patch file with `rows` as the managed block, leaving every other
 * byte where it was. Passing empty rows removes the block entirely.
 */
export function composePatchFile(source: string, rows: string): string {
  const { before, after } = splitManagedBlock(source)
  const head = trimTrailingBlankLines(before)
  const tail = trimTrailingBlankLines(after)
  const body = rows.trim()

  const parts: string[] = []
  if (head !== '') {
    parts.push(head)
  }
  if (body !== '') {
    parts.push([BLOCK_HEADER, body, BLOCK_END].join('\n'))
  }
  if (tail !== '') {
    parts.push(tail)
  }
  if (parts.length === 0) {
    return ''
  }
  return `${parts.join('\n\n')}\n`
}

/**
 * Precondition token for a write. Short, and only ever compared to itself —
 * this detects a file that moved under us, it is not a security boundary.
 */
export function revisionOf(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex').slice(0, 16)
}

/** Line-level diff, kept honest: unchanged lines stay in the output. */
export function diffLines(
  before: string,
  after: string,
): { kind: 'same' | 'add' | 'remove'; text: string }[] {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  // Longest common subsequence, so scattered edits render as separate hunks
  // instead of one giant delete followed by one giant add.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = lcs[i]
      const next = lcs[i + 1]
      if (row === undefined || next === undefined) {
        continue
      }
      row[j] =
        a[i] === b[j]
          ? (next[j + 1] ?? 0) + 1
          : Math.max(next[j] ?? 0, row[j + 1] ?? 0)
    }
  }
  const out: { kind: 'same' | 'add' | 'remove'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] ?? '' })
      i += 1
      j += 1
      continue
    }
    const down = lcs[i + 1]?.[j] ?? 0
    const right = lcs[i]?.[j + 1] ?? 0
    if (down >= right) {
      out.push({ kind: 'remove', text: a[i] ?? '' })
      i += 1
    } else {
      out.push({ kind: 'add', text: b[j] ?? '' })
      j += 1
    }
  }
  for (; i < a.length; i += 1) {
    out.push({ kind: 'remove', text: a[i] ?? '' })
  }
  for (; j < b.length; j += 1) {
    out.push({ kind: 'add', text: b[j] ?? '' })
  }
  return out
}
