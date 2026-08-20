import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'

/**
 * Snapshot and restore for a set of files an installer may mutate.
 *
 * Built for one transaction shape: `dsh plugin add` is the first mutation —
 * it can touch the profile manifest, the lockfile, the overlay, and bundle
 * activation together — so recovery state has to exist before that command
 * runs, and restoring has to bring back every one of those files at once.
 * Restoring one of them to a state the others never had is its own corruption.
 *
 * Nothing here spawns a process or knows what the files mean. Boot probes and
 * promotion belong to the installer.
 */

/** One captured file, or a record that it did not exist. */
export interface SnapshotEntry {
  /** Path relative to the snapshot root, POSIX separators. */
  path: string
  /** Content hash, or null when the file was absent at capture time. */
  revision: string | null
}

/**
 * `capture` is a snapshot taken before a mutation. `evidence` is the state a
 * restore replaced — kept so a failed transaction stays diagnosable, and
 * retained on its own budget so routine pruning cannot quietly discard it.
 */
export type SnapshotKind = 'capture' | 'evidence'

export interface SnapshotManifest {
  id: string
  createdAt: string
  kind: SnapshotKind
  /** Why this snapshot was taken, e.g. "pre-install dsh-plugin-x". */
  label: string
  entries: SnapshotEntry[]
}

export interface SnapshotStore {
  /** Directory snapshots live under, e.g. `<profile>/.dsh-blueprint/snapshots`. */
  dir: string
  /** Root that captured paths are recorded relative to. */
  root: string
}

const MANIFEST = 'manifest.json'

let tempSequence = 0
function tempCounter(): string {
  tempSequence += 1
  return `${Date.now().toString(36)}-${tempSequence}`
}

