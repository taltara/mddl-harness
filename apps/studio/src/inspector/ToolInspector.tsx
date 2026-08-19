import { InspectorField, InspectorNote } from './InspectorField.tsx'
import { useToolInspector } from './useToolInspector.ts'
import type { ToolFlowNode } from '../store/graphStore.ts'

interface ToolInspectorProps {
  node: ToolFlowNode
}

export function ToolInspector({ node }: ToolInspectorProps) {
  const inspector = useToolInspector(node)

  return (
    <div className="space-y-4">
      <InspectorNote>{inspector.effect}</InspectorNote>
      <label className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          Enabled
        </span>
        <input
          type="checkbox"
          checked={node.data.enabled}
          onChange={(event) => {
            inspector.setEnabled(event.target.checked)
          }}
        />
      </label>
      <InspectorField
        label="Wired to agent loop"
        value={inspector.wired ? 'Yes' : 'No — will be disabled'}
      />
      <InspectorField label="Cordis row id" value={node.data.rowId} />
      <InspectorField label="Package" value={node.data.packageName} />
    </div>
  )
}
