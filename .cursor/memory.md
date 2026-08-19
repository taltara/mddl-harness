# mddlHarness memory

Updated: 2026-08-18

## Product

Visual orchestrator for DeepSeek Harness (`dsh`). Graph is the studio source of truth. Compiler emits a `cordis.patch.yml` overlay. Do not hard-fork `deepseek-ai/deepseek-harness`. Do not spawn the CLI as an opaque subprocess.

## Real DSH contracts (do not regress)

- Composition: profile bundles → profile `cordis.patch.yml` → home overlay → `--patch`
- Rows addressed by `id`. Patch replaces whole `config`, or `insert`s new rows.
- Apply: `dsh web --patch <absolute-path-to-cordis.patch.yml>` (`--patch` is cwd-relative; `./` from `~` is `$HOME/cordis.patch.yml`)
- Telemetry: append-only session log; UI should later subscribe to `session/event` and `agent/*`
- Existing web UI at `:3080` (`dsh-web-app`). Upstream merge path is a client plugin (`ctx.slots` / `conversation.view` tab), not a parallel Next app.
- Plugin module: `export function apply(ctx)` + `inject`

## Stack (locked for Phase 1)

- pnpm workspaces, Node >= 22.19
- Vite + React 19 + Tailwind 4 + `@xyflow/react` + Zustand
- Packages: `graph-schema`, `compiler`, `studio`

Rejected from the research PDF: Next.js, Socket.io bridge, `dsh.yaml`, Framer on every node, xterm inside nodes.

## Layout

- `apps/studio` — canvas, palette, inspector, YAML drawer
- `packages/graph-schema` — IR + catalog + starter graph
- `packages/compiler` — `compileGraphToPatch` / `compileGraphToYaml` / `summarizeGraph`

## Web vs studio

- `--patch` is cwd-relative and **does not write** `~/.dsh/profiles/web/cordis.patch.yml`. Restart without `--patch` drops the overlay.
- Web profile disables host-plane tools (`tool-bash`, `tool-fs`, `tool-web`, …). Sessions get tools from **agent presets** (`standard`, `code`, `minimal`, `cordis`/Creator).
- A host overlay is invisible in Chat. Settings → Models is the only starter-graph effect. Settings → Plugins is the plugin inventory (`ui-settings-plugin-inventory`). Trajectory is a `conversation.view` tab. `ui-cordis` is Creator-mode dynamic plugin cards, not a composition canvas.
- Upstream shape: npm package with `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` plus `"dsh": { "client": { "platform": "web" } }`, installed via `dsh plugin --profile web add`, registering a `conversation.view` tab (Trajectory is the template).

## Next phases

1. Dual-entry `@mddl/dsh-plugin`: host `apply` + `dsh.client` view tab inside `:3080`
2. Compile graphs to **agent presets** (`agent.cordis.yml`) for web, keep host overlays for headless
3. Map `session/event` onto canvas telemetry; import plugin inventory / `--dump-config` as a graph
