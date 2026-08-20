import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { reviewRowCapabilities } from './reviewRows.ts'

/** A profile directory with packages installed the way pnpm leaves them. */
function profile(pkgs: Record<string, string | null>): string {
  const dir = mkdtempSync(join(tmpdir(), 'blueprint-review-'))
  for (const [name, manifest] of Object.entries(pkgs)) {
    const pkgDir = join(dir, 'node_modules', name)
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name }))
    if (manifest !== null) writeFileSync(join(pkgDir, 'CAP.md'), manifest)
  }
  return dir
}

const READER = `---
capmark: 0.1
plugin: quiet-plugin
---
\`\`\`cap
grant fs:read
\`\`\`
`

const SHELL = `---
capmark: 0.1
plugin: loud-plugin
---
\`\`\`cap
grant proc:spawn
\`\`\`

Runs the project's build.
`

const insert = (...names: string[]) => [
  { insert: names.map((name, i) => ({ id: `row-${i}`, name })) },
]

describe('reviewRowCapabilities', () => {
  it('reports what a plugin declares before its row is written', () => {
    const dir = profile({ 'quiet-plugin': READER })
    const findings = reviewRowCapabilities(dir, insert('quiet-plugin'))
    expect(findings).toHaveLength(1)
    expect(findings[0]?.code).toBe('capability-declared')
    expect(findings[0]?.text).toContain('fs:read')
  })

  it('calls out a grant that hands over broad control', () => {
    const dir = profile({ 'loud-plugin': SHELL })
    const findings = reviewRowCapabilities(dir, insert('loud-plugin'))
    expect(findings[0]?.code).toBe('capability-high-risk')
    expect(findings[0]?.text).toContain('proc:spawn')
  })

  it('says nothing about a package with no manifest', () => {
    // Almost nothing carries one today. A finding per unmanifested plugin
    // would bury the ones that do say something.
    const dir = profile({ 'plain-plugin': null })
    expect(reviewRowCapabilities(dir, insert('plain-plugin'))).toEqual([])
  })

  it('flags a manifest that does not parse, which is worse than none', () => {
    const dir = profile({ 'broken-plugin': '# not a manifest\n' })
    const findings = reviewRowCapabilities(dir, insert('broken-plugin'))
    expect(findings[0]?.code).toBe('capability-manifest-invalid')
  })

  it('never blocks, since refusing unmanifested plugins would break every profile', () => {
    const dir = profile({ 'loud-plugin': SHELL, 'broken-plugin': '# nope\n' })
    const findings = reviewRowCapabilities(
      dir,
      insert('loud-plugin', 'broken-plugin'),
    )
    expect(findings.every((f) => f.level === 'warning')).toBe(true)
  })

  it('reports one finding per package, not per row', () => {
    const dir = profile({ 'quiet-plugin': READER })
    const findings = reviewRowCapabilities(
      dir,
      insert('quiet-plugin', 'quiet-plugin'),
    )
    // Two rows from one package is still one installation decision.
    expect(findings).toHaveLength(1)
  })

  it('resolves a subpath specifier to its owning package', () => {
    const dir = profile({ 'quiet-plugin': READER })
    const findings = reviewRowCapabilities(dir, insert('quiet-plugin/client'))
    expect(findings).toHaveLength(1)
  })

  it('ignores rows that name no package at all', () => {
    const dir = profile({})
    expect(
      reviewRowCapabilities(dir, [{ id: 'config-only', config: {} }]),
    ).toEqual([])
  })
})
