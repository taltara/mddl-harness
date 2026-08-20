/**
 * Offline safety checks for DeepSeek Harness overlays.
 *
 * A row naming a package the profile cannot load does not degrade — Cordis
 * fails module resolution during boot, so the harness does not start at all
 * and every tool you would debug with is gone. That makes the interesting
 * checks the ones that run *before* a write, which is what this package is.
 *
 * Node only, no dependencies, no opinion about how you edit config.
 */

export type { ManagedSplit } from './patchFile.ts'
export {
  BLOCK_END,
  BLOCK_START,
  composePatchFile,
  diffLines,
  hasManagedBlock,
  revisionOf,
  splitManagedBlock,
} from './patchFile.ts'
export type {
  CordisInsertOp,
  CordisPatchOp,
  CordisRow,
  PreflightFinding,
  PreflightLevel,
} from './preflight.ts'
export {
  isBarePackage,
  isInsertOp,
  isInstalled,
  packageNameOf,
  preflightOps,
  presetProblem,
} from './preflight.ts'
export type {
  RestoreResult,
  SnapshotEntry,
  SnapshotManifest,
  SnapshotStore,
} from './snapshot.ts'
export {
  copySnapshotTo,
  diffAgainstSnapshot,
  listSnapshots,
  pruneSnapshots,
  restoreSnapshot,
  snapshotBytes,
  snapshotContent,
  takeSnapshot,
} from './snapshot.ts'
