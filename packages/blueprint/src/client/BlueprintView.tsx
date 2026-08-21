import {
  compileGraphToYaml,
  lintGraph,
  type OverlayFact,
  type OverlayWarning,
  summarizeGraph,
} from '@mddl/compiler'
import type { GraphDocument } from '@mddl/graph-schema'
import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { graphFromLive } from '../graphFromLive.ts'
import { lintLive } from '../lintLive.ts'
import type { LiveEntry } from '../live.ts'
import {
  APPLY_ROUTE,
  BACKUPS_ROUTE,
  LIVE_ROUTE,
  PRESET_ROUTE,
  PREVIEW_ROUTE,
  RESTORE_ROUTE,
} from '../routes.ts'
import { SIGNAL, SIGNAL_STYLE } from './signal.ts'

const FACT_COLOR: Record<OverlayFact['kind'], string> = {
  change: SIGNAL.allow,
  keep: SIGNAL.quiet,
  note: SIGNAL.hold,
}

const WARNING_COLOR: Record<OverlayWarning['level'], string> = {
  error: SIGNAL.veto,
  warning: SIGNAL.hold,
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
    throw new Error(
      'Not a Blueprint graph: expected version 1 with nodes and edges.',
    )
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
      {/* Scoped to this view's own custom properties, so it defines the three
          signal colours without touching anything the host styles. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a module-level
          constant with no interpolation; React escapes CSS text otherwise. */}
      <style dangerouslySetInnerHTML={{ __html: SIGNAL_STYLE }} />
      <LiveReport live={live} />

      <section style={styles.card}>
        <h2 style={styles.heading}>Check an overlay</h2>
        <p style={{ margin: 0 }}>
          Load a graph exported from the Blueprint canvas to see what its
          overlay would change here, and what it leaves alone.
        </p>
        <p style={{ ...styles.muted, margin: '8px 0 10px' }}>
          Reading only. Applying an overlay is still{' '}
          <code>dsh web --patch</code>.
        </p>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Load a Blueprint graph"
          onChange={(event) => {
            void onFile(event.target.files?.[0])
          }}
        />
        {error === undefined ? null : (
          <p style={{ color: WARNING_COLOR.error, marginBottom: 0 }}>{error}</p>
        )}
      </section>

      {live.status === 'ready' && live.csrf !== undefined ? (
        <HarnessActions entries={live.entries} csrf={live.csrf} />
      ) : null}

      {live.status === 'ready' && live.csrf !== undefined ? (
        <SnapshotsPanel csrf={live.csrf} />
      ) : null}

      {graph === undefined ? null : (
        <>
          <GraphReport graph={graph} />
          {live.status === 'ready' && live.csrf !== undefined ? (
            <ApplyPanel
              graph={graph}
              csrf={live.csrf}
              patchPath={live.patchPath}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

type LiveState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      entries: LiveEntry[]
      csrf?: string
      patchPath?: string
    }

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
        const body = (await response.json()) as {
          entries?: LiveEntry[]
          csrf?: string
          patch?: { path?: string }
        }
        if (!cancelled) {
          setState({
            status: 'ready',
            entries: body.entries ?? [],
            csrf: body.csrf,
            patchPath: body.patch?.path,
          })
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
    live.entries
      .filter((e) => e.phase === 'failed' || e.phase === 'pending')
      .map((e) => e.id),
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
            <PhaseChip key={phase} phase={phase} count={count} />
          ))}
        </div>
        {secretCount === 0 ? null : (
          <p style={{ ...styles.muted, margin: '10px 0 0', fontSize: 12 }}>
            {secretCount} credential-shaped{' '}
            {secretCount === 1 ? 'value' : 'values'} withheld on the host and
            never sent to this page.
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
                  <PhaseBadge phase={entry.phase} />
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

/**
 * Green runs, red failed, amber waiting, grey deliberately off. Disabled is a
 * choice rather than a fault, so it never takes an alarm colour.
 */
function phaseColor(phase: string): string {
  if (phase === 'failed') {
    return WARNING_COLOR.error
  }
  if (phase === 'pending' || phase === 'loading') {
    return WARNING_COLOR.warning
  }
  if (phase === 'active') {
    return FACT_COLOR.change
  }
  return FACT_COLOR.keep
}

const chipShell: CSSProperties = {
  alignItems: 'center',
  border: '1px solid rgba(127,140,160,0.3)',
  borderRadius: 999,
  display: 'inline-flex',
  gap: 6,
  fontSize: 12,
  padding: '2px 10px',
  whiteSpace: 'nowrap',
}

/** Count with a status dot. The phase name stays available as a tooltip. */
function PhaseChip({ phase, count }: { phase: string; count: number }) {
  return (
    <span style={chipShell} title={phase}>
      {/* The dot is the only part carrying the phase, so it owns the name.
          A screen reader reads "140, active" rather than a bare number. */}
      <span
        role="img"
        aria-label={phase}
        style={{
          background: phaseColor(phase),
          borderRadius: 999,
          display: 'inline-block',
          height: 8,
          width: 8,
        }}
      />
      {count}
    </span>
  )
}

/** Per-entry badge, where the phase word is the point. */
function PhaseBadge({ phase }: { phase: string }) {
  const color = phaseColor(phase)
  return (
    <span
      style={{
        border: `1px solid ${color}`,
        borderRadius: 999,
        color,
        fontSize: 11,
        padding: '1px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {phase}
    </span>
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
              <li
                key={warning.code}
                style={{ color: WARNING_COLOR[warning.level] }}
              >
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

type ApplyState =
  | { status: 'idle' }
  | { status: 'busy' }
  | {
      status: 'previewed'
      revision: string
      token: string
      diff: { kind: 'same' | 'add' | 'remove'; text: string }[]
      unchanged: boolean
      findings: { level: string; code: string; text: string }[]
    }
  | { status: 'done'; backup?: string }
  | { status: 'error'; message: string }

const DIFF_COLOR: Record<string, string> = {
  add: FACT_COLOR.change,
  remove: WARNING_COLOR.error,
  same: '#7a8699',
}

/**
 * Preview, then confirm. The token returned by the preview is required by the
 * apply, so the bytes written are the bytes that were on screen.
 */
function ApplyPanel({
  graph,
  csrf,
  patchPath,
}: {
  graph: GraphDocument
  csrf: string
  patchPath?: string
}) {
  const [state, setState] = useState<ApplyState>({ status: 'idle' })

  const post = async (route: string, body: unknown) => {
    const response = await fetch(route, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-blueprint-csrf': csrf,
      },
      body: JSON.stringify(body),
    })
    const parsed = await response.json()
    if (!response.ok) {
      throw new Error(parsed?.error ?? `host returned ${response.status}`)
    }
    return parsed
  }

  const preview = async () => {
    setState({ status: 'busy' })
    try {
      const body = await post(PREVIEW_ROUTE, { graph })
      setState({
        status: 'previewed',
        revision: body.revision,
        token: body.token,
        diff: body.diff ?? [],
        unchanged: body.unchanged === true,
        findings: body.findings ?? [],
      })
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  const confirm = async (revision: string, token: string) => {
    setState({ status: 'busy' })
    try {
      const body = await post(APPLY_ROUTE, { graph, revision, token })
      setState({ status: 'done', backup: body.backup })
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>Apply to this profile</h2>
      <p style={{ ...styles.muted, margin: '0 0 10px', fontSize: 12 }}>
        Writes only Blueprint's own block in{' '}
        <code>{patchPath ?? 'cordis.patch.yml'}</code>. Anything you wrote by
        hand in that file is left exactly as it is, and the previous file is
        backed up first. Restart the harness for the change to take effect.
      </p>

      {state.status === 'idle' || state.status === 'error' ? (
        <button
          type="button"
          onClick={() => void preview()}
          style={buttonStyle}
        >
          Preview the change
        </button>
      ) : null}

      {state.status === 'busy' ? (
        <p style={{ ...styles.muted, margin: 0 }}>Working…</p>
      ) : null}

      {state.status === 'previewed' ? (
        <>
          {state.findings.length === 0 ? null : (
            <ul style={{ ...styles.list, marginBottom: 10 }}>
              {state.findings.map((finding) => (
                <li
                  key={finding.code + finding.text}
                  style={{
                    color:
                      finding.level === 'blocking'
                        ? WARNING_COLOR.error
                        : WARNING_COLOR.warning,
                  }}
                >
                  {finding.text}
                </li>
              ))}
            </ul>
          )}
          {state.unchanged ? (
            <p style={{ color: FACT_COLOR.keep, margin: '0 0 10px' }}>
              Nothing to change — the file already says this.
            </p>
          ) : (
            <pre style={{ ...styles.pre, marginBottom: 10 }}>
              {state.diff.map((row, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: diff rows are positional and never reordered
                  key={index}
                  style={{ color: DIFF_COLOR[row.kind] }}
                >
                  {row.kind === 'add' ? '+' : row.kind === 'remove' ? '-' : ' '}
                  {row.text}
                </div>
              ))}
            </pre>
          )}
          {state.unchanged ||
          state.findings.some((f) => f.level === 'blocking') ? null : (
            <button
              type="button"
              onClick={() => void confirm(state.revision, state.token)}
              style={buttonStyle}
            >
              Write it
            </button>
          )}{' '}
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            style={buttonStyle}
          >
            Cancel
          </button>
        </>
      ) : null}

      {state.status === 'done' ? (
        <p style={{ color: FACT_COLOR.change, margin: 0 }}>
          Written.
          {state.backup === undefined
            ? ''
            : ` Previous file backed up to ${state.backup}.`}
        </p>
      ) : null}

      {state.status === 'done' ? (
        <p style={{ ...styles.muted, margin: '8px 0 0', fontSize: 12 }}>
          A restart is the real test. While this harness is running it can keep
          serving the tree it already has, so a file that looks accepted now can
          still fail from cold — there is no previous tree to fall back to then.
          If it does not come back up,{' '}
          <code>dsh --profile &lt;name&gt; --dump-default-config</code> reads
          the bundles without your overlay, and the snapshot above restores the
          file.
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p style={{ color: WARNING_COLOR.error, margin: '10px 0 0' }}>
          {state.message}
        </p>
      ) : null}
    </section>
  )
}

const buttonStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(127,140,160,0.4)',
  borderRadius: 6,
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  padding: '4px 12px',
}

interface Snapshot {
  id: string
  savedAt: string
  bytes: number
}

/**
 * Snapshots of the patch file, newest first. Restoring takes a snapshot of
 * what is there first, so rolling back is never the irreversible step.
 */
function SnapshotsPanel({ csrf }: { csrf: string }) {
  const [rows, setRows] = useState<Snapshot[] | undefined>(undefined)
  const [note, setNote] = useState<string | undefined>(undefined)

  // Stable across renders so the effect can depend on it honestly instead of
  // claiming an empty dependency list.
  const load = useCallback(async () => {
    try {
      const body = await (await fetch(BACKUPS_ROUTE)).json()
      setRows(body.backups ?? [])
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const restore = async (id: string) => {
    setNote('Restoring…')
    try {
      const response = await fetch(RESTORE_ROUTE, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-blueprint-csrf': csrf,
        },
        body: JSON.stringify({ id }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error ?? `host returned ${response.status}`)
      }
      setNote('Restored. Restart the harness to load it.')
      await load()
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : String(cause))
    }
  }

  if (rows === undefined || rows.length === 0) {
    return null
  }

  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>Snapshots</h2>
      <p style={{ ...styles.muted, margin: '0 0 10px', fontSize: 12 }}>
        Taken before every write. Restoring snapshots the current file first, so
        you can undo the undo.
      </p>
      <ul style={styles.list}>
        {rows.map((row) => (
          <li key={row.id} style={{ marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {row.savedAt.replace('T', ' ').slice(0, 19)}
            </span>{' '}
            <span style={styles.muted}>({row.bytes} bytes)</span>{' '}
            <button
              type="button"
              onClick={() => void restore(row.id)}
              style={buttonStyle}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
      {note === undefined ? null : (
        <p style={{ ...styles.muted, margin: '10px 0 0' }}>{note}</p>
      )}
    </section>
  )
}

/** Take the running config to the canvas, or turn the canvas into a preset. */
function HarnessActions({
  entries,
  csrf,
}: {
  entries: LiveEntry[]
  csrf: string
}) {
  const [presetId, setPresetId] = useState('my-preset')
  const [note, setNote] = useState<string | undefined>(undefined)

  const download = () => {
    const { graph, skipped } = graphFromLive(entries)
    const blob = new Blob([`${JSON.stringify(graph, null, 2)}\n`], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'blueprint-graph.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setNote(
      skipped.length === 0
        ? 'Downloaded. Open it in the Blueprint canvas.'
        : `Downloaded. ${skipped.length} rows the canvas does not model were left out, including ${skipped.slice(0, 3).join(', ')}.`,
    )
  }

  const savePreset = async () => {
    setNote('Saving…')
    try {
      const { graph } = graphFromLive(entries)
      const response = await fetch(PRESET_ROUTE, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-blueprint-csrf': csrf,
        },
        body: JSON.stringify({ graph, id: presetId }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error ?? `host returned ${response.status}`)
      }
      setNote(
        `Saved as "${body.id}". Presets are re-read on every use, so it is selectable now — no restart.`,
      )
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>Take it further</h2>
      <p style={{ ...styles.muted, margin: '0 0 10px', fontSize: 12 }}>
        A host overlay sets the model and the host plane. The tools a session
        actually gets come from its agent preset, so saving one is how the
        canvas changes what you experience in Chat.
      </p>
      <button type="button" onClick={download} style={buttonStyle}>
        Download this harness as a graph
      </button>{' '}
      <input
        value={presetId}
        onChange={(event) => setPresetId(event.target.value)}
        aria-label="Preset id"
        style={{
          background: 'transparent',
          border: '1px solid rgba(127,140,160,0.4)',
          borderRadius: 6,
          color: 'inherit',
          font: 'inherit',
          padding: '4px 8px',
          width: 130,
        }}
      />{' '}
      <button
        type="button"
        onClick={() => void savePreset()}
        style={buttonStyle}
      >
        Save as preset
      </button>
      {note === undefined ? null : (
        <p style={{ ...styles.muted, margin: '10px 0 0' }}>{note}</p>
      )}
    </section>
  )
}
