import { Panel } from '@xyflow/react'

export function CanvasHint() {
  return (
    <Panel position="top-left" className="!m-3 max-w-[420px]">
      <div className="rounded-md border border-white/10 bg-panel/90 px-3 py-2 text-xs leading-relaxed text-white/70 shadow-lg backdrop-blur-md">
        Wire a model and tools into{' '}
        <span className="text-amber">Agent loop</span>. A host overlay will
        not appear as a tab in dsh web. Look in{' '}
        <span className="text-white/90">Settings → Models</span>. Web tools
        come from agent presets.
      </div>
    </Panel>
  )
}
