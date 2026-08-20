/**
 * What each plugin in an overlay says it may do, read before the row is written.
 *
 * A gate can hold an agent to a manifest, but not a plugin: `apply()` runs
 * in-process with full privileges the moment the row loads, before any tool
 * call exists. The one point where that is still a choice is here, so this
 * surfaces the declaration alongside the resolvability preflight rather than
 * leaving it for someone to go and read.
 *
 * It reports and never blocks. Whether an unmanifested plugin is acceptable is
 * a deployment decision, and today almost none carry a manifest — refusing them
 * would make the check useless on contact with a real profile.
 */

import { join } from 'node:path'
import {
  type CordisPatchOp,
  isInsertOp,
  isBarePackage,
  packageNameOf,
  type PreflightFinding,
} from 'dsh-overlay-check'
import { discover, review } from 'capmark'

/** Where a profile's packages live, mirroring `isInstalled`'s search. */
function candidateDirs(profileDir: string, name: string): string[] {
  return [
    join(profileDir, 'node_modules', name),
    join(profileDir, '..', 'node_modules', name),
  ]
}

/**
 * Describe the capabilities each inserted row's package declares.
 *
 * @param profileDir - the profile the overlay would be applied to.
 * @param ops - the compiled patch operations about to be written.
 */
export function reviewRowCapabilities(
  profileDir: string,
  ops: CordisPatchOp[],
): PreflightFinding[] {
  const findings: PreflightFinding[] = []
  const seen = new Set<string>()

  for (const op of ops) {
    const rows = isInsertOp(op) ? op.insert : [op]
    for (const row of rows) {
      const specifier = row.name
      if (typeof specifier !== 'string' || !isBarePackage(specifier)) continue
      const name = packageNameOf(specifier)
      // One row per package: an overlay that inserts three rows from the same
      // package is still one installation decision.
      if (seen.has(name)) continue
      seen.add(name)

      for (const dir of candidateDirs(profileDir, name)) {
        const found = discover(dir)
        if (found.kind === 'absent') continue

        const result = review(found, name)
        if (result.findings.some((f) => f.severity === 'error')) {
          findings.push({
            level: 'warning',
            code: 'capability-manifest-invalid',
            text: `"${name}" ships a capability manifest that does not parse, which reads as a security claim while making none: ${result.findings
              .filter((f) => f.severity === 'error')
              .map((f) => f.message)
              .join('; ')}`,
          })
          break
        }

        const risky = result.grants.filter((g) => g.highRisk).map((g) => g.capability)
        const granted = result.grants.map((g) => g.capability).join(', ') || 'nothing'
        findings.push({
          level: 'warning',
          code: risky.length > 0 ? 'capability-high-risk' : 'capability-declared',
          text:
            risky.length > 0
              ? `"${name}" declares ${granted}. ${risky.join(' and ')} hand over broad control — read its manifest before applying.`
              : `"${name}" declares ${granted}.`,
        })
        break
      }
    }
  }

  return findings
}
