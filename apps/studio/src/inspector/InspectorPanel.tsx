import { AgentLoopInspector } from './AgentLoopInspector.tsx'
import { ModelInspector } from './ModelInspector.tsx'
import { ToolInspector } from './ToolInspector.tsx'
import { useInspectorPanel } from './useInspectorPanel.ts'

export function InspectorPanel() {
  const selected = useInspectorPanel()

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/8 bg-panel/90 backdrop-blur-md">
      <div className="border-b border-white/8 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          Inspector
        </p>
        <p className="mt-1 text-sm font-medium">
          {selected?.data.label ?? 'Harness mapping'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selected === undefined ? (
          <EmptyInspector />
        ) : (
          <InspectorBody node={selected} />
        )}
      </div>
    </aside>
  )
}

function EmptyInspector() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-white/60">
      <p>
        This studio is not inside http://127.0.0.1:3080. A host overlay will not
        add a Blueprint tab, plugin card, or chat row.
      </p>
      <ul className="list-disc space-y-2 pl-4 text-xs text-white/50">
        <li>
          <span className="text-cyan">Model</span> is the only starter-graph
          change dsh web can show: Settings → Models (
          <span className="font-mono text-white/70">agent-default-model</span>
          ).
        </li>
        <li>
          <span className="text-magenta">Tools</span> on web live in agent
          presets (Standard / Code / Minimal / Creator), not in this host patch.
          The web bundle already disables host-plane bash/fs/web.
        </li>
        <li>
          <span className="text-amber">Agent loop</span> is a canvas composition
          target. To show up in dsh, we need a{' '}
          <span className="font-mono">dsh.client</span> plugin on{' '}
          <span className="font-mono">conversation.view</span>.
        </li>
      </ul>
    </div>
  )
}

function InspectorBody({
  node,
}: {
  node: NonNullable<ReturnType<typeof useInspectorPanel>>
}) {
  switch (node.type) {
    case 'model':
      return <ModelInspector node={node} />
    case 'tool':
      return <ToolInspector node={node} />
    case 'agentLoop':
      return <AgentLoopInspector node={node} />
    default: {
      const _exhaustive: never = node
      return _exhaustive
    }
  }
}
