import type { GraphDocument } from '@mddl/graph-schema'

/**
 * Compile a graph into an agent preset (`agent.cordis.yml`).
 *
 * This is the half a web session actually feels. A host overlay sets the
 * default model and the host plane, but the tools a session gets come from its
 * preset — which is why a canvas that only ever emitted host rows could never
 * change what happened in Chat.
 *
 * The shape follows the shipped `standard` preset: a persona row, then one
 * flat row per tool.
 */
export function compileGraphToPreset(graph: GraphDocument): string {
  const agent = graph.nodes.find((node) => node.data.kind === 'agentLoop')
  const wired = new Set(
    graph.edges
      .filter((edge) => agent === undefined || edge.target === agent.id)
      .map((edge) => edge.source),
  )

  const lines: string[] = [
    '# Agent preset compiled by mddl blueprint.',
    '# Tools a web session gets come from its preset, not from a host overlay.',
    '',
  ]

  const persona =
    agent !== undefined && agent.data.kind === 'agentLoop'
      ? agent.data.persona.trim()
      : ''
  if (persona !== '') {
    lines.push(
      '- id: persona',
      "  name: '@deepseek-ai/dsh-persona'",
      '  config:',
    )
    lines.push(`    text: ${blockScalar(persona, 6)}`)
    lines.push('')
  }

  for (const node of graph.nodes) {
    if (node.data.kind !== 'tool') {
      continue
    }
    if (!node.data.enabled) {
      continue
    }
    if (agent !== undefined && !wired.has(node.id)) {
      continue
    }
    lines.push(`- id: ${node.data.rowId}`)
    lines.push(`  name: '${node.data.packageName}'`)
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

/**
 * Multi-line personas need a block scalar; a single line stays inline. `|-`
 * keeps the text verbatim and drops only the trailing newline.
 */
function blockScalar(value: string, indent: number): string {
  if (!value.includes('\n')) {
    return JSON.stringify(value)
  }
  const pad = ' '.repeat(indent)
  const body = value
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n')
  return `|-\n${body}`
}

/** The `preset.yml` beside the composition: what the picker shows. */
export function compilePresetManifest(
  name: string,
  description: string,
): string {
  return [
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    'order: 50',
    '',
  ].join('\n')
}

/** Preset ids are a directory name: `[a-z0-9][a-z0-9-]*`. */
export function isPresetId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id)
}
