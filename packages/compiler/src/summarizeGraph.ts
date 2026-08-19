import { type GraphDocument, isCatalogToolRowId } from '@mddl/graph-schema'

export const DSH_APPLY_COMMAND =
  'npx @deepseek-ai/dsh web --patch "$HOME/Downloads/cordis.patch.yml"'

export const DSH_WEB_URL = 'http://127.0.0.1:3080'

export const OVERLAY_FACT_KINDS = ['change', 'keep', 'note'] as const

export type OverlayFactKind = (typeof OVERLAY_FACT_KINDS)[number]

export type OverlayFact = {
  kind: OverlayFactKind
  text: string
}

export type OverlaySummary = {
  applyCommand: string
  webUrl: string
  facts: OverlayFact[]
  attached: false
}

function wiredSourceIds(graph: GraphDocument, agentId: string): Set<string> {
  return new Set(
    graph.edges
      .filter((edge) => edge.target === agentId)
      .map((edge) => edge.source),
  )
}

export function summarizeGraph(graph: GraphDocument): OverlaySummary {
  const agent = graph.nodes.find((node) => node.data.kind === 'agentLoop')
  const wiredIds =
    agent === undefined ? new Set<string>() : wiredSourceIds(graph, agent.id)
  const facts: OverlayFact[] = []

  for (const node of graph.nodes) {
    switch (node.data.kind) {
      case 'model': {
        if (agent !== undefined && !wiredIds.has(node.id)) {
          facts.push({
            kind: 'note',
            text: `${node.data.label} is on the canvas but not wired, so it is ignored.`,
          })
          break
        }
        facts.push({
          kind: 'change',
          text: `Set default model to ${node.data.label} (${node.data.rowId}).`,
        })
        break
      }
      case 'tool': {
        const wired = agent === undefined || wiredIds.has(node.id)
        const inBase = isCatalogToolRowId(node.data.rowId)
        if (!node.data.enabled || !wired) {
          facts.push(
            inBase
              ? {
                  kind: 'change',
                  text: `Disable ${node.data.label} (${node.data.rowId}).`,
                }
              : {
                  kind: 'note',
                  text: `${node.data.label} is off or not wired, so it is not inserted.`,
                },
          )
          break
        }
        if (inBase) {
          facts.push({
            kind: 'keep',
            text: `Keep ${node.data.label} from dsh-base (${node.data.rowId}).`,
          })
          break
        }
        facts.push({
          kind: 'change',
          text: `Insert ${node.data.label} as ${node.data.rowId}.`,
        })
        break
      }
      case 'agentLoop': {
        if (node.data.persona.trim() === '') {
          facts.push({
            kind: 'keep',
            text: 'Keep the bundle persona (system-prompt unchanged).',
          })
          break
        }
        facts.push({
          kind: 'change',
          text: 'Patch system-prompt persona.',
        })
        break
      }
      default: {
        const _exhaustive: never = node.data
        throw new Error(`Unhandled node kind: ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  return {
    applyCommand: DSH_APPLY_COMMAND,
    webUrl: DSH_WEB_URL,
    facts: [
      {
        kind: 'note',
        text: 'This overlay does not add a DSH UI tab. Web sessions load tools from agent presets, not from wired canvas tools.',
      },
      ...facts,
    ],
    attached: false,
  }
}
