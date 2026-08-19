import { DSH_APPLY_COMMAND, DSH_WEB_URL } from './summarizeGraph.ts'
import type { OverlaySummary } from './summarizeGraph.ts'
import { isInsertOp, type CordisPatchOp, type CordisRow } from './types.ts'

function emitScalar(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'null'
  }
  throw new Error(`Unsupported YAML scalar: ${typeof value}`)
}

function emitConfig(
  config: Record<string, unknown>,
  indent: string,
): string[] {
  return Object.entries(config).map(
    ([key, value]) => `${indent}${key}: ${emitScalar(value)}`,
  )
}

function emitRow(row: CordisRow, indent: string): string[] {
  const lines = [`${indent}- id: ${row.id}`]
  const child = `${indent}  `
  if (row.name !== undefined) {
    lines.push(`${child}name: ${emitScalar(row.name)}`)
  }
  if (row.inject !== undefined && row.inject.length > 0) {
    lines.push(`${child}inject: [${row.inject.map((item) => emitScalar(item)).join(', ')}]`)
  }
  if (row.disabled === true) {
    lines.push(`${child}disabled: true`)
  }
  if (row.config !== undefined && Object.keys(row.config).length > 0) {
    lines.push(`${child}config:`)
    lines.push(...emitConfig(row.config, `${child}  `))
  }
  return lines
}

function emitSummaryComments(summary: OverlaySummary): string[] {
  const lines: string[] = []
  const keep = summary.facts.filter((fact) => fact.kind === 'keep')
  const change = summary.facts.filter((fact) => fact.kind === 'change')
  const notes = summary.facts.filter((fact) => fact.kind === 'note')
  if (keep.length > 0) {
    lines.push('# Unchanged dsh-base rows:')
    for (const fact of keep) {
      lines.push(`#   ${fact.text}`)
    }
  }
  if (change.length > 0) {
    lines.push('# Patch rows below:')
    for (const fact of change) {
      lines.push(`#   ${fact.text}`)
    }
  }
  if (notes.length > 0) {
    lines.push('# Notes:')
    for (const fact of notes) {
      lines.push(`#   ${fact.text}`)
    }
  }
  if (lines.length > 0) {
    lines.push('')
  }
  return lines
}

export function emitPatchYaml(
  ops: CordisPatchOp[],
  summary?: OverlaySummary,
): string {
  const lines = [
    '# Overlay for DeepSeek Harness. This is a patch, not a full profile.',
    '# --patch is resolved from your terminal cwd, not the studio.',
    '# Relative ./ paths fail if you are in ~. Use an absolute path.',
    `# After Export: ${DSH_APPLY_COMMAND}`,
    `# Then open ${DSH_WEB_URL}`,
    '',
  ]

  if (summary !== undefined) {
    lines.push(...emitSummaryComments(summary))
  }

  if (ops.length === 0) {
    lines.push('# Empty overlay — the graph matches dsh-base defaults.')
    lines.push('[]')
    lines.push('')
    return lines.join('\n')
  }

  for (const op of ops) {
    if (isInsertOp(op)) {
      lines.push('- insert:')
      for (const row of op.insert) {
        lines.push(...emitRow(row, '    '))
      }
      lines.push('')
      continue
    }
    lines.push(...emitRow(op, ''))
    lines.push('')
  }

  return lines.join('\n')
}
