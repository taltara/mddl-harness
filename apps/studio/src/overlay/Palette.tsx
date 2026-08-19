import { type DragEvent, type ReactNode } from 'react'
import type { PaletteItem } from '../lib/createNode.ts'
import { paletteItems, paletteSubtitle, usePalette } from './usePalette.ts'

export function Palette() {
  const { onDragStart, hasAgentLoop } = usePalette()
  const agentLoop = paletteItems().filter((item) => item.kind === 'agentLoop')
  const models = paletteItems().filter((item) => item.kind === 'model')
  const tools = paletteItems().filter((item) => item.kind === 'tool')

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-white/8 bg-panel/90 backdrop-blur-md">
      <div className="border-b border-white/8 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          Palette
        </p>
        <p className="mt-1 text-sm text-white/60">
          Drag onto the canvas, then wire into Agent loop.
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <PaletteGroup title="Agent" accent="bg-amber">
          {agentLoop.map((item) => (
            <PaletteCard
              key={item.entry.rowId}
              item={item}
              onDragStart={onDragStart}
              disabled={hasAgentLoop}
              disabledNote="Already on the canvas"
            />
          ))}
        </PaletteGroup>
        <PaletteGroup title="Models" accent="bg-cyan">
          {models.map((item) => (
            <PaletteCard
              key={`${item.entry.provider}-${item.entry.model}`}
              item={item}
              onDragStart={onDragStart}
            />
          ))}
        </PaletteGroup>
        <PaletteGroup title="Tools" accent="bg-magenta">
          {tools.map((item) => (
            <PaletteCard
              key={item.entry.rowId}
              item={item}
              onDragStart={onDragStart}
            />
          ))}
        </PaletteGroup>
      </div>
    </aside>
  )
}

function PaletteGroup({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${accent}`} />
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-white/40">
          {title}
        </h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function PaletteCard({
  item,
  onDragStart,
  disabled = false,
  disabledNote,
}: {
  item: PaletteItem
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: PaletteItem) => void
  disabled?: boolean
  disabledNote?: string
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      aria-disabled={disabled}
      onDragStart={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        onDragStart(event, item)
      }}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors duration-200 ${
        disabled
          ? 'cursor-not-allowed border-white/5 bg-black/10 opacity-40'
          : 'border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/5 active:scale-[0.99]'
      }`}
    >
      <p className="text-sm font-medium">{item.entry.label}</p>
      <p className="mt-0.5 font-mono text-[10px] text-white/35">
        {paletteSubtitle(item)}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] text-white/45">
        {disabled && disabledNote !== undefined
          ? disabledNote
          : item.entry.description}
      </p>
    </button>
  )
}
