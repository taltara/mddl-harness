# mddl harness

Visual orchestrator for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Drag models and tools onto a canvas, then export a real `cordis.patch.yml` overlay.

This is **not** a fork of `dsh` and **not** a child-process wrapper around `npx @deepseek-ai/dsh`. Upstream already ships a web profile, Cordis patches, and `session/event` telemetry. We compile graphs into that overlay format so the work can later mount as a `dsh-plugin`.

## Why this stack

| PDF plan | What we actually do |
|---|---|
| Next.js App Router | Vite + React SPA. DSH serves static dist; RSC is dead weight. |
| Fictional `dsh.yaml` | `cordis.patch.yml` (`id` replace + `insert`) |
| Spawn `dsh run` over Socket.io | Later: Cordis plugin listening to `session/event` / `agent/*` |
| Config inside expanded nodes | Dumb nodes + inspector (keeps XYFlow at 60fps) |
| xterm.js inside nodes | Docked preview only. Terminal belongs in a later host plugin. |

## Packages

- `@mddl/graph-schema` — graph IR and the shipped DSH row catalog
- `@mddl/compiler` — graph → Cordis patch YAML, plus overlay linting
- `@mddl/studio` — visual editor
- `dsh-blueprint` — **Blueprint** tab inside the DSH web client ([readme](packages/blueprint/README.md))

## Run

```sh
pnpm install
pnpm dev
```

Studio: `http://localhost:5173`

```sh
pnpm lint       # biome check
pnpm format     # biome check --write
pnpm test
pnpm typecheck
```

CI runs lint, typecheck, test, and build on every push.

The canvas is saved to `localStorage` as you edit, so a reload keeps your graph.
**Reset** in the header restores the starter graph.

Find modules in the palette by name, row id, package, or description. Press
`/` to jump to search, and **Not on canvas** hides what you already placed.

Apply an exported overlay. `--patch` is resolved from your **terminal cwd**, not the studio. Running `./cordis.patch.yml` from `~` looks for `/Users/<you>/cordis.patch.yml`.

After **Export** (typical macOS download):

```sh
npx @deepseek-ai/dsh web --patch "$HOME/Downloads/cordis.patch.yml"
```

Or use the starter overlay in this repo (from the repo root):

```sh
npx @deepseek-ai/dsh web --patch "$PWD/examples/cordis.patch.yml"
```

## What Phase 1 does not do

Live harness execution, profile install, or a DSH client slot. "Preview telemetry" is a local animation that proves the glow/edge path. Real run state comes from `session/event` in a later phase.

## Roadmap

Shipped in `dsh-blueprint` 0.3.0: reading the live loader tree, linting the
config you actually booted, and writing an overlay back into the profile's
`cordis.patch.yml` behind a marker-delimited block that leaves hand-written
YAML untouched. Next, in order:

1. **Import the live tree onto the canvas**, so you can edit the config you
   have rather than rebuild it.
2. Map `session/event` onto canvas telemetry.
3. English and 中文 both first class.

## Status

Early. DSH is itself a developer preview with breaking changes between release
candidates, so the row ids and patch shape here track a moving target. Verified
against `@deepseek-ai/dsh` `0.1.0-rc.7`.

## License

MIT. See [LICENSE](LICENSE).
