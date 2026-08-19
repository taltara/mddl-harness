export function InspectorField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  // A read-only pair, not a form field: <label> here would promise a control
  // that does not exist.
  return (
    <div className="block">
      <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>
      <p className="mt-1 break-all font-mono text-xs text-white/70">{value}</p>
    </div>
  )
}

export function InspectorNote({ children }: { children: string }) {
  return (
    <p className="rounded-md border border-white/8 bg-black/20 px-3 py-2 text-xs leading-relaxed text-white/60">
      {children}
    </p>
  )
}
