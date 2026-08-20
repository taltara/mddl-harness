import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  diffAgainstSnapshot,
  listSnapshots,
  pruneSnapshots,
  restoreSnapshot,
  type SnapshotStore,
  snapshotContent,
  takeSnapshot,
} from './snapshot.ts'

let root = ''
let store: SnapshotStore = { dir: '', root: '' }

/** The file set dsh plugin add can touch, per sandbaseai/dsh-plugin-store#7. */
const PROFILE_FILES = ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml']

async function seedProfile() {
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'profile',
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }),
  )
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  await writeFile(
    join(root, 'cordis.patch.yml'),
    '# hand-written note\n- id: tool-bash\n  config:\n    timeout: 30\n',
  )
}

/** What a failed install leaves behind: every captured file mutated, one new. */
async function simulateFailedInstall() {
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'profile',
      dependencies: { 'bad-plugin': '^1.0.0' },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'bad-plugin'] } },
    }),
  )
  await writeFile(
    join(root, 'pnpm-lock.yaml'),
    'lockfileVersion: 9\nbad-plugin: 1.0.0\n',
  )
  await writeFile(
    join(root, 'cordis.patch.yml'),
    '# hand-written note\n- id: tool-bash\n  config:\n    timeout: 30\n\n- insert:\n    - id: bad\n      name: bad-plugin\n',
  )
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'snapshot-test-'))
  store = { dir: join(root, '.snapshots'), root }
  await seedProfile()
})

describe('takeSnapshot', () => {
  // #7: "Snapshot is created before the DSH plugin add process starts" —
  // capture is a pure read, so taking it first mutates nothing.
  it('captures without changing any file', async () => {
    const before = await readFile(join(root, 'package.json'), 'utf8')
    await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    expect(await readFile(join(root, 'package.json'), 'utf8')).toBe(before)
  })

  // #7: "Snapshot covers every file the installation path can modify" —
  // including one that does not exist yet.
  it('records an absent file as absent rather than skipping it', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', [
      ...PROFILE_FILES,
      'dsh.lock',
    ])
    const entry = manifest.entries.find((item) => item.path === 'dsh.lock')
    expect(entry).toBeDefined()
    expect(entry?.revision).toBeNull()
  })

  it('refuses a path outside the root', async () => {
    await expect(takeSnapshot(store, 'x', ['../etc/passwd'])).rejects.toThrow(
      /outside the snapshot root/,
    )
  })

  it('gives two captures of identical content distinct identities', async () => {
    const first = await takeSnapshot(store, 'same', PROFILE_FILES)
    const second = await takeSnapshot(store, 'same', PROFILE_FILES)
    expect(first.id).not.toBe(second.id)
    expect(await listSnapshots(store)).toHaveLength(2)
  })
})

describe('restoreSnapshot', () => {
  // #7: "The active Web profile returns to its byte-equivalent pre-install
  // configuration after a failed transaction."
  it('returns every file to byte-equivalent pre-install state', async () => {
    const originals = new Map<string, string>()
    for (const file of PROFILE_FILES) {
      originals.set(file, await readFile(join(root, file), 'utf8'))
    }
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await simulateFailedInstall()
    expect(await diffAgainstSnapshot(store, manifest)).not.toHaveLength(0)

    await restoreSnapshot(store, manifest)

    for (const file of PROFILE_FILES) {
      expect(await readFile(join(root, file), 'utf8')).toBe(originals.get(file))
    }
    expect(await diffAgainstSnapshot(store, manifest)).toHaveLength(0)
  })

  // A fresh profile: the install *creates* files. Restore must remove them,
  // not leave them behind as half an install.
  it('removes a file the failed install created', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', [
      ...PROFILE_FILES,
      'created-by-install.yml',
    ])
    await writeFile(join(root, 'created-by-install.yml'), 'leftover: true\n')
    const result = await restoreSnapshot(store, manifest)
    expect(result.removed).toContain('created-by-install.yml')
    await expect(
      readFile(join(root, 'created-by-install.yml'), 'utf8'),
    ).rejects.toThrow()
  })

  // #7: "Rollback itself is recoverable and does not destroy the
  // failed-state evidence."
  it('preserves the failed state as its own snapshot before restoring', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await simulateFailedInstall()
    const failedManifest = await readFile(join(root, 'package.json'), 'utf8')

    const result = await restoreSnapshot(store, manifest)

    const evidence = await snapshotContent(
      store,
      result.evidence,
      'package.json',
    )
    expect(evidence?.toString('utf8')).toBe(failedManifest)
    // And the evidence is restorable in turn: rolling the rollback back
    // brings the failed state back for inspection.
    await restoreSnapshot(store, result.evidence)
    expect(await readFile(join(root, 'package.json'), 'utf8')).toBe(
      failedManifest,
    )
  })

  // #7: "Tests cover … interrupted rollback." A restore that dies midway
  // must be re-runnable from the same snapshot and still converge.
  it('recovers from an interrupted rollback by running again', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await simulateFailedInstall()

    // Interrupt: restore only the first file by hand, as if the process died.
    const saved = await snapshotContent(store, manifest, 'package.json')
    await writeFile(join(root, 'package.json'), saved ?? Buffer.from(''))

    await restoreSnapshot(store, manifest)
    expect(await diffAgainstSnapshot(store, manifest)).toHaveLength(0)
  })

  it('keeps hand-written overlay content through the round trip', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await simulateFailedInstall()
    await restoreSnapshot(store, manifest)
    const overlay = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
    expect(overlay).toContain('# hand-written note')
    expect(overlay).toContain('timeout: 30')
    expect(overlay).not.toContain('bad-plugin')
  })
})

describe('diffAgainstSnapshot', () => {
  it('names exactly the files that changed', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\nx: 1\n')
    expect(await diffAgainstSnapshot(store, manifest)).toEqual([
      'pnpm-lock.yaml',
    ])
  })

  it('reports a deleted file as changed', async () => {
    const manifest = await takeSnapshot(store, 'pre-install', PROFILE_FILES)
    await rm(join(root, 'cordis.patch.yml'))
    expect(await diffAgainstSnapshot(store, manifest)).toEqual([
      'cordis.patch.yml',
    ])
  })
})

describe('listSnapshots and pruneSnapshots', () => {
  it('lists newest first and prunes the oldest', async () => {
    const first = await takeSnapshot(store, 'one', PROFILE_FILES)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await takeSnapshot(store, 'two', PROFILE_FILES)
    const listed = await listSnapshots(store)
    expect(listed[0]?.id).toBe(second.id)

    const removed = await pruneSnapshots(store, 1)
    expect(removed).toEqual([first.id])
    expect(await listSnapshots(store)).toHaveLength(1)
  })

  it('skips foreign directories rather than failing the listing', async () => {
    await takeSnapshot(store, 'one', PROFILE_FILES)
    await mkdir(join(store.dir, 'not-a-snapshot'), { recursive: true })
    expect(await listSnapshots(store)).toHaveLength(1)
  })
})
