import { access } from 'node:fs/promises'
import { join } from 'node:path'
/** One Cordis row. Declared here so this package pulls in nothing. */
export interface CordisRow {
  id: string
  name?: string
  disabled?: boolean
  config?: Record<string, unknown>
}

/** A patch op is either a row to replace, or a batch of rows to insert. */
export interface CordisInsertOp {
  insert: CordisRow[]
}

export type CordisPatchOp = CordisRow | CordisInsertOp

export function isInsertOp(op: CordisPatchOp): op is CordisInsertOp {
  return 'insert' in op
}

export type PreflightLevel = 'blocking' | 'warning'

export interface PreflightFinding {
  level: PreflightLevel
  code: string
  text: string
}

/** `@scope/pkg/sub` → `@scope/pkg`; `pkg/sub` → `pkg`. */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split('/')
  if (specifier.startsWith('@')) {
    return parts.slice(0, 2).join('/')
  }
  return parts[0] ?? specifier
}

/** Cordis builtins and relative files are not npm packages. */
export function isBarePackage(specifier: string): boolean {
  return (
    specifier !== '' &&
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !specifier.includes(':')
  )
}

/**
 * Whether the profile can actually load this package.
 *
 * Presence is checked rather than `require.resolve`, because an ESM-only
 * package that exports no `require` condition resolves fine for the loader
 * and throws here — a false alarm on a package that works.
 */
export async function isInstalled(
  profileDir: string,
  specifier: string,
): Promise<boolean> {
  const name = packageNameOf(specifier)
  // pnpm links the package into the profile, and the profile root is where
  // `dsh plugin add` installs, so one level is the honest place to look.
  for (const dir of [profileDir, join(profileDir, '..')]) {
    try {
      await access(join(dir, 'node_modules', name, 'package.json'))
      return true
    } catch {
      // Try the next location.
    }
  }
  return false
}

/**
 * Check an overlay before it is written.
 *
 * A row naming a package the profile cannot load does not degrade — it is
 * fatal. Cordis fails module resolution during boot, so the harness does not
 * start at all and the only way back is editing YAML by hand. That makes this
 * the one check worth blocking a write over, rather than reporting afterwards
 * on a live tree that will never exist.
 */
export async function preflightOps(
  profileDir: string,
  ops: CordisPatchOp[],
  liveIds: Set<string> = new Set(),
): Promise<PreflightFinding[]> {
  const findings: PreflightFinding[] = []

  for (const op of ops) {
    const rows = isInsertOp(op) ? op.insert : [op]
    for (const row of rows) {
      const name = row.name
      if (typeof name !== 'string' || !isBarePackage(name)) {
        continue
      }
      if (await isInstalled(profileDir, name)) {
        continue
      }
      findings.push({
        level: 'blocking',
        code: 'module-not-installed',
        text: `"${name}" is not installed in this profile. Applying this would stop the harness booting at all, not just disable the row. Install it first: dsh plugin --profile <name> add ${name}`,
      })
    }
  }

  for (const op of ops) {
    if (isInsertOp(op)) {
      for (const row of op.insert) {
        if (liveIds.has(row.id)) {
          findings.push({
            level: 'warning',
            code: 'insert-over-existing',
            text: `"${row.id}" already exists in the running tree, so inserting it again is likely to collide rather than add.`,
          })
        }
      }
    }
  }

  findings.push(...overwrittenConfig(ops))

  return findings
}

/**
 * Config the harness accepts, records, and then throws away.
 *
 * `composeProfile` appends its own overlay for the `agent-presets` row that
 * spreads whatever config reached it and then hard-replaces `roots` with the
 * shipped root alone. Anything you set there is gone before the loader sees it.
 *
 * What makes this worth a rule rather than a doc note is that the obvious way
 * to check your work agrees with you: the override is appended AFTER the
 * composition `--dump-config` prints, so the dump shows your value and the
 * runtime uses another. Reported upstream in deepseek-harness#403 and
 * corroborated on 0.1.0-rc.7 and 0.1.1-rc.2.
 */
function overwrittenConfig(ops: CordisPatchOp[]): PreflightFinding[] {
  const findings: PreflightFinding[] = []
  for (const op of ops) {
    const rows = isInsertOp(op) ? op.insert : [op]
    for (const row of rows) {
      if (row.id !== 'agent-presets') continue
      if (row.config === undefined || !('roots' in row.config)) continue
      findings.push({
        level: 'warning',
        code: 'config-silently-overwritten',
        text: '"agent-presets.roots" is replaced at boot with the shipped root, so setting it here does nothing — and --dump-config will still show your value, because the override is applied after the composition it prints. Put presets in $DSH_HOME/.agent-presets/<id>/ instead: that root is appended separately and is not affected. See deepseek-harness#403.',
      })
    }
  }
  return findings
}

/**
 * Why the harness would call a preset composition broken, or undefined when it
 * looks loadable.
 *
 * Discovery treats a preset whose composition is missing or is not a list of
 * named plugin rows as broken, and it is unmemoized — a bad preset is visible
 * in the picker immediately. Checking our own output is enough here, because
 * the composition is compiler-generated rather than user text.
 */
export function presetProblem(composition: string): string | undefined {
  const rows = composition
    .split('\n')
    .filter((line) => line.startsWith('- id:'))
  if (rows.length === 0) {
    return 'the composition has no plugin rows, so the preset would list as broken'
  }
  const named = composition
    .split('\n')
    .filter((line) => line.trimStart().startsWith('name:'))
  if (named.length < rows.length) {
    return 'every row needs a name, or the preset lists as broken'
  }
  return undefined
}
