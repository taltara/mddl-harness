import { ReactFlowProvider } from '@xyflow/react'
import { OrchestratorCanvas } from '../canvas/OrchestratorCanvas.tsx'
import { InspectorPanel } from '../inspector/InspectorPanel.tsx'
import { Palette } from '../overlay/Palette.tsx'
import { StudioChrome } from '../overlay/StudioChrome.tsx'
import { YamlDrawer } from '../overlay/YamlDrawer.tsx'
import { useApp } from './useApp.ts'

export function App() {
  const app = useApp()

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-canvas font-sans">
        <StudioChrome
          previewing={app.previewing}
          yamlOpen={app.yamlOpen}
          onTogglePreview={app.togglePreview}
          onToggleYaml={app.toggleYaml}
          onExportYaml={app.exportYaml}
          onResetGraph={app.resetGraph}
        />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <OrchestratorCanvas />
            </div>
            <YamlDrawer open={app.yamlOpen} />
          </main>
          <InspectorPanel />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
