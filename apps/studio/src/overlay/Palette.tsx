import { type DragEvent, type ReactNode, type RefObject } from 'react'
import type { PaletteItem } from '../lib/createNode.ts'
import { paletteItemKey, paletteSubtitle, usePalette } from './usePalette.ts'

export function Palette() {
  const {
    onDragStart,
    query,
    setQuery,
    onlyUnplaced,
    toggleOnlyUnplaced,
    clearFilters,
    searchRef,
    visible,
    total,
    isPlaced,
    hasAgentLoop,
  } = usePalette()

  const groups = [
    { title: 'Agent', accent: 'bg-amber', kind: 'agentLoop' as const },
    { title: 'Models', accent: 'bg-cyan', kind: 'model' as const },
    { title: 'Tools', accent: 'bg-magenta', kind: 'tool' as const },
  ].map((group) => ({
    ...group,
    items: visible.filter((item) => item.kind === group.kind),
  }))

  const filtered = query.trim() !== '' || onlyUnplaced

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-white/8 bg-panel/90 backdrop-blur-md">
      <div className="space-y-2 border-b border-white/8 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            Palette
          </p>
          <p className="font-mono text-[10px] text-white/30">
            {filtered ? `${visible.length}/${total}` : total}
          </p>
        </div>
        <PaletteSearch
          value={query}
          onChange={setQuery}
          inputRef={searchRef}
        />
        <button
          type="button"
          onClick={toggleOnlyUnplaced}
          aria-pressed={onlyUnplaced}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors duration-200 ${
            onlyUnplaced
              ? 'border-cyan/40 bg-cyan/10 text-cyan'
              : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
          }`}
        >
          Not on canvas
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {visible.length === 0 ? (
          <div className="px-1 py-6 text-center">
            <p className="text-sm text-white/50">No modules match.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-[11px] text-cyan hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <PaletteGroup
                key={group.title}
                title={group.title}
                accent={group.accent}
              >
                {group.items.map((item) => (
                  <PaletteCard
                    key={paletteItemKey(item)}
                    item={item}
                    onDragStart={onDragStart}
                    placed={isPlaced(item)}
                    disabled={item.kind === 'agentLoop' && hasAgentLoop}
                    disabledNote="Already on the canvas"
                  />
                ))}
              </PaletteGroup>
            ))
        )}
      </div>
      <p className="border-t border-white/8 px-4 py-2 text-[10px] text-white/30">
        Drag onto the canvas, then wire into Agent loop.
      </p>
    </aside>
  )
}

function PaletteSearch({
  value,
  onChange,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onChange('')
          }
        }}
        placeholder="Search modules"
        aria-label="Search modules"
        className="w-full rounded-md border border-white/10 bg-black/30 py-1.5 pl-2.5 pr-7 text-xs text-white placeholder:text-white/30 focus:border-cyan/40 focus:outline-none"
      />
      {value === '' ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 font-mono text-[9px] text-white/30">
          /
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-xs text-white/40 hover:text-white/80"
        >
          ×
        </button>
      )}
    </div>
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
  placed = false,
  disabled = false,
  disabledNote,
}: {
  item: PaletteItem
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: PaletteItem) => void
  placed?: boolean
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{item.entry.label}</p>
        {placed && !disabled ? (
          <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">
            on canvas
          </span>
        ) : null}
      </div>
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
