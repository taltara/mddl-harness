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

## Shipped since Phase 1

- Graph persists to `localStorage` (`mddl.graph.v1`); status normalized to `idle` on save. **Reset** restores the starter graph.
- Agent Loop is a palette item, capped at one per graph (compiler patches a single loop).
- Palette search + "Not on canvas" filter + on-canvas badges. Usability is an adoption lever, not polish.
- Compiler: an off/unwired **out-of-catalog** tool now emits nothing. It used to emit `disabled: true` for a row never inserted — an unresolvable reference, the same class as upstream boot failures.
- `examples/cordis.patch.yml` is guarded by a test against `compileGraphToYaml(starterGraph)`.
- git + MIT + CI (typecheck / test / build). Studio URL is `localhost:5173` (Vite binds IPv6-only here, so `127.0.0.1` can fail).

## Upstream reality (researched 2026-08-19)

- **No external PRs accepted** (CONTRIBUTING.md); Issues disabled. Discussions + third-party plugins are the sanctioned path. Ship as a `dsh-plugin`, showcase in a Discussion.
- Upstream declined a native GUI (discussion #91). GUI/orchestration space is community-owned: `dshmarket` (~1.2k stars, plugin marketplace) dominates; `Knotline` is the only React Flow canvas and is very early.
- Top community pain is `cordis.patch.yml` / `dsh plugin add` breaking boot (#1197, #2889, #3421). Diff-not-dump compilation + patch linting is our wedge.
- Client plugin contract (verified against real source, `0.1.0-rc.8`): `dsh.client` = `{ inject: [...], platform: 'web' }`; host half `lib/index.js` (browser-only plugins export a no-op `apply`), client half `lib/client.js`.
- Tab registration: `ctx.slots.inject('conversation.view', () => ctx.slots.register({ name, id, order, locale, label, inject }, Component))`. `conversation.view` is `kind: 'list'`, `scope: 'session'`.
- Client bundle is a closure factory: `window.__ModuleLoader__.load({ id, factory: (require) => ... })`, CJS/browser, `entryFileNames: client.js`. Runtime module table is only `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `dsh-client-ui-slots`, `dsh-client-ui-primitives`, plus preloaded `dsh-client-runtime/client`. Everything else must inline or be type-only.
- **A third-party plugin needs `dsh.bundle.patch` to become a profile layer.** `dsh.client` alone installs it as a plain dependency (the CLI warns). In-repo UI plugins skip it because `dsh-web-app`'s bundle already inserts their rows; an external package inserts its own via `- insert: [{id, name}]`. `dsh plugin add` then appends the package to the profile's `dsh.profile.bundles`.
- Profile layout: `$DSH_HOME/profiles/web/{package.json,cordis.yml,cordis.patch.yml}`. `cordis.yml` is an empty `[]` — the tree is composed from `dsh.profile.bundles`, then the profile patch, then `--patch`.
- `dsh plugin add` needs `-w` at the profile workspace root (upstream #3405).
- **A patch cannot change an existing row's `name`.** Verified: patching `- id: directory-picker` with a different `name` is silently ignored, the row keeps its module. Patches replace `config`, set `disabled`, or `insert` new rows — nothing else. Swapping a module means disabling the row and inserting a replacement.
- Launcher flags precede the subcommand: `dsh --profile web --patch <file>`, never `dsh web --patch <file>` (the latter errors, since `dsh web` forwards trailing args to the web app).
- The workspace picker is `dsh-host-directory-picker-auto`, which mounts the **native** OS dialog on a Mac with a GUI. There is a `-browse` backend, but selecting it is not a patch-reachable change (see above), so headless workspace selection is not available.
- Verified end to end on rc.7: our row composes, `/plugins/dsh-blueprint/client.js` serves, and the plugin appears in `window.__DSH_BOOT__` beside ui-trajectory. Rendering the tab needs a workspace + provider key.

## Next phases

1. ~~Dual-entry plugin + view tab~~ — shipped as `dsh-blueprint`.
2. Compile graphs to **agent presets** (`agent.cordis.yml`) for web, keep host overlays for headless
3. Map `session/event` onto canvas telemetry; import plugin inventory / `--dump-config` as a graph
4. Grow the lint rules from real breakage reports — that is the differentiator.
