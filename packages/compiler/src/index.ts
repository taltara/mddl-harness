import type { GraphDocument } from '@mddl/graph-schema'
import { compileGraphToPatch } from './compileGraphToPatch.ts'
import { emitPatchYaml } from './emitYaml.ts'
import { summarizeGraph } from './summarizeGraph.ts'

export { compileGraphToPatch } from './compileGraphToPatch.ts'
export { emitPatchYaml } from './emitYaml.ts'
export type {
  OverlayWarning,
  OverlayWarningLevel,
} from './lintGraph.ts'
export { lintGraph, OVERLAY_WARNING_LEVELS } from './lintGraph.ts'
export type { OverlayFact, OverlaySummary } from './summarizeGraph.ts'
export {
  DSH_APPLY_COMMAND,
  DSH_WEB_URL,
  summarizeGraph,
} from './summarizeGraph.ts'
export type { CordisPatchOp, CordisRow } from './types.ts'
export { isInsertOp } from './types.ts'

export function compileGraphToYaml(graph: GraphDocument): string {
  return emitPatchYaml(compileGraphToPatch(graph), summarizeGraph(graph))
}
