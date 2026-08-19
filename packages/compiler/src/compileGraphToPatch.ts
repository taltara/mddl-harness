import {
  type GraphDocument,
  isCatalogToolRowId,
  type OrchestratorNodeData,
} from '@mddl/graph-schema'
import type { CordisPatchOp, CordisRow } from './types.ts'

function connectedSourceIds(
  graph: GraphDocument,
  agentId: string,
): Set<string> {
  return new Set(
    graph.edges
      .filter((edge) => edge.target === agentId)
      .map((edge) => edge.source),
  )
}

function compileModel(
  data: Extract<OrchestratorNodeData, { kind: 'model' }>,
): CordisRow {
  return {
    id: data.rowId,
    config: {
      provider: data.provider,
      model: data.model,
    },
  }
}

function compileTool(
  data: Extract<OrchestratorNodeData, { kind: 'tool' }>,
  wired: boolean,
): CordisPatchOp | undefined {
  const inBase = isCatalogToolRowId(data.rowId)
  if (!data.enabled || !wired) {
    // Only dsh-base rows can be disabled. An off custom tool is never
    // inserted, so a disable row would address an id that does not exist.
    return inBase ? { id: data.rowId, disabled: true } : undefined
  }
  if (inBase) {
    return undefined
  }
  return {
    id: data.rowId,
    name: data.packageName,
  }
}

function compileAgentLoop(
  data: Extract<OrchestratorNodeData, { kind: 'agentLoop' }>,
): CordisRow | undefined {
  if (data.persona.trim() === '') {
    return undefined
  }
  return {
    id: data.systemPromptRowId,
    config: { persona: data.persona },
  }
}

/**
 * Compile a studio graph into a DeepSeek Harness patch overlay.
 * Catalog tools that stay enabled and wired emit nothing — they already live in dsh-base.
 */
export function compileGraphToPatch(graph: GraphDocument): CordisPatchOp[] {
  const agent = graph.nodes.find((node) => node.data.kind === 'agentLoop')
  const wiredIds = agent
    ? connectedSourceIds(graph, agent.id)
    : new Set<string>()
  const ops: CordisPatchOp[] = []
  const inserts: CordisRow[] = []

  for (const node of graph.nodes) {
    switch (node.data.kind) {
      case 'model': {
        if (agent && !wiredIds.has(node.id)) {
          break
        }
        ops.push(compileModel(node.data))
        break
      }
      case 'tool': {
        const wired = !agent || wiredIds.has(node.id)
        const op = compileTool(node.data, wired)
        if (op === undefined) {
          break
        }
        if ('name' in op && op.name !== undefined) {
          inserts.push(op)
          break
        }
        ops.push(op)
        break
      }
      case 'agentLoop': {
        const op = compileAgentLoop(node.data)
        if (op !== undefined) {
          ops.push(op)
        }
        break
      }
      default: {
        const _exhaustive: never = node.data
        throw new Error(`Unhandled node kind: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  if (inserts.length > 0) {
    ops.push({ insert: inserts })
  }

  return ops
}
