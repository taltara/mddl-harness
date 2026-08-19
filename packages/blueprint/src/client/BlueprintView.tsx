import type { GraphDocument } from '@mddl/graph-schema'
import {
  compileGraphToYaml,
  lintGraph,
  summarizeGraph,
  type OverlayFact,
  type OverlayWarning,
} from '@mddl/compiler'
import { useEffect, useState, type CSSProperties } from 'react'
import { LIVE_ROUTE } from '../index.ts'
import type { LiveEntry } from '../live.ts'
import { lintLive } from '../lintLive.ts'

const FACT_COLOR: Record<OverlayFact['kind'], string> = {
  change: '#3ddc97',
  keep: '#7a8699',
  note: '#e0b055',
}

const WARNING_COLOR: Record<OverlayWarning['level'], string> = {
  error: '#ff6b6b',
  warning: '#e0b055',
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    overflowY: 'auto',
    height: '100%',
    fontSize: 13,
    lineHeight: 1.55,
  },
  card: {
    border: '1px solid rgba(127,140,160,0.25)',
    borderRadius: 8,
    padding: 14,
  },
  heading: {
    margin: '0 0 6px',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 6,
    background: 'rgba(127,140,160,0.10)',
    fontSize: 12,
    overflowX: 'auto',
    whiteSpace: 'pre',
  },
  list: { margin: 0, paddingLeft: 18 },
  muted: { opacity: 0.65 },
} satisfies Record<string, CSSProperties>

function parseGraph(raw: string): GraphDocument {
  const parsed: unknown = JSON.parse(raw)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as GraphDocument).version !== 1 ||
    !Array.isArray((parsed as GraphDocument).nodes) ||
    !Array.isArray((parsed as GraphDocument).edges)
  ) {
    throw new Error('Not a mddl graph: expected version 1 with nodes and edges.')
  }
  return parsed as GraphDocument
}

/**
 * The conversation view tab. A loaded graph is compiled here in the browser,
 * so the tab shows exactly what the overlay would change before it is applied.
 */
export function BlueprintView() {
  const [graph, setGraph] = useState<GraphDocument | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const live = useLiveTree()

  const onFile = async (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    try {
      setGraph(parseGraph(await file.text()))
      setError(undefined)
    } catch (cause) {
      setGraph(undefined)
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div style={styles.root}>
      <LiveReport live={live} />

      <section style={styles.card}>
        <h2 style={styles.heading}>Check an overlay</h2>
        <p style={{ margin: 0 }}>
          Load a graph exported from mddl studio to see what its overlay would
          change here, and what it leaves alone.
        </p>
        <p style={{ ...styles.muted, margin: '8px 0 10px' }}>
          Reading only. Applying an overlay is still{' '}
          <code>dsh web --patch</code>.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Load a mddl graph"
          onChange={(event) => {
            void onFile(event.target.files?.[0])
          }}
        />
        {error === undefined ? null : (
          <p style={{ color: WARNING_COLOR.error, marginBottom: 0 }}>{error}</p>
        )}
      </section>

      {graph === undefined ? null : <GraphReport graph={graph} />}
    </div>
  )
}

type LiveState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: LiveEntry[] }

