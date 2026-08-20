/**
 * Checks that what we publish keeps the promises its manifest makes.
 *
 * `dsh-blueprint` 0.5.2 shipped with `exports["."].types` naming
 * `lib/types/index.d.ts`, a file no build step ever produced — confirmed by
 * downloading the published tarball, not by reading this repo's history. The
 * package still worked, because the missing file was only the types entry, so
 * nothing failed loudly enough to notice.
 *
 * So this packs each publishable package the way a publish would, then reads
 * the manifest and file list out of the tarball rather than off disk, and
 * asserts every entry point resolves to a file that is actually inside it.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Packages that are published. Workspace-internal ones ship as source. */
const PACKAGES = ['packages/blueprint', 'packages/overlay-check']

let failures = 0
const fail = (pkg, message) => {
  console.error(`  x ${pkg}: ${message}`)
  failures += 1
}

for (const dir of PACKAGES) {
  const work = mkdtempSync(join(tmpdir(), 'verify-pack-'))
  try {
    const out = execFileSync('pnpm', ['pack', '--pack-destination', work], {
      cwd: dir,
      encoding: 'utf8',
    })
    const tarball = out.trim().split('\n').pop()
    const files = new Set(
      execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/^package\//, '')),
    )
    execFileSync('tar', ['-xzf', tarball, '-C', work, 'package/package.json'])
    const manifest = JSON.parse(
      readFileSync(join(work, 'package/package.json'), 'utf8'),
    )
    const name = manifest.name

    const check = (label, value) => {
      if (value === undefined) return
      const path = String(value).replace(/^\.\//, '')
      if (!files.has(path))
        fail(name, `${label} -> ${value} is not in the tarball`)
    }

    check('main', manifest.main)
    check('types', manifest.types)
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      if (typeof value === 'string') check(`exports["${key}"]`, value)
      else
        for (const [cond, target] of Object.entries(value)) {
          check(`exports["${key}"].${cond}`, target)
        }
    }
    for (const [key, value] of Object.entries(manifest.bin ?? {})) {
      check(`bin["${key}"]`, value)
    }

    // A workspace protocol that survives publication cannot be installed.
    for (const field of ['dependencies', 'peerDependencies']) {
      for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
        if (String(range).startsWith('workspace:')) {
          fail(name, `${field}["${dep}"] is still "${range}"`)
        }
      }
    }

    if (!files.has('README.md'))
      fail(name, 'no README.md — that is the npm landing page')
    if (!files.has('LICENSE')) fail(name, 'no LICENSE')

    console.log(
      `  ${name}@${manifest.version}: ${files.size} files, entry points resolve`,
    )
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (failures > 0) {
  console.error(`\n${failures} packaging problem(s). Do not publish.`)
  process.exit(1)
}
console.log('\npackaging ok')
