import { isCatalogToolRowId } from '@mddl/graph-schema'
import { type ToolFlowNode, useGraphStore } from '../store/graphStore.ts'

export function useToolInspector(node: ToolFlowNode) {
  const patchNodeData = useGraphStore((state) => state.patchNodeData)
  const wired = useGraphStore((state) => {
    const agent = state.nodes.find((item) => item.type === 'agentLoop')
    if (agent === undefined) {
      return true
    }
    return state.edges.some(
      (edge) => edge.source === node.id && edge.target === agent.id,
    )
  })

  const effect = toolPatchEffect(node, wired)

  return {
    wired,
    effect,
    setEnabled: (enabled: boolean) => {
      patchNodeData(node.id, { enabled })
    },
  }
}

function toolPatchEffect(node: ToolFlowNode, wired: boolean): string {
  if (!node.data.enabled || !wired) {
    return `Overlay will set ${node.data.rowId} to disabled: true.`
  }
  if (isCatalogToolRowId(node.data.rowId)) {
    return 'Already mounted in dsh-base. Wired catalog tools do not emit YAML rows.'
  }
  return `Overlay will insert ${node.data.packageName} as row ${node.data.rowId}.`
}
