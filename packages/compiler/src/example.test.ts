import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { starterGraph } from '@mddl/graph-schema'
import { describe, expect, it } from 'vitest'
import { compileGraphToYaml } from './index.ts'

const exampleFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../examples/cordis.patch.yml',
)

describe('examples/cordis.patch.yml', () => {
  it('matches the current compiler output for the starter graph', () => {
    expect(readFileSync(exampleFile, 'utf8')).toEqual(
      compileGraphToYaml(starterGraph),
    )
  })
})
