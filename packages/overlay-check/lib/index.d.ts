//#region src/patchFile.d.ts
/**
 * Blueprint owns one marker-delimited region of the profile's
 * `cordis.patch.yml` and nothing else. Everything outside the markers — hand
 * written rows, comments, `!!js` expressions — survives byte for byte, because
 * a config file a GUI cannot share is a config file people stop hand editing.
 */
declare const BLOCK_START = "# >>> dsh-blueprint managed block";
declare const BLOCK_END = "# <<< dsh-blueprint managed block";
interface ManagedSplit {
  /** Everything before the block. Empty when the file has no block yet. */
  before: string;
  /** The rows Blueprint owns, without the markers. Undefined when absent. */
  managed: string | undefined;
  /** Everything after the block. */
  after: string;
}
declare function splitManagedBlock(source: string): ManagedSplit;
/** Whether a file already carries a Blueprint block. */
declare function hasManagedBlock(source: string): boolean;
/**
 * Rebuild a patch file with `rows` as the managed block, leaving every other
 * byte where it was. Passing empty rows removes the block entirely.
 */
declare function composePatchFile(source: string, rows: string): string;
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
export { BLOCK_END, BLOCK_START, type CordisInsertOp, type CordisPatchOp, type CordisRow, type ManagedSplit, type PreflightFinding, type PreflightLevel, composePatchFile, diffLines, hasManagedBlock, isBarePackage, isInsertOp, isInstalled, packageNameOf, preflightOps, presetProblem, revisionOf, splitManagedBlock };