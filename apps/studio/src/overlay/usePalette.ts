import {
  AGENT_LOOP_ENTRY,
  MODEL_CATALOG,
  TOOL_CATALOG,
} from '@mddl/graph-schema'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { PALETTE_MIME, type PaletteItem } from '../lib/createNode.ts'
import { useGraphStore } from '../store/graphStore.ts'

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

/** Stable identity for a palette item, so two models sharing a rowId stay distinct. */
export function paletteItemKey(item: PaletteItem): string {
  return item.kind === 'model'
    ? `model:${item.entry.model}`
    : `${item.kind}:${item.entry.rowId}`
}

function searchText(item: PaletteItem): string {
  const parts = [item.entry.label, paletteSubtitle(item), item.entry.description]
  if (item.kind === 'tool') {
    parts.push(item.entry.packageName)
  }
  return parts.join(' ').toLowerCase()
}

/** Every term must appear, so "fs search" narrows instead of widening. */
function matchesQuery(item: PaletteItem, terms: string[]): boolean {
  const haystack = searchText(item)
  return terms.every((term) => haystack.includes(term))
}

export function usePalette() {
  const [query, setQuery] = useState('')
  const [onlyUnplaced, setOnlyUnplaced] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const nodes = useGraphStore((state) => state.nodes)

  const placedKeys = useMemo(
    () =>
      new Set(
        nodes.map((node) =>
          node.data.kind === 'model'
            ? `model:${node.data.model}`
            : `${node.data.kind}:${node.data.rowId}`,
        ),
      ),
    [nodes],
  )

  // "/" jumps to search the way it does in docs and code hosts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const visible = paletteItems().filter((item) => {
    if (onlyUnplaced && placedKeys.has(paletteItemKey(item))) {
      return false
    }
    return matchesQuery(item, terms)
  })

  const onDragStart = (
    event: DragEvent<HTMLButtonElement>,
    item: PaletteItem,
  ) => {
    event.dataTransfer.setData(PALETTE_MIME, JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  return {
    onDragStart,
    query,
    setQuery,
    onlyUnplaced,
    toggleOnlyUnplaced: () => {
      setOnlyUnplaced((value) => !value)
    },
    clearFilters: () => {
      setQuery('')
      setOnlyUnplaced(false)
    },
    searchRef,
    visible,
    total: paletteItems().length,
    isPlaced: (item: PaletteItem) => placedKeys.has(paletteItemKey(item)),
    hasAgentLoop: placedKeys.has('agentLoop:agent-loop'),
  }
}
