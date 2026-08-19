import type { OrchestratorNode } from '../store/graphStore.ts'
import { useGraphStore } from '../store/graphStore.ts'

export function useInspectorPanel(): OrchestratorNode | undefined {
  return useGraphStore((state) => state.nodes.find((node) => node.selected))
}
