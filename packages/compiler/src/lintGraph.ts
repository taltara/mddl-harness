import type { GraphDocument } from '@mddl/graph-schema'
import { compileGraphToPatch } from './compileGraphToPatch.ts'
import { isInsertOp, type CordisPatchOp } from './types.ts'

export const OVERLAY_WARNING_LEVELS = ['error', 'warning'] as const

export type OverlayWarningLevel = (typeof OVERLAY_WARNING_LEVELS)[number]

export type OverlayWarning = {
  level: OverlayWarningLevel
  code: string
  text: string
}

function patchedRowIds(ops: CordisPatchOp[]): string[] {
  return ops.flatMap((op) =>
    isInsertOp(op) ? op.insert.map((row) => row.id) : [op.id],
  )
}

/**
 * Check an overlay for the shapes that break a DSH boot. Rows are addressed by
 * id, so a repeated id is ambiguous rather than additive.
 */
export function lintGraph(graph: GraphDocument): OverlayWarning[] {
  const warnings: OverlayWarning[] = []
  const ops = compileGraphToPatch(graph)

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of patchedRowIds(ops)) {
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  for (const id of [...duplicates].sort()) {
    warnings.push({
      level: 'error',
      code: 'duplicate-row-id',
      text: `Two rows patch "${id}". DSH addresses rows by id, so this overlay is ambiguous.`,
    })
  }

  if (!graph.nodes.some((node) => node.data.kind === 'agentLoop')) {
    warnings.push({
      level: 'warning',
      code: 'no-agent-loop',
      text: 'No agent loop on the canvas, so every node compiles as if it were wired.',
    })
  }

  const tools = graph.nodes.filter((node) => node.data.kind === 'tool')
  const disabledIds = new Set(
    ops.filter((op) => !isInsertOp(op) && op.disabled === true).map((op) =>
      isInsertOp(op) ? '' : op.id,
    ),
  )
  if (tools.length > 0 && tools.every((node) => disabledIds.has(node.data.rowId))) {
    warnings.push({
      level: 'warning',
      code: 'all-tools-disabled',
      text: 'Every tool on the canvas is disabled, so the agent boots with none of them.',
    })
  }

  return warnings
}
