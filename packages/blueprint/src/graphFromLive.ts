import {
  agentLoopNode,
  findToolCatalogEntry,
  type GraphDocument,
  type GraphNode,
  MODEL_CATALOG,
} from '@mddl/graph-schema'
import type { LiveEntry } from './live.ts'

const COLUMN_X = 80
const AGENT_X = 520
const ROW_HEIGHT = 140

export interface ImportResult {
  graph: GraphDocument
  /** Live entries the canvas cannot express, so the UI can say so. */
  skipped: string[]
}

/**
 * Project the running tree onto a canvas.
 *
 * A booted harness carries far more than the canvas models — storage, the web
 * shell, telemetry. Importing all of it would produce a diagram nobody can
 * read and, worse, a graph that compiles into an overlay touching rows the
 * user never chose. So this takes the rows the catalog understands and reports
 * the rest by name rather than pretending they were imported.
 */
export function graphFromLive(entries: LiveEntry[]): ImportResult {
  const nodes: GraphNode[] = []
  const skipped: string[] = []
  let row = 0

  const model = entries.find((entry) => entry.id === 'agent-default-model')
  if (model !== undefined) {
    const configured =
      typeof model.config?.model === 'string' ? model.config.model : undefined
    const entry =
      MODEL_CATALOG.find((item) => item.model === configured) ??
      MODEL_CATALOG[0]
    if (entry !== undefined) {
      nodes.push({
        id: 'model-default',
        type: 'model',
        position: { x: COLUMN_X, y: row * ROW_HEIGHT },
        data: {
          kind: 'model',
          label: entry.label,
          rowId: entry.rowId,
          adapterPackage: entry.adapterPackage,
          provider: entry.provider,
          model: configured ?? entry.model,
          status: 'idle',
        },
      })
      row += 1
    }
  }

  const seen = new Set<string>()
  for (const entry of entries) {
    const known = findToolCatalogEntry(entry.id)
    if (known === undefined || seen.has(entry.id)) {
      continue
    }
    seen.add(entry.id)
    nodes.push({
      id: entry.id,
      type: 'tool',
      position: { x: COLUMN_X, y: row * ROW_HEIGHT },
      data: {
        kind: 'tool',
        label: known.label,
        rowId: known.rowId,
        packageName: known.packageName,
        enabled: !entry.disabled,
        status: 'idle',
      },
    })
    row += 1
  }

  for (const entry of entries) {
    if (!seen.has(entry.id) && entry.id !== 'agent-default-model') {
      skipped.push(entry.id)
    }
  }

  const agent = agentLoopNode('agent-loop', {
    x: AGENT_X,
    y: Math.max(0, ((row - 1) * ROW_HEIGHT) / 2),
  })
  nodes.push(agent)

  // Only enabled rows are wired: an imported graph should compile back to the
  // config it came from, and an unwired node is how the canvas says "off".
  const edges = nodes
    .filter((node) => node.data.kind !== 'agentLoop')
    .filter((node) => node.data.kind !== 'tool' || node.data.enabled === true)
    .map((node) => ({
      id: `e-${node.id}-agent`,
      source: node.id,
      target: agent.id,
      sourceHandle: 'out',
      targetHandle: 'in',
    }))

  return { graph: { version: 1, nodes, edges }, skipped }
}
