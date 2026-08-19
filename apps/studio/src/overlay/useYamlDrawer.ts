import { compileGraphToYaml, lintGraph, summarizeGraph } from '@mddl/compiler'
import type { GraphDocument } from '@mddl/graph-schema'
import { useMemo, useState } from 'react'
import { copyText, downloadText } from '../lib/downloadText.ts'
import { toGraphDocument } from '../lib/toGraphDocument.ts'
import { useGraphStore } from '../store/graphStore.ts'

export function useYamlDrawer() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const [copied, setCopied] = useState<'yaml' | 'apply' | undefined>(undefined)
  const [importError, setImportError] = useState<string | undefined>(undefined)
  const loadGraph = useGraphStore((state) => state.loadGraph)

  const graph = useMemo(() => toGraphDocument(nodes, edges), [edges, nodes])
  const yaml = useMemo(() => compileGraphToYaml(graph), [graph])
  const summary = useMemo(() => summarizeGraph(graph), [graph])
  const warnings = useMemo(() => lintGraph(graph), [graph])

  const flash = (which: 'yaml' | 'apply') => {
    setCopied(which)
    window.setTimeout(() => setCopied(undefined), 1200)
  }

  const exportYaml = () => {
    downloadText('cordis.patch.yml', yaml)
  }

  /**
   * Read a graph back in — exported from here, or downloaded from the
   * Blueprint tab, which is how you edit the config a harness is running
   * rather than rebuilding it by hand.
   */
  const importGraph = async (file: File | undefined) => {
    if (file === undefined) {
      return
    }
    try {
      const parsed = JSON.parse(await file.text()) as GraphDocument
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges)
      ) {
        throw new Error('expected a version 1 graph with nodes and edges')
      }
      loadGraph(parsed)
      setImportError(undefined)
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  // The graph, not the overlay: this is what the DSH Blueprint tab loads.
  const exportGraph = () => {
    downloadText('blueprint-graph.json', `${JSON.stringify(graph, null, 2)}\n`)
  }

  const copyYaml = async () => {
    await copyText(yaml)
    flash('yaml')
  }

  const copyApply = async () => {
    await copyText(summary.applyCommand)
    flash('apply')
  }

  return {
    yaml,
    summary,
    warnings,
    copied,
    exportYaml,
    exportGraph,
    importGraph,
    importError,
    copyYaml,
    copyApply,
  }
}
