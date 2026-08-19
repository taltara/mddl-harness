import type { OverlayFact } from '@mddl/compiler'

export function OverlayFactList({ facts }: { facts: OverlayFact[] }) {
  return (
    <ul className="space-y-1 px-4 pb-3">
      {facts.map((fact) => (
        <li key={fact.text} className="flex gap-2 text-[11px] leading-snug">
          <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(fact.kind)}`} />
          <span className="text-white/65">{fact.text}</span>
        </li>
      ))}
    </ul>
  )
}

function dotClass(kind: OverlayFact['kind']): string {
  switch (kind) {
    case 'change':
      return 'bg-cyan'
    case 'keep':
      return 'bg-white/30'
    case 'note':
      return 'bg-amber'
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}
