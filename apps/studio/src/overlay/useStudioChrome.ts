import { useState } from 'react'
import { useYamlDrawer } from './useYamlDrawer.ts'
import { useGraphStore } from '../store/graphStore.ts'
import { useTelemetryStore } from '../store/telemetryStore.ts'

export function useStudioChrome() {
  const [yamlOpen, setYamlOpen] = useState(true)
  const previewing = useTelemetryStore((state) => state.previewing)
  const startPreview = useTelemetryStore((state) => state.startPreview)
  const stopPreview = useTelemetryStore((state) => state.stopPreview)
  const resetGraph = useGraphStore((state) => state.resetGraph)
  const { exportYaml } = useYamlDrawer()

  return {
    yamlOpen,
    previewing,
    resetGraph: () => {
      if (window.confirm('Reset the canvas to the starter graph?')) {
        stopPreview()
        resetGraph()
      }
    },
    toggleYaml: () => setYamlOpen((open) => !open),
    togglePreview: () => {
      if (previewing) {
        stopPreview()
        return
      }
      startPreview()
    },
    exportYaml,
  }
}
