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

## What this does not do

It proves nothing about activation. Resolvability is necessary, not sufficient:
a module can resolve and still fail to start, and a missing service provider
leaves an entry pending forever. Only a real isolated boot proves that. Treat
these as the cheap gates before the expensive one.

MIT.
