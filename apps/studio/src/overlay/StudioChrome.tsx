import { type ReactNode } from 'react'

interface StudioChromeProps {
  previewing: boolean
  yamlOpen: boolean
  onTogglePreview: () => void
  onToggleYaml: () => void
  onExportYaml: () => void
  onResetGraph: () => void
}

export function StudioChrome({
  previewing,
  yamlOpen,
  onTogglePreview,
  onToggleYaml,
  onExportYaml,
  onResetGraph,
}: StudioChromeProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 bg-panel/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan/80">
            mddl
          </p>
          <h1 className="text-sm font-semibold leading-none">
            Visual orchestrator
          </h1>
        </div>
        <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber">
          Not attached to dsh
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ChromeButton onClick={onResetGraph}>Reset</ChromeButton>
        <ChromeButton onClick={onTogglePreview}>
          {previewing ? 'Stop studio preview' : 'Studio preview'}
        </ChromeButton>
        <ChromeButton onClick={onToggleYaml}>
          {yamlOpen ? 'Hide overlay' : 'Show overlay'}
        </ChromeButton>
        <ChromeButton emphasis onClick={onExportYaml}>
          Export cordis.patch.yml
        </ChromeButton>
      </div>
    </header>
  )
}

function ChromeButton({
  children,
  onClick,
  emphasis = false,
}: {
  children: ReactNode
  onClick: () => void
  emphasis?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
        emphasis
          ? 'border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20'
          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}
