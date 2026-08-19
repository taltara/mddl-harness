import type {
  AgentLoopCatalogEntry,
  ModelCatalogEntry,
  OrchestratorNodeData,
  ToolCatalogEntry,
} from '@mddl/graph-schema'

export const PALETTE_MIME = 'application/mddl-node'

export type PaletteItem =
  | { kind: 'model'; entry: ModelCatalogEntry }
  | { kind: 'tool'; entry: ToolCatalogEntry }
  | { kind: 'agentLoop'; entry: AgentLoopCatalogEntry }

export function createNodeId(kind: PaletteItem['kind']): string {
  return `${kind}-${crypto.randomUUID().slice(0, 8)}`
}

export function createNodeData(item: PaletteItem): OrchestratorNodeData {
  switch (item.kind) {
    case 'model':
      return {
        kind: 'model',
        label: item.entry.label,
        rowId: item.entry.rowId,
        adapterPackage: item.entry.adapterPackage,
        provider: item.entry.provider,
        model: item.entry.model,
        status: 'idle',
      }
    case 'tool':
      return {
        kind: 'tool',
        label: item.entry.label,
        rowId: item.entry.rowId,
        packageName: item.entry.packageName,
        enabled: true,
        status: 'idle',
      }
    case 'agentLoop':
      return {
        kind: 'agentLoop',
        label: item.entry.label,
        rowId: item.entry.rowId,
        systemPromptRowId: item.entry.systemPromptRowId,
        persona: '',
        status: 'idle',
      }
    default: {
      const _exhaustive: never = item
      throw new Error(`Unhandled palette item: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