function hashOf(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/** Lexical containment: rejects `..` and absolute paths pointing elsewhere. */
function relativeTo(root: string, path: string): string {
  const rel = relative(resolve(root), resolve(root, path))
  if (rel.startsWith('..') || rel === '') {
    throw new Error(`snapshot: "${path}" is outside the snapshot root`)
  }
  return rel.split(sep).join('/')
}

/** The nearest ancestor that exists, so an absent file can still be checked. */
async function existingAncestor(path: string): Promise<string> {
  let current = path
  for (;;) {
    try {
      return await realpath(current)
    } catch {
      const parent = dirname(current)
      if (parent === current) {
        return current
      }
      current = parent
    }
  }
}

/**
 * Containment that survives symlinks.
 *
 * Lexical checks alone are not enough: a symlink *inside* the root pointing
 * out of it resolves cleanly by path arithmetic, and following it would let a
 * transaction read — and on restore, write — outside the profile it claims to
 * be confined to. Both the file and its nearest existing ancestor are resolved
 * before either is trusted.
 */
async function assertContained(root: string, rel: string): Promise<void> {
  const realRoot = await existingAncestor(resolve(root))
  const real = await existingAncestor(resolve(root, rel))
  const within = relative(realRoot, real)
  // An absent file resolves to its nearest existing ancestor, which for a
  // new file directly under the root is the root itself — that is contained,
  // not an escape.
  if (within.startsWith('..')) {
    throw new Error(
      `snapshot: "${rel}" resolves outside the snapshot root (symlink?)`,
    )
  }
}

async function readIfExists(path: string): Promise<Buffer | null> {
  try {
    return await readFile(path)
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw cause
  }
}

/**
 * Capture the current state of `paths` before anything mutates them.
 *
 * A file that does not exist is captured as absent — restoring later removes
 * it rather than leaving whatever the failed install created. That case is
 * why "restore" cannot be a plain copy loop: `dsh plugin add` on a fresh
 * profile creates files that have no pre-install content at all.
 */
export async function takeSnapshot(
  store: SnapshotStore,
  label: string,
  paths: string[],
  kind: SnapshotKind = 'capture',
): Promise<SnapshotManifest> {
  const entries: SnapshotEntry[] = []
  const captured: { rel: string; content: Buffer | null }[] = []

  for (const path of paths) {
    const rel = relativeTo(store.root, path)
    await assertContained(store.root, rel)
    const content = await readIfExists(resolve(store.root, rel))
    captured.push({ rel, content })
    entries.push({
      path: rel,
      revision: content === null ? null : hashOf(content),
    })
  }

  const createdAt = new Date().toISOString()
  const manifest: SnapshotManifest = {
    // The moment is part of the identity: two captures of identical content
    // are still two snapshots, and must not overwrite each other's history.
    id: hashOf(JSON.stringify(entries) + label + createdAt + Math.random()),
    createdAt,
    kind,
    label,
    entries,
  }

  const snapDir = join(store.dir, manifest.id)
  await mkdir(snapDir, { recursive: true })
  for (const { rel, content } of captured) {
    if (content === null) {
      continue
    }
    const target = join(snapDir, 'files', rel)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  await writeFile(
    join(snapDir, MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  )
  return manifest
}

/** Manifests, newest first. A directory without a readable manifest is skipped. */
export async function listSnapshots(
  store: SnapshotStore,
): Promise<SnapshotManifest[]> {
  let ids: string[] = []
  try {
    ids = await readdir(store.dir)
  } catch {
    return []
  }
  const manifests: SnapshotManifest[] = []
  for (const id of ids) {
    try {
      const raw = await readFile(join(store.dir, id, MANIFEST), 'utf8')
      manifests.push(JSON.parse(raw) as SnapshotManifest)
    } catch {
      // Not a snapshot; leave it alone.
    }
  }
  return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Compare the live files against a snapshot without changing anything.
 * Returns the relative paths that differ. Empty means byte-equivalent.
 */
export async function diffAgainstSnapshot(
  store: SnapshotStore,
  manifest: SnapshotManifest,
): Promise<string[]> {
  const changed: string[] = []
  for (const entry of manifest.entries) {
    const live = await readIfExists(resolve(store.root, entry.path))
    const liveRevision = live === null ? null : hashOf(live)
    if (liveRevision !== entry.revision) {
      changed.push(entry.path)
    }
  }
  return changed
}

export interface RestoreResult {
  restored: string[]
  removed: string[]
  /** Where the pre-restore state was preserved. Failed evidence is not destroyed. */
  evidence: SnapshotManifest
}

/**
 * Bring every captured file back to its snapshot state.
 *
 * The current (failed) state is snapshotted first, so a rollback is itself
 * recoverable and the failure evidence survives for diagnostics — rolling
 * back is the moment someone is already having a bad day, and it must not be
 * the irreversible step. Writes go through a temp file and rename in the same
 * directory, so a reader sees old bytes or new bytes and never half of either.
 */
export async function restoreSnapshot(
  store: SnapshotStore,
  manifest: SnapshotManifest,
): Promise<RestoreResult> {
  const evidence = await takeSnapshot(
    store,
    `pre-restore of ${manifest.id} (${manifest.label})`,
    manifest.entries.map((entry) => entry.path),
    'evidence',
  )

  const restored: string[] = []
  const removed: string[] = []
  for (const entry of manifest.entries) {
    // Re-checked at write time: the tree may have gained a symlink since
    // capture, and this loop writes.
    await assertContained(store.root, entry.path)
    const livePath = resolve(store.root, entry.path)
    if (entry.revision === null) {
      // Captured as absent: the install created it, so restore removes it.
      await rm(livePath, { force: true })
      removed.push(entry.path)
      continue
    }
    const saved = await readFile(
      join(store.dir, manifest.id, 'files', entry.path),
    )
    await mkdir(dirname(livePath), { recursive: true })
    // Unique per attempt. A fixed name collides with the leftover temp of a
    // restore that died between write and rename, which turned "retry the
    // rollback" into EEXIST — exactly when retrying matters most.
    const temp = `${livePath}.snapshot-${process.pid}-${tempCounter()}.tmp`
    await writeFile(temp, saved, { flag: 'wx' })
    await rename(temp, livePath)
    restored.push(entry.path)
  }

  const drift = await diffAgainstSnapshot(store, manifest)
  if (drift.length > 0) {
    throw new Error(
      `snapshot: restore did not converge for ${drift.join(', ')}`,
    )
  }
  return { restored, removed, evidence }
}

/**
 * Drop old snapshots, newest kept. Captures and evidence have separate
 * budgets on purpose: routine pruning of pre-install captures must not
 * silently discard the record of a transaction that failed.
 *
 * A bare number applies to captures and leaves evidence untouched.
 */
export async function pruneSnapshots(
  store: SnapshotStore,
  keep: number | { captures?: number; evidence?: number },
): Promise<string[]> {
  const budget = typeof keep === 'number' ? { captures: keep } : keep
  const manifests = await listSnapshots(store)
  const stale: SnapshotManifest[] = []

  const byKind = (kind: SnapshotKind) =>
    manifests.filter((manifest) => (manifest.kind ?? 'capture') === kind)

  if (budget.captures !== undefined) {
    stale.push(...byKind('capture').slice(Math.max(0, budget.captures)))
  }
  if (budget.evidence !== undefined) {
    stale.push(...byKind('evidence').slice(Math.max(0, budget.evidence)))
  }

  for (const manifest of stale) {
    await rm(join(store.dir, manifest.id), { recursive: true, force: true })
  }
  return stale.map((manifest) => manifest.id)
}

/** Size on disk of one snapshot, for display. */
export async function snapshotBytes(
  store: SnapshotStore,
  manifest: SnapshotManifest,
): Promise<number> {
  let total = 0
  for (const entry of manifest.entries) {
    if (entry.revision === null) {
      continue
    }
    try {
      const info = await stat(join(store.dir, manifest.id, 'files', entry.path))
      total += info.size
    } catch {
      // Counted as zero rather than failing a listing over one file.
    }
  }
  return total
}

/** Copy of a snapshot's captured content for one path, or null if absent. */
export async function snapshotContent(
  store: SnapshotStore,
  manifest: SnapshotManifest,
  path: string,
): Promise<Buffer | null> {
  const entry = manifest.entries.find((item) => item.path === path)
  if (entry === undefined || entry.revision === null) {
    return null
  }
  return readFile(join(store.dir, manifest.id, 'files', entry.path))
}

/** Re-export for callers that keep their own copies. */
export async function copySnapshotTo(
  store: SnapshotStore,
  manifest: SnapshotManifest,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true })
  await copyFile(
    join(store.dir, manifest.id, MANIFEST),
    join(destination, MANIFEST),
  )
  for (const entry of manifest.entries) {
    if (entry.revision === null) {
      continue
    }
    const target = join(destination, 'files', entry.path)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(store.dir, manifest.id, 'files', entry.path), target)
  }
}
