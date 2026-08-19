export interface ToolCatalogEntry {
  rowId: string
  packageName: string
  label: string
  description: string
}

export interface ModelCatalogEntry {
  rowId: 'agent-default-model'
  adapterPackage: string
  provider: string
  model: string
  label: string
  description: string
}

export interface AgentLoopCatalogEntry {
  rowId: 'agent-loop'
  systemPromptRowId: 'system-prompt'
  label: string
  description: string
}

export const AGENT_LOOP_ENTRY: AgentLoopCatalogEntry = {
  rowId: 'agent-loop',
  systemPromptRowId: 'system-prompt',
  label: 'Agent Loop',
  description: 'Session loop. Wire a model and tools into it. One per graph.',
}

export const MODEL_CATALOG: readonly ModelCatalogEntry[] = [
  {
    rowId: 'agent-default-model',
    adapterPackage: '@deepseek-ai/dsh-llm-deepseek',
    provider: 'deepseek-official',
    model: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    description: 'Default shipped DeepSeek adapter + flash model.',
  },
  {
    rowId: 'agent-default-model',
    adapterPackage: '@deepseek-ai/dsh-llm-deepseek',
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'Same official adapter, higher-capacity model.',
  },
]

export const TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  {
    rowId: 'tool-bash',
    packageName: '@deepseek-ai/dsh-tool-bash',
    label: 'Bash',
    description: 'Sandboxed shell. Already in dsh-base.',
  },
  {
    rowId: 'tool-web',
    packageName: '@deepseek-ai/dsh-tool-web',
    label: 'Web Search',
    description: 'Model-facing search. Fetch stays off in dsh-base.',
  },
  {
    rowId: 'tool-fs',
    packageName: '@deepseek-ai/dsh-tool-fs',
    label: 'Filesystem',
    description: 'Sandboxed file tools. Already in dsh-base.',
  },
  {
    rowId: 'tool-fs-search',
    packageName: '@deepseek-ai/dsh-tool-fs-search',
    label: 'Filesystem Search',
    description: 'Glob / content search over the workspace.',
  },
  {
    rowId: 'tool-str-replace-editor',
    packageName: '@deepseek-ai/dsh-tool-str-replace-editor',
    label: 'File Editor',
    description: 'str_replace_editor. Used by Minimal mode.',
  },
  {
    rowId: 'tool-todo',
    packageName: '@deepseek-ai/dsh-tool-todo',
    label: 'Todo Write',
    description: 'Same-session todo list for the agent.',
  },
  {
    rowId: 'tool-skill',
    packageName: '@deepseek-ai/dsh-tool-skill',
    label: 'Skill',
    description: 'Invoke a loaded skill.',
  },
  {
    rowId: 'tool-subagent',
    packageName: '@deepseek-ai/dsh-tool-subagent',
    label: 'Subagent',
    description: 'Spawn a child agent.',
  },
]

const CATALOG_ROW_IDS = new Set(TOOL_CATALOG.map((entry) => entry.rowId))

export function isCatalogToolRowId(rowId: string): boolean {
  return CATALOG_ROW_IDS.has(rowId)
}

export function findToolCatalogEntry(
  rowId: string,
): ToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((entry) => entry.rowId === rowId)
}
