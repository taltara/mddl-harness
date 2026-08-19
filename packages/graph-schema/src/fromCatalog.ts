import {
  AGENT_LOOP_ENTRY,
  findToolCatalogEntry,
  MODEL_CATALOG,
} from './catalog.ts'
import type { GraphNode, GraphPosition } from './types.ts'

export function agentLoopNode(id: string, position: GraphPosition): GraphNode {
  return {
    id,
    type: 'agentLoop',
    position,
    data: {
      kind: 'agentLoop',
      label: AGENT_LOOP_ENTRY.label,
      rowId: AGENT_LOOP_ENTRY.rowId,
      systemPromptRowId: AGENT_LOOP_ENTRY.systemPromptRowId,
      persona: '',
      status: 'idle',
    },
  }
}

export function toolNodeFromCatalog(
  rowId: string,
  id: string,
  position: GraphPosition,
): GraphNode {
  const entry = findToolCatalogEntry(rowId)
  if (entry === undefined) {
    throw new Error(`Unknown catalog tool: ${rowId}`)
  }
  return {
    id,
    type: 'tool',
    position,
    data: {
      kind: 'tool',
      label: entry.label,
      rowId: entry.rowId,
      packageName: entry.packageName,
      enabled: true,
      status: 'idle',
    },
  }
}

export function modelNodeFromCatalog(
  model: string,
  id: string,
  position: GraphPosition,
): GraphNode {
  const entry = MODEL_CATALOG.find((item) => item.model === model)
  if (entry === undefined) {
    throw new Error(`Unknown catalog model: ${model}`)
  }
  return {
    id,
    type: 'model',
    position,
    data: {
      kind: 'model',
      label: entry.label,
      rowId: entry.rowId,
      adapterPackage: entry.adapterPackage,
      provider: entry.provider,
      model: entry.model,
      status: 'idle',
    },
  }
}
