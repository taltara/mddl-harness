//#region src/patchFile.d.ts
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
declare const BLOCK_START = "# >>> dsh-blueprint managed block";
declare const BLOCK_END = "# <<< dsh-blueprint managed block";
/** The writer whose block is being read or rewritten. */
interface BlockOwner {
  /** Appears in the markers, e.g. `prae` → `# >>> prae managed block`. */
  readonly name: string;
  /** One line telling a reader where these rows came from. */
  readonly wrote?: string;
}
interface ManagedSplit {
  /** Everything before the block. Empty when the file has no block yet. */
  before: string;
  /** The rows this owner controls, without the markers. Undefined when absent. */
  managed: string | undefined;
  /** Everything after the block. */
  after: string;
}
declare function splitManagedBlock(source: string, owner?: BlockOwner): ManagedSplit;
/** Whether a file already carries this owner's block. */
declare function hasManagedBlock(source: string, owner?: BlockOwner): boolean;
/**
 * Rebuild a patch file with `rows` as this owner's managed block, leaving every
 * other byte where it was. Passing empty rows removes the block entirely.
 *
 * Only the named owner's block is touched. Another writer's block sits in
 * `before` or `after` and survives untouched, which is what lets two tools
 * manage the same file without erasing each other.
 */
declare function composePatchFile(source: string, rows: string, owner?: BlockOwner): string;
/**
 * Precondition token for a write. Short, and only ever compared to itself —
 * this detects a file that moved under us, it is not a security boundary.
 */
declare function revisionOf(source: string): string;
/** Line-level diff, kept honest: unchanged lines stay in the output. */
declare function diffLines(before: string, after: string): {
  kind: 'same' | 'add' | 'remove';
  text: string;
}[];
//#endregion
//#region src/preflight.d.ts
/** One Cordis row. Declared here so this package pulls in nothing. */
interface CordisRow {
  id: string;
  name?: string;
  disabled?: boolean;
  config?: Record<string, unknown>;
}
/** A patch op is either a row to replace, or a batch of rows to insert. */
interface CordisInsertOp {
  insert: CordisRow[];
}
type CordisPatchOp = CordisRow | CordisInsertOp;
declare function isInsertOp(op: CordisPatchOp): op is CordisInsertOp;
type PreflightLevel = 'blocking' | 'warning';
interface PreflightFinding {
  level: PreflightLevel;
  code: string;
  text: string;
}
/** `@scope/pkg/sub` → `@scope/pkg`; `pkg/sub` → `pkg`. */
declare function packageNameOf(specifier: string): string;
/** Cordis builtins and relative files are not npm packages. */
declare function isBarePackage(specifier: string): boolean;
/**
 * Whether the profile can actually load this package.
 *
 * Presence is checked rather than `require.resolve`, because an ESM-only
 * package that exports no `require` condition resolves fine for the loader
 * and throws here — a false alarm on a package that works.
 */
declare function isInstalled(profileDir: string, specifier: string): Promise<boolean>;
/**
 * Check an overlay before it is written.
 *
 * A row naming a package the profile cannot load does not degrade — it is
 * fatal. Cordis fails module resolution during boot, so the harness does not
 * start at all and the only way back is editing YAML by hand. That makes this
 * the one check worth blocking a write over, rather than reporting afterwards
 * on a live tree that will never exist.
 */
declare function preflightOps(profileDir: string, ops: CordisPatchOp[], liveIds?: Set<string>): Promise<PreflightFinding[]>;
/**
 * Why the harness would call a preset composition broken, or undefined when it
 * looks loadable.
 *
 * Discovery treats a preset whose composition is missing or is not a list of
 * named plugin rows as broken, and it is unmemoized — a bad preset is visible
 * in the picker immediately. Checking our own output is enough here, because
 * the composition is compiler-generated rather than user text.
 */
declare function presetProblem(composition: string): string | undefined;
//#endregion
//#region src/snapshot.d.ts
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
interface SnapshotEntry {
  /** Path relative to the snapshot root, POSIX separators. */
  path: string;
  /** Content hash, or null when the file was absent at capture time. */
  revision: string | null;
}
/**
 * `capture` is a snapshot taken before a mutation. `evidence` is the state a
 * restore replaced — kept so a failed transaction stays diagnosable, and
 * retained on its own budget so routine pruning cannot quietly discard it.
 */
type SnapshotKind = 'capture' | 'evidence';
interface SnapshotManifest {
  id: string;
  createdAt: string;
  kind: SnapshotKind;
  /** Why this snapshot was taken, e.g. "pre-install dsh-plugin-x". */
  label: string;
  entries: SnapshotEntry[];
}
interface SnapshotStore {
  /** Directory snapshots live under, e.g. `<profile>/.dsh-blueprint/snapshots`. */
  dir: string;
  /** Root that captured paths are recorded relative to. */
  root: string;
}
/**
 * Capture the current state of `paths` before anything mutates them.
 *
 * A file that does not exist is captured as absent — restoring later removes
 * it rather than leaving whatever the failed install created. That case is
 * why "restore" cannot be a plain copy loop: `dsh plugin add` on a fresh
 * profile creates files that have no pre-install content at all.
 */
declare function takeSnapshot(store: SnapshotStore, label: string, paths: string[], kind?: SnapshotKind): Promise<SnapshotManifest>;
/** Manifests, newest first. A directory without a readable manifest is skipped. */
declare function listSnapshots(store: SnapshotStore): Promise<SnapshotManifest[]>;
/**
 * Compare the live files against a snapshot without changing anything.
 * Returns the relative paths that differ. Empty means byte-equivalent.
 */
declare function diffAgainstSnapshot(store: SnapshotStore, manifest: SnapshotManifest): Promise<string[]>;
interface RestoreResult {
  restored: string[];
  removed: string[];
  /** Where the pre-restore state was preserved. Failed evidence is not destroyed. */
  evidence: SnapshotManifest;
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
declare function restoreSnapshot(store: SnapshotStore, manifest: SnapshotManifest): Promise<RestoreResult>;
/**
 * Drop old snapshots, newest kept. Captures and evidence have separate
 * budgets on purpose: routine pruning of pre-install captures must not
 * silently discard the record of a transaction that failed.
 *
 * A bare number applies to captures and leaves evidence untouched.
 */
declare function pruneSnapshots(store: SnapshotStore, keep: number | {
  captures?: number;
  evidence?: number;
}): Promise<string[]>;
/** Size on disk of one snapshot, for display. */
declare function snapshotBytes(store: SnapshotStore, manifest: SnapshotManifest): Promise<number>;
/** Copy of a snapshot's captured content for one path, or null if absent. */
declare function snapshotContent(store: SnapshotStore, manifest: SnapshotManifest, path: string): Promise<Buffer | null>;
/** Re-export for callers that keep their own copies. */
declare function copySnapshotTo(store: SnapshotStore, manifest: SnapshotManifest, destination: string): Promise<void>;
//#endregion
export { BLOCK_END, BLOCK_START, type BlockOwner, type CordisInsertOp, type CordisPatchOp, type CordisRow, type ManagedSplit, type PreflightFinding, type PreflightLevel, type RestoreResult, type SnapshotEntry, type SnapshotKind, type SnapshotManifest, type SnapshotStore, composePatchFile, copySnapshotTo, diffAgainstSnapshot, diffLines, hasManagedBlock, isBarePackage, isInsertOp, isInstalled, listSnapshots, packageNameOf, preflightOps, presetProblem, pruneSnapshots, restoreSnapshot, revisionOf, snapshotBytes, snapshotContent, splitManagedBlock, takeSnapshot };