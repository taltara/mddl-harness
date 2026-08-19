import { compileGraphToYaml, lintGraph, summarizeGraph } from '@mddl/compiler'
import { useMemo, useState } from 'react'
import { copyText, downloadText } from '../lib/downloadText.ts'
import { toGraphDocument } from '../lib/toGraphDocument.ts'
import { useGraphStore } from '../store/graphStore.ts'

export function useYamlDrawer() {
  const nodes = useGraphStore((state) => state.nodes)
  const edges = useGraphStore((state) => state.edges)
  const [copied, setCopied] = useState<'yaml' | 'apply' | undefined>(undefined)

  const graph = useMemo(
    () => toGraphDocument(nodes, edges),
    [edges, nodes],
  )
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

  // The graph, not the overlay: this is what the DSH Harness Map tab loads.
  const exportGraph = () => {
    downloadText('mddl-graph.json', `${JSON.stringify(graph, null, 2)}\n`)
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
    copyYaml,
    copyApply,
  }
}
