import { InspectorField, InspectorNote } from './InspectorField.tsx'
import { useGraphStore, type AgentLoopFlowNode } from '../store/graphStore.ts'

interface AgentLoopInspectorProps {
  node: AgentLoopFlowNode
}

export function AgentLoopInspector({ node }: AgentLoopInspectorProps) {
  const patchNodeData = useGraphStore((state) => state.patchNodeData)

  return (
    <div className="space-y-4">
      <InspectorNote>
        Edges into this node decide what the overlay keeps, disables, or inserts.
      </InspectorNote>
      <InspectorField label="Cordis row id" value={node.data.rowId} />
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          Persona overlay
        </span>
        <textarea
          className="mt-1 h-36 w-full resize-none rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm outline-none focus:border-amber"
          placeholder="Empty keeps the dsh-base / bundle persona."
          value={node.data.persona}
          onChange={(event) => {
            patchNodeData(node.id, { persona: event.target.value })
          }}
        />
      </label>
    </div>
  )
}
