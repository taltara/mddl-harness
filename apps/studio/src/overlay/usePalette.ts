import {
  AGENT_LOOP_ENTRY,
  MODEL_CATALOG,
  TOOL_CATALOG,
} from '@mddl/graph-schema'
import { type DragEvent } from 'react'
import { PALETTE_MIME, type PaletteItem } from '../lib/createNode.ts'
import { useGraphStore } from '../store/graphStore.ts'

export function usePalette() {
  const hasAgentLoop = useGraphStore((state) =>
    state.nodes.some((node) => node.type === 'agentLoop'),
  )

  const onDragStart = (
    event: DragEvent<HTMLButtonElement>,
    item: PaletteItem,
  ) => {
    event.dataTransfer.setData(PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  return { onDragStart, hasAgentLoop }
}

export function paletteItems(): PaletteItem[] {
  return [
    { kind: 'agentLoop' as const, entry: AGENT_LOOP_ENTRY },
    ...MODEL_CATALOG.map((entry) => ({ kind: 'model' as const, entry })),
    ...TOOL_CATALOG.map((entry) => ({ kind: 'tool' as const, entry })),
  ]
}

export function paletteSubtitle(item: PaletteItem): string {
  return item.kind === 'model' ? item.entry.model : item.entry.rowId
}
