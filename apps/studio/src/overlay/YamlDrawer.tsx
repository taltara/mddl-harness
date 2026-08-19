import { OverlayFactList } from './OverlayFactList.tsx'
import { useYamlDrawer } from './useYamlDrawer.ts'

interface YamlDrawerProps {
  open: boolean
}

export function YamlDrawer({ open }: YamlDrawerProps) {
  const {
    yaml,
    summary,
    warnings,
    copied,
    copyYaml,
    copyApply,
    exportGraph,
    importGraph,
    importError,
  } = useYamlDrawer()

  if (!open) {
    return null
  }

  return (
    <section className="shrink-0 border-t border-white/8 bg-panel">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Harness overlay
          </p>
          <p className="font-mono text-[11px] text-white/55">
            {summary.applyCommand}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            --patch is from your terminal cwd. This file will not add a
            Blueprint tab in the DSH UI.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <label className="cursor-pointer rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition-colors hover:border-white/25">
            Import graph
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void importGraph(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </label>
          <SmallButton onClick={exportGraph}>Export graph</SmallButton>
          <SmallButton
            onClick={() => {
              void copyApply()
            }}
          >
            {copied === 'apply' ? 'Copied command' : 'Copy apply'}
          </SmallButton>
          <SmallButton
            onClick={() => {
              void copyYaml()
            }}
          >
            {copied === 'yaml' ? 'Copied YAML' : 'Copy YAML'}
          </SmallButton>
        </div>
      </div>
      {importError === undefined ? null : (
        <p className="border-t border-white/8 px-4 py-2 text-[11px] text-rose-400">
          Could not import that file: {importError}
        </p>
      )}
      {warnings.length === 0 ? null : (
        <ul className="space-y-1 border-t border-white/8 px-4 py-2">
          {warnings.map((warning) => (
            <li
              key={warning.code}
              className={`flex gap-2 text-[11px] ${
                warning.level === 'error' ? 'text-rose-400' : 'text-amber'
              }`}
            >
              <span aria-hidden>{warning.level === 'error' ? '✕' : '!'}</span>
              <span>{warning.text}</span>
            </li>
          ))}
        </ul>
      )}
      <OverlayFactList facts={summary.facts} />
      <pre className="max-h-36 overflow-auto border-t border-white/8 px-4 py-3 font-mono text-[11px] leading-relaxed text-cyan/90">
        {yaml}
      </pre>
    </section>
  )
}

function SmallButton({
  children,
  onClick,
}: {
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 transition-colors hover:border-white/25"
    >
      {children}
    </button>
  )
}
