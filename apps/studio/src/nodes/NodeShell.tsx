import { NODE_KIND_LABEL, type NodeKind, type NodeRunStatus } from '@mddl/graph-schema'
import { Handle, Position } from '@xyflow/react'

const ACCENT_BAR: Record<NodeKind, string> = {
  model: 'bg-cyan',
  tool: 'bg-magenta',
  agentLoop: 'bg-amber',
}

const ACCENT_TEXT: Record<NodeKind, string> = {
  model: 'text-cyan',
  tool: 'text-magenta',
  agentLoop: 'text-amber',
}

const HANDLE: Record<NodeKind, string> = {
  model: '!bg-cyan',
  tool: '!bg-magenta',
  agentLoop: '!bg-amber',
}

function statusGlow(status: NodeRunStatus): string {
  switch (status) {
    case 'idle':
      return 'shadow-none'
    case 'running':
      return 'shadow-[0_0_28px_rgba(92,225,230,0.4)]'
    case 'active':
      return 'shadow-[0_0_28px_rgba(244,114,182,0.4)]'
    case 'done':
      return 'shadow-[0_0_18px_rgba(52,211,153,0.28)]'
    case 'error':
      return 'shadow-[0_0_18px_rgba(248,113,113,0.4)]'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

interface NodeShellProps {
  kind: NodeKind
  selected: boolean
  status: NodeRunStatus
  title: string
  subtitle: string
  source?: boolean
  target?: boolean
}

export function NodeShell({
  kind,
  selected,
  status,
  title,
  subtitle,
  source = false,
  target = false,
}: NodeShellProps) {
  return (
    <div
      className={`relative w-[248px] rounded-lg border bg-node/95 backdrop-blur-sm transition-shadow duration-200 ${
        selected ? 'border-white/25' : 'border-white/10'
      } ${statusGlow(status)}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${ACCENT_BAR[kind]}`} />
      {target ? (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className={HANDLE[kind]}
        />
      ) : null}
      {source ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className={HANDLE[kind]}
        />
      ) : null}
      <div className="px-4 py-3 pl-5">
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${ACCENT_TEXT[kind]}`}
        >
          {NODE_KIND_LABEL[kind]}
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-tight">{title}</p>
        <p className="mt-1 truncate font-mono text-[11px] text-white/45">{subtitle}</p>
      </div>
    </div>
  )
}
