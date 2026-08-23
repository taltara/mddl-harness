# dsh-overlay-check

Offline safety checks for DeepSeek Harness overlays. Node only, **no
dependencies**, and no opinion about how you edit config — so an installer, a
CLI, or a GUI can all share the same answers.

```sh
npm install dsh-overlay-check
```

## Why an overlay needs checking before it is written

A row naming a package the profile cannot load does not degrade into a dead
entry. Cordis fails module resolution during boot, so **the harness does not
start at all** — which also removes the Web UI, the plugin that installed it,
and anything else you would have used to find the problem. The only way back is
editing YAML by hand or restoring a backup.

That is why the useful checks run before the write, not after.

## Preflight

```ts
import { preflightOps } from 'dsh-overlay-check'

const findings = await preflightOps(profileDir, ops, liveIds)
// [{ level: 'blocking', code: 'module-not-installed', text: '…' }]
```

- `module-not-installed` — **blocking**. An inserted package is not present in
  the profile. This is the one worth refusing a write over.
- `insert-over-existing` — warning. The id already exists in the running tree,
  so inserting is likely to collide rather than add.

Presence is checked against the profile's `node_modules` rather than
`require.resolve`, deliberately: an ESM-only package that exports no `require`
condition resolves fine for the loader and throws for a naive resolve, which
would fail a package that works.

## Confined writes

If you write to someone's `cordis.patch.yml`, own a marked region and nothing
else. A file a tool takes ownership of is a file people stop hand-editing, and
then the documented recovery paths stop being available to them.

```ts
import { composePatchFile, revisionOf, diffLines } from 'dsh-overlay-check'

const next = composePatchFile(current, rows) // replaces only the managed block
const rev = revisionOf(current) // precondition for the write
const hunks = diffLines(current, next) // real LCS diff, unchanged lines kept
```

Everything outside the markers — hand-written rows, comments, `!!js`
expressions — survives byte for byte. Passing empty rows removes the block
entirely and hands the file back. A block left open by hand throws rather than
being repaired by guesswork.

`diffLines` is a longest-common-subsequence diff, so two edits nine lines apart
render as two hunks with the unchanged lines still visible between them. A
prefix/suffix diff collapses that into one wall of red and green, and a diff
nobody can read is not a review.

## Transactional snapshot and restore

`dsh plugin add` is the first mutation: it can change the profile manifest,
the lockfile, the overlay, and bundle activation together. So the recovery
snapshot must exist before that command runs, and it must cover all of those
files as one unit — restoring one of them to a state the others never had is
its own corruption.

```ts
import { takeSnapshot, restoreSnapshot, diffAgainstSnapshot } from 'dsh-overlay-check'

const store = { dir: `${profile}/.snapshots`, root: profile }
const files = ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml']

const snap = await takeSnapshot(store, 'pre-install my-plugin', files) // pure read
// ... run the install, the checks, the boot probe ...
if (failed) {
  const { evidence } = await restoreSnapshot(store, snap)
  // every file is byte-equivalent to pre-install, verified before returning;
  // the failed state survives as `evidence`, itself restorable.
}
```

The semantics that matter, each pinned by a test:

- **Capture is a pure read**, so taking it before the first mutation costs
  nothing and changes nothing.
- **Absent files are captured as absent.** A file the failed install created
  is removed on restore, not left behind as half an install.
- **Restore preserves the failed state first**, as a snapshot that is itself
  restorable — rolling back is never the irreversible step, and the evidence
  survives for diagnostics.
- **Restore verifies convergence**: it re-hashes every file and throws rather
  than reporting a restore that did not actually restore.
- **An interrupted restore is re-runnable** from the same snapshot.
- **Paths are confined through symlinks, not just lexically.** A symlink
  inside the root pointing out of it resolves cleanly by path arithmetic;
  both the file and its nearest existing ancestor are resolved before either
  is trusted.
- **Evidence is retained on its own budget.** `pruneSnapshots(store, 20)`
  prunes pre-mutation captures and leaves failed-state evidence alone; pass
  `{ captures, evidence }` to bound both. Routine pruning must not quietly
  discard the record of a transaction that failed.
- Writes are temp-file-then-rename, with a unique temp name per attempt so a
  restore that died between write and rename can simply be run again.

## What this does not do

It proves nothing about activation. Resolvability is necessary, not sufficient:
a module can resolve and still fail to start, and a missing service provider
leaves an entry pending forever. Only a real isolated boot proves that. Treat
these as the cheap gates before the expensive one.

MIT.

## Config the harness overwrites at boot

`agent-presets.roots` is replaced at boot with the shipped root, so setting it
in an overlay does nothing — and `--dump-config` still shows your value, because
the override is applied after the composition it prints. Three people in
[deepseek-harness#403](https://github.com/deepseek-ai/deepseek-harness/discussions/403)
lost time to the dump agreeing with them while the runtime did not.

```
warning  config-silently-overwritten  "agent-presets.roots" is replaced at boot
with the shipped root ... Put presets in $DSH_HOME/.agent-presets/<id>/ instead.
```

Confirmed on `0.1.0-rc.7` and `0.1.1-rc.2`. Scoped to one row and one key, so it
can be deleted cleanly when this is fixed upstream.
