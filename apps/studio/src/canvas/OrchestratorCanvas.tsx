import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import { nodeTypes } from '../nodes/nodeTypes.ts'
import type { OrchestratorEdge, OrchestratorNode } from '../store/graphStore.ts'
import { useTelemetryStore } from '../store/telemetryStore.ts'
import { CanvasHint } from './CanvasHint.tsx'
import { useOrchestratorCanvas } from './useOrchestratorCanvas.ts'

export function OrchestratorCanvas() {
  const canvas = useOrchestratorCanvas()
  const activeEdgeIds = useTelemetryStore((state) => state.activeEdgeIds)

  const edges = canvas.edges.map((edge) => ({
    ...edge,
    animated: activeEdgeIds.includes(edge.id),
  }))

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target has no interactive role to take, and every module is reachable without dragging.
    <div
      className="h-full w-full"
      onDragOver={canvas.onDragOver}
      onDrop={canvas.onDrop}
    >
      <ReactFlow<OrchestratorNode, OrchestratorEdge>
        nodes={canvas.nodes}
        edges={edges}
        onNodesChange={canvas.onNodesChange}
        onEdgesChange={canvas.onEdgesChange}
        onConnect={canvas.onConnect}
        isValidConnection={canvas.isValidConnection}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: false }}
        defaultEdgeOptions={{
          style: { stroke: '#5ce1e6', strokeWidth: 1.75 },
        }}
        colorMode="dark"
      >
        <CanvasHint />
        <Background gap={22} size={1} color="#1c2230" />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(7, 8, 12, 0.72)"
          nodeColor={(node) => {
            switch (node.type) {
              case 'model':
                return '#5ce1e6'
              case 'tool':
                return '#f472b6'
              case 'agentLoop':
                return '#f5c14a'
              default:
                return '#3f3f46'
            }
          }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