/** Read the running loader tree from the host half. */
function useLiveTree(): LiveState {
  const [state, setState] = useState<LiveState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(LIVE_ROUTE, {
          headers: { accept: 'application/json' },
        })
        if (!response.ok) {
          throw new Error(`host route returned ${response.status}`)
        }
        const body = (await response.json()) as { entries?: LiveEntry[] }
        if (!cancelled) {
          setState({ status: 'ready', entries: body.entries ?? [] })
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

function LiveReport({ live }: { live: LiveState }) {
  if (live.status === 'loading') {
    return (
      <section style={styles.card}>
        <h2 style={styles.heading}>This harness</h2>
        <p style={{ ...styles.muted, margin: 0 }}>Reading the live config…</p>
      </section>
    )
  }

  if (live.status === 'error') {
    return (
      <section style={styles.card}>
        <h2 style={styles.heading}>This harness</h2>
        <p style={{ color: WARNING_COLOR.warning, margin: 0 }}>
          Could not read the live config: {live.message}
        </p>
      </section>
    )
  }

  const warnings = lintLive(live.entries)
  const byPhase = new Map<string, number>()
  for (const entry of live.entries) {
    byPhase.set(entry.phase, (byPhase.get(entry.phase) ?? 0) + 1)
  }
  const problems = new Set(
    live.entries.filter((e) => e.phase === 'failed' || e.phase === 'pending').map((e) => e.id),
  )
  const secretCount = live.entries.reduce(
    (total, entry) => total + entry.redacted.length,
    0,
  )

  return (
    <>
      <section style={styles.card}>
        <h2 style={styles.heading}>This harness</h2>
        <p style={{ margin: '0 0 8px' }}>
          {live.entries.length} entries booted from your config.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[...byPhase.entries()].sort().map(([phase, count]) => (
            <span key={phase} style={phaseChip(phase)}>
              {phase} {count}
            </span>
          ))}
        </div>
        {secretCount === 0 ? null : (
          <p style={{ ...styles.muted, margin: '10px 0 0', fontSize: 12 }}>
            {secretCount} credential-shaped {secretCount === 1 ? 'value' : 'values'}{' '}
            withheld on the host and never sent to this page.
          </p>
        )}
      </section>

      {warnings.length === 0 ? (
        <section style={styles.card}>
          <h2 style={styles.heading}>Health</h2>
          <p style={{ color: FACT_COLOR.change, margin: 0 }}>
            Every configured entry is running or deliberately off.
          </p>
        </section>
      ) : (
        <section style={styles.card}>
          <h2 style={styles.heading}>Health</h2>
          <ul style={styles.list}>
            {warnings.map((warning) => (
              <li
                key={`${warning.code}-${warning.text}`}
                style={{ color: WARNING_COLOR[warning.level] }}
              >
                {warning.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {problems.size === 0 ? null : (
        <section style={styles.card}>
          <h2 style={styles.heading}>Entries needing attention</h2>
          <ul style={styles.list}>
            {live.entries
              .filter((entry) => problems.has(entry.id))
              .map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.id}</strong>{' '}
                  <span style={styles.muted}>{entry.name}</span>{' '}
                  <span style={phaseChip(entry.phase)}>{entry.phase}</span>
                  {entry.inject.length === 0 ? null : (
                    <div style={{ ...styles.muted, fontSize: 12 }}>
                      requires {entry.inject.join(', ')}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  )
}

function phaseChip(phase: string): CSSProperties {
  const color =
    phase === 'failed'
      ? WARNING_COLOR.error
      : phase === 'pending'
        ? WARNING_COLOR.warning
        : phase === 'active'
          ? FACT_COLOR.change
          : FACT_COLOR.keep
  return {
    border: `1px solid ${color}`,
    borderRadius: 999,
    color,
    fontSize: 11,
    padding: '1px 8px',
    whiteSpace: 'nowrap',
  }
}

function GraphReport({ graph }: { graph: GraphDocument }) {
  const warnings = lintGraph(graph)
  const summary = summarizeGraph(graph)
  const yaml = compileGraphToYaml(graph)

  return (
    <>
      {warnings.length === 0 ? null : (
        <section style={styles.card}>
          <h2 style={styles.heading}>Warnings</h2>
          <ul style={styles.list}>
            {warnings.map((warning) => (
              <li key={warning.code} style={{ color: WARNING_COLOR[warning.level] }}>
                {warning.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={styles.card}>
        <h2 style={styles.heading}>What this overlay does</h2>
        <ul style={styles.list}>
          {summary.facts.map((fact) => (
            <li key={fact.text} style={{ color: FACT_COLOR[fact.kind] }}>
              {fact.text}
            </li>
          ))}
        </ul>
      </section>

      <section style={styles.card}>
        <h2 style={styles.heading}>cordis.patch.yml</h2>
        <pre style={styles.pre}>{yaml}</pre>
      </section>
    </>
  )
}
