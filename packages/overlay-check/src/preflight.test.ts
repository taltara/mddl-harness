import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  isBarePackage,
  isInstalled,
  packageNameOf,
  preflightOps,
} from './preflight.ts'

let profileDir = ''

beforeAll(async () => {
  profileDir = await mkdtemp(join(tmpdir(), 'blueprint-preflight-'))
  const installed = join(profileDir, 'node_modules', '@scope', 'present')
  await mkdir(installed, { recursive: true })
  await writeFile(join(installed, 'package.json'), '{"name":"@scope/present"}')
})

describe('packageNameOf', () => {
  it('keeps the scope and drops the subpath', () => {
    expect(packageNameOf('@scope/pkg/sub/path')).toBe('@scope/pkg')
    expect(packageNameOf('pkg/sub')).toBe('pkg')
    expect(packageNameOf('pkg')).toBe('pkg')
  })
})

describe('isBarePackage', () => {
  it('accepts an npm specifier', () => {
    expect(isBarePackage('@deepseek-ai/dsh-tool-bash')).toBe(true)
  })

  it('rejects builtins and file paths, which are not installed packages', () => {
    expect(isBarePackage('cordis:include')).toBe(false)
    expect(isBarePackage('./local.js')).toBe(false)
    expect(isBarePackage('/abs/path.js')).toBe(false)
    expect(isBarePackage('')).toBe(false)
  })
})

describe('isInstalled', () => {
  it('finds a package present in the profile', async () => {
    expect(await isInstalled(profileDir, '@scope/present')).toBe(true)
  })

  it('finds it through a subpath specifier', async () => {
    expect(await isInstalled(profileDir, '@scope/present/client')).toBe(true)
  })

  it('reports a missing package', async () => {
    expect(await isInstalled(profileDir, '@scope/absent')).toBe(false)
  })
})

describe('preflightOps', () => {
  it('passes rows that only patch existing ids', async () => {
    const findings = await preflightOps(profileDir, [
      { id: 'agent-default-model', config: { model: 'x' } },
    ])
    expect(findings).toEqual([])
  })

  it('blocks an insert naming a package the profile cannot load', async () => {
    // This is the one that bricks a harness: Cordis fails module resolution
    // during boot, so nothing starts and the only way back is editing YAML.
    const findings = await preflightOps(profileDir, [
      { insert: [{ id: 'x', name: '@scope/absent' }] },
    ])
    expect(findings).toHaveLength(1)
    expect(findings[0]?.level).toBe('blocking')
    expect(findings[0]?.code).toBe('module-not-installed')
    expect(findings[0]?.text).toContain('@scope/absent')
  })

  it('allows an insert whose package is installed', async () => {
    const findings = await preflightOps(profileDir, [
      { insert: [{ id: 'x', name: '@scope/present' }] },
    ])
    expect(findings).toEqual([])
  })

  it('ignores cordis builtins, which are not npm packages', async () => {
    const findings = await preflightOps(profileDir, [
      { insert: [{ id: 'g', name: 'cordis:group' }] },
    ])
    expect(findings).toEqual([])
  })

  it('warns when inserting an id the running tree already has', async () => {
    const findings = await preflightOps(
      profileDir,
      [{ insert: [{ id: 'tool-bash', name: '@scope/present' }] }],
      new Set(['tool-bash']),
    )
    expect(findings.map((f) => f.code)).toContain('insert-over-existing')
    expect(findings.every((f) => f.level === 'warning')).toBe(true)
  })
})

describe('config the harness overwrites at boot', () => {
  it('warns that agent-presets.roots does nothing', async () => {
    const findings = await preflightOps('/nowhere', [
      { id: 'agent-presets', config: { roots: [{ path: '/my/presets' }] } },
    ])
    const f = findings.find((x) => x.code === 'config-silently-overwritten')
    expect(f?.level).toBe('warning')
    expect(f?.text).toContain('$DSH_HOME/.agent-presets')
  })

  it('says nothing about other agent-presets config, which is kept', async () => {
    // composeProfile spreads the existing config and replaces only `roots`.
    const findings = await preflightOps('/nowhere', [
      { id: 'agent-presets', config: { default: 'standard' } },
    ])
    expect(findings.some((x) => x.code === 'config-silently-overwritten')).toBe(
      false,
    )
  })

  it('catches it inside an insert batch too', async () => {
    const findings = await preflightOps('/nowhere', [
      { insert: [{ id: 'agent-presets', config: { roots: [] } }] },
    ])
    expect(findings.some((x) => x.code === 'config-silently-overwritten')).toBe(
      true,
    )
  })
})
