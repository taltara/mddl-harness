import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { starterGraph } from '@mddl/graph-schema'
import { compileGraphToYaml } from '../src/index.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const outFile = join(repoRoot, 'examples/cordis.patch.yml')

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, compileGraphToYaml(starterGraph))
process.stdout.write(`${outFile}\n`)
