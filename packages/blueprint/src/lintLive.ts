import type { LiveEntry } from './live.ts'

export type LiveWarningLevel = 'error' | 'warning'

export type LiveWarning = {
  level: LiveWarningLevel
  code: string
  text: string
}

/**
 * Check the config the harness actually booted. A file-based tool cannot do
 * this: `failed` and `pending` are runtime facts, not YAML.
 */
export function lintLive(entries: LiveEntry[]): LiveWarning[] {
  const warnings: LiveWarning[] = []

  for (const entry of entries.filter((item) => item.phase === 'failed')) {
    warnings.push({
      level: 'error',
      code: 'entry-failed',
      text: `${entry.id} (${entry.name}) is configured but failed to load. It is in your config and not running.`,
    })
  }

  // Pending means a required service never arrived — a silent half-boot that
  // looks identical to "working" until the feature is missing.
  for (const entry of entries.filter((item) => item.phase === 'pending')) {
    const waiting = entry.inject.length > 0 ? ` Waiting on: ${entry.inject.join(', ')}.` : ''
    warnings.push({
      level: 'warning',
      code: 'entry-pending',
      text: `${entry.id} is still waiting for a service that has not appeared.${waiting}`,
    })
  }

  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id)
    }
    seen.add(entry.id)
  }
  for (const id of [...duplicates].sort()) {
    warnings.push({
      level: 'error',
      code: 'duplicate-entry-id',
      text: `Two live entries share the id "${id}". Rows are addressed by id, so a patch targeting it is ambiguous.`,
    })
  }

  // A disabled entry whose services others require. `inject` names services
  // rather than ids, so this only fires on the conventional id === service
  // match, which is the common case for the shipped rows.
  const required = new Map<string, string[]>()
  for (const entry of entries) {
    if (entry.disabled) {
      continue
    }
    for (const service of entry.inject) {
      required.set(service, [...(required.get(service) ?? []), entry.id])
    }
  }
  for (const entry of entries.filter((item) => item.disabled)) {
    const dependents = required.get(entry.id)
    if (dependents === undefined || dependents.length === 0) {
      continue
    }
    warnings.push({
      level: 'error',
      code: 'disabled-dependency',
      text: `${entry.id} is disabled but still required by ${dependents.join(', ')}.`,
    })
  }

  return warnings
}
