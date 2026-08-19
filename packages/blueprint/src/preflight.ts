import { access } from 'node:fs/promises'
import { join } from 'node:path'
import type { CordisPatchOp } from '@mddl/compiler'
import { isInsertOp } from '@mddl/compiler'

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

  return findings
}
