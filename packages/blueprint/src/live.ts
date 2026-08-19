/**
 * Projection of the live Cordis loader tree into a shape the browser can
 * render. Structural inputs only, so this stays testable without booting a
 * harness, and unknown runtime states degrade instead of throwing.
 */

/** Lifecycle of one plugin fiber, keyed by the numeric FiberState. */
const FIBER_PHASE: Record<number, LivePhase> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: 'disposed',
  5: 'unloading',
}

export const LIVE_PHASES = [
  'pending',
  'loading',
  'active',
  'failed',
  'disposed',
  'unloading',
  'disabled',
  'unknown',
] as const

export type LivePhase = (typeof LIVE_PHASES)[number]

export interface LiveEntry {
  id: string
  name: string
  phase: LivePhase
  disabled: boolean
  group: boolean
  /** Services this entry requires. The edges nothing else surfaces. */
  inject: string[]
  /** Config with secret-shaped values removed. Null when the entry has none. */
  config: Record<string, unknown> | null
  /** Keys withheld because they look like credentials. */
  redacted: string[]
  /** Keys not shown because they nest. Distinct from redacted: not secrets. */
  omitted: string[]
}

/** Structural view of a loader Entry. Keeps cordis out of the test program. */
export interface EntryLike {
  options?: {
    id?: string
    name?: string
    config?: unknown
    group?: boolean | null
    disabled?: boolean | null
    inject?: unknown
  }
  disabled?: boolean
  fiber?: { state?: number } | undefined
}

/**
 * Key names whose values never leave the host. Matching is on the key, not the
 * value, so a rotated credential cannot leak by changing shape.
 */
const SECRET_KEY =
  /(api[-_]?key|token|secret|password|passwd|credential|private[-_]?key|auth|bearer|session[-_]?id)/i

/** Values that look like credentials regardless of the key they sit under. */
const SECRET_VALUE = /^(sk-|bearer\s|ghp_|gho_)|:\/\/[^/@\s]+:[^/@\s]+@/i

/**
 * A credential is a string. Requiring that keeps a numeric setting whose name
 * merely contains a trigger word — `maxOutputTokens` — visible, while every
 * value that could actually carry a secret is still caught.
 */
function isSecret(key: string, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  return SECRET_KEY.test(key) || SECRET_VALUE.test(value)
}

/**
 * Strip credential-shaped config. Only the top level is inspected; nested
 * objects are dropped wholesale rather than walked, because a partially
 * redacted nested object invites a false sense of completeness.
 *
 * Nested values are reported separately from secrets. Calling a port number
 * "redacted" trains people to ignore the word where it matters.
 */
export function redactConfig(config: unknown): {
  config: Record<string, unknown> | null
  redacted: string[]
  omitted: string[]
} {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return { config: null, redacted: [], omitted: [] }
  }
  const safe: Record<string, unknown> = {}
  const redacted: string[] = []
  const omitted: string[] = []
  for (const [key, value] of Object.entries(config)) {
    if (isSecret(key, value)) {
      redacted.push(key)
      continue
    }
    if (typeof value === 'object' && value !== null) {
      omitted.push(key)
      continue
    }
    safe[key] = value
  }
  return { config: safe, redacted, omitted }
}

/** Normalize the `inject` option, which may be a list or a required/optional map. */
export function injectNames(inject: unknown): string[] {
  if (Array.isArray(inject)) {
    return inject.filter((name): name is string => typeof name === 'string')
  }
  if (typeof inject === 'object' && inject !== null) {
    const required = (inject as { required?: unknown }).required
    const optional = (inject as { optional?: unknown }).optional
    return [...injectNames(required), ...injectNames(optional)]
  }
  return []
}

/**
 * Resolve the phase shown in the UI. A disabled entry reports `disabled`
 * rather than whatever its fiber last was, and an unrecognized state reports
 * `unknown` so a future DSH release degrades instead of mislabeling.
 */
export function phaseOf(state: number | undefined, disabled: boolean): LivePhase {
  if (disabled) {
    return 'disabled'
  }
  if (state === undefined) {
    return 'unknown'
  }
  return FIBER_PHASE[state] ?? 'unknown'
}

export function projectEntry(entry: EntryLike): LiveEntry {
  const options = entry.options ?? {}
  const disabled = entry.disabled === true || options.disabled === true
  const { config, redacted, omitted } = redactConfig(options.config)
  return {
    id: typeof options.id === 'string' ? options.id : '(unnamed)',
    name: typeof options.name === 'string' ? options.name : '(unknown module)',
    phase: phaseOf(entry.fiber?.state, disabled),
    disabled,
    group: options.group === true,
    inject: injectNames(options.inject),
    config,
    redacted,
    omitted,
  }
}

export function projectEntries(entries: Iterable<EntryLike>): LiveEntry[] {
  return [...entries].map(projectEntry)
}
