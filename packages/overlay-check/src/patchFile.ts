import { createHash } from 'node:crypto'

/**
 * A writer owns one marker-delimited region of the profile's
 * `cordis.patch.yml` and nothing else. Everything outside the markers — hand
 * written rows, comments, `!!js` expressions — survives byte for byte, because
 * a config file a GUI cannot share is a config file people stop hand editing.
 *
 * The owner is part of the marker because a block is *replaced* wholesale on
 * every write. Two tools sharing one marker would not merge; whichever wrote
 * second would silently delete the other's rows. Naming the owner gives each
 * writer its own region, and makes the file say who to go back to.
 */
export const BLOCK_START = '# >>> dsh-blueprint managed block'
export const BLOCK_END = '# <<< dsh-blueprint managed block'

/** The writer whose block is being read or rewritten. */
export interface BlockOwner {
  /** Appears in the markers, e.g. `prae` → `# >>> prae managed block`. */
  readonly name: string
  /** One line telling a reader where these rows came from. */
  readonly wrote?: string
}

const DEFAULT_OWNER: BlockOwner = {
  name: 'dsh-blueprint',
  wrote:
    'Written by the Blueprint tab. Edit it there, or delete the whole block',
}

function markersFor(owner: BlockOwner | undefined) {
  const name = owner?.name ?? DEFAULT_OWNER.name
  const wrote = owner?.wrote ?? DEFAULT_OWNER.wrote
  const start = `# >>> ${name} managed block`
  const end = `# <<< ${name} managed block`
  return {
    start,
    end,
    header: [
      start,
      `# ${wrote ?? `Written by ${name}. Delete the whole block`}`,
      '# (markers included) to take these rows back by hand.',
    ].join('\n'),
  }
}

export interface ManagedSplit {
  /** Everything before the block. Empty when the file has no block yet. */
  before: string
  /** The rows this owner controls, without the markers. Undefined when absent. */
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

export function splitManagedBlock(
  source: string,
  owner?: BlockOwner,
): ManagedSplit {
  const { start: startMarker, end: endMarker } = markersFor(owner)
  const lines = source.split('\n')
  const start = markerIndex(lines, startMarker)
  if (start === -1) {
    return { before: source, managed: undefined, after: '' }
  }
  const end = markerIndex(lines, endMarker, start + 1)
  if (end === -1) {
    // A start without an end means someone edited the block by hand and left
    // it open. Refusing is safer than guessing where their content resumes.
    throw new Error(
      `${startMarker} has no matching ${endMarker}. Fix or remove the block by hand before applying.`,
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

/** Whether a file already carries this owner's block. */
export function hasManagedBlock(source: string, owner?: BlockOwner): boolean {
  return markerIndex(source.split('\n'), markersFor(owner).start) !== -1
}

function trimTrailingBlankLines(value: string): string {
  return value.replace(/\n+$/, '')
}

/** A line that is exactly an empty flow sequence, the shape a fresh profile ships. */
const EMPTY_SEQUENCE = /^\s*\[\]\s*$/

/**
 * Drop a standalone `[]`, reporting whether one was there.
 *
 * A new profile's overlay is `[]` — an empty *flow* sequence, and a complete
 * YAML document on its own. Appending block-sequence rows after it produces
 * two documents in one stream, and the loader refuses the file with "end of
 * the stream or a document separator is expected". Since the row that follows
 * would not load anyway, the profile does not merely lose the new rows: it
 * stops booting, taking every tool you would debug it with along with it.
 *
 * Only the first one goes. A second `[]` further down is somebody's data, not
 * the placeholder.
 */
function stripEmptySequence(text: string): { text: string; had: boolean } {
  const lines = text.split('\n')
  const kept: string[] = []
  let had = false
  for (const line of lines) {
    if (!had && EMPTY_SEQUENCE.test(line)) {
      had = true
      continue
    }
    kept.push(line)
  }
  return { text: kept.join('\n'), had }
}

/** Whether a composed file would parse as a list rather than as null. */
function hasContent(text: string): boolean {
  return text
    .split('\n')
    .some((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
}

/**
 * Rebuild a patch file with `rows` as this owner's managed block, leaving every
 * other byte where it was. Passing empty rows removes the block entirely.
 *
 * Only the named owner's block is touched. Another writer's block sits in
 * `before` or `after` and survives untouched, which is what lets two tools
 * manage the same file without erasing each other.
 */
export function composePatchFile(
  source: string,
  rows: string,
  owner?: BlockOwner,
): string {
  const { end, header } = markersFor(owner)
  const { before, after } = splitManagedBlock(source, owner)
  const body = rows.trim()

  // The placeholder `[]` and real rows cannot share a document, so it goes out
  // while rows are present — and comes back when the last row leaves, since a
  // file of nothing but comments parses as null rather than as an empty list.
  const headStrip = stripEmptySequence(trimTrailingBlankLines(before))
  const tailStrip = stripEmptySequence(trimTrailingBlankLines(after))
  const stripped = body !== ''
  const head = stripped ? headStrip.text : trimTrailingBlankLines(before)
  const tail = stripped ? tailStrip.text : trimTrailingBlankLines(after)

  const parts: string[] = []
  if (trimTrailingBlankLines(head) !== '') {
    parts.push(trimTrailingBlankLines(head))
  }
  if (body !== '') {
    parts.push([header, body, end].join('\n'))
  }
  if (tail !== '') {
    parts.push(tail)
  }
  if (parts.length === 0) {
    return ''
  }

  const composed = `${parts.join('\n\n')}\n`
  // Removing the last block can leave only comments behind. Restore the
  // placeholder so the overlay still reads as an empty list.
  if (!hasContent(composed)) {
    return `${trimTrailingBlankLines(composed)}\n[]\n`
  }
  return composed
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
