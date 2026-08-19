import { Panel } from '@xyflow/react'
import { useState } from 'react'

const DISMISSED_KEY = 'mddl.hint.dismissed'

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function CanvasHint() {
  const [dismissed, setDismissed] = useState(wasDismissed)

  if (dismissed) {
    return null
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Losing the preference is not worth breaking the canvas over.
    }
  }

  // Top-right: the starter graph's nodes and the zoom controls both sit left,
  // so anywhere else covers content on first load.
  return (
    <Panel position="top-right" className="!m-3 max-w-[380px]">
      <div className="flex items-start gap-2 rounded-md border border-white/10 bg-panel/90 px-3 py-2 text-xs leading-relaxed text-white/70 shadow-lg backdrop-blur-md">
        <p className="m-0">
          Wire a model and tools into{' '}
          <span className="text-amber">Agent loop</span>. A host overlay will
          not appear as a tab in dsh web. Look in{' '}
          <span className="text-white/90">Settings → Models</span>. Web tools
          come from agent presets.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="-mr-1 shrink-0 rounded px-1 leading-none text-white/40 transition-colors hover:text-white/90"
        >
          ×
        </button>
      </div>
    </Panel>
  )
}
