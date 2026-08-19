export interface CordisRow {
  id: string
  name?: string
  inject?: string[]
  disabled?: boolean
  config?: Record<string, unknown>
}

export interface CordisInsertOp {
  insert: CordisRow[]
}

export type CordisPatchOp = CordisRow | CordisInsertOp

export function isInsertOp(op: CordisPatchOp): op is CordisInsertOp {
  return 'insert' in op
}
