import type { GraphDocument } from '@mddl/graph-schema'
import {
  compileGraphToYaml,
  lintGraph,
  summarizeGraph,
  type OverlayFact,
  type OverlayWarning,
} from '@mddl/compiler'
import { useState, type CSSProperties } from 'react'

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
      <section style={styles.card}>
        <h2 style={styles.heading}>dsh blueprint</h2>
        <p style={{ margin: 0 }}>
          Load a graph exported from mddl studio to see what its overlay changes
          in this harness, and what it leaves alone.
        </p>
        <p style={{ ...styles.muted, margin: '8px 0 10px' }}>
          This tab reads the file you pick. It does not change the running
          harness — applying an overlay is still <code>dsh web --patch</code>.
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
