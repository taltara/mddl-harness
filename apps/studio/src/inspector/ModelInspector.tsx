import { MODEL_CATALOG } from '@mddl/graph-schema'
import { type ModelFlowNode, useGraphStore } from '../store/graphStore.ts'
import { InspectorField, InspectorNote } from './InspectorField.tsx'

interface ModelInspectorProps {
  node: ModelFlowNode
}

export function ModelInspector({ node }: ModelInspectorProps) {
  const patchNodeData = useGraphStore((state) => state.patchNodeData)
  const catalogKey = `${node.data.provider}::${node.data.model}`

  return (
    <div className="space-y-4">
      <InspectorNote>
        Patches the agent-default-model row in the web profile.
      </InspectorNote>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          Model
        </span>
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm outline-none focus:border-cyan"
          value={catalogKey}
          onChange={(event) => {
            const next = MODEL_CATALOG.find(
              (entry) =>
                `${entry.provider}::${entry.model}` === event.target.value,
            )
            if (next === undefined) {
              return
            }
            patchNodeData(node.id, {
              label: next.label,
              rowId: next.rowId,
              adapterPackage: next.adapterPackage,
              provider: next.provider,
              model: next.model,
            })
          }}
        >
          {MODEL_CATALOG.map((entry) => (
            <option
              key={`${entry.provider}::${entry.model}`}
              value={`${entry.provider}::${entry.model}`}
            >
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <InspectorField label="Provider" value={node.data.provider} />
      <InspectorField label="Adapter" value={node.data.adapterPackage} />
      <InspectorField label="Cordis row id" value={node.data.rowId} />
    </div>
  )
}
