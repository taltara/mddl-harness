# mddl harness

Visual orchestrator for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Drag models and tools onto a canvas, then export a real `cordis.patch.yml` overlay.

This is **not** a fork of `dsh` and **not** a child-process wrapper around `npx @deepseek-ai/dsh`. Upstream already ships a web profile, Cordis patches, and `session/event` telemetry. We compile graphs into that overlay format so the work can later mount as a `dsh-plugin`.

Drag models and tools onto the canvas, wire them into the agent loop, and export
the overlay. `pnpm dev` opens it at <http://localhost:5173>; see
[docs/DEMO.md](docs/DEMO.md) for the exact view the readme describes.

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
- `dsh-overlay-check` — the overlay safety checks on their own, no dependencies, for anything that writes config ([readme](packages/overlay-check/README.md))

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

## Capability disclosure

Before an overlay row is written, the preflight reports what each inserted
package declares it may do, using a [capmark](https://github.com/taltara/capmark)
manifest if the package ships one:

```
warning  capability-high-risk  "build-helper" declares fs:read, proc:spawn.
                               proc:spawn hands over broad control — read its
                               manifest before applying.
```

This is the one decision a runtime gate cannot make. A plugin's `apply()` runs
in-process with full Node privileges the moment its row loads, before any tool
call exists, so the write is the last point where installing it is still a
choice. It reports and never blocks: almost no plugin carries a manifest today,
and refusing them would make the check useless against a real profile.

`dsh-overlay-check` stays dependency-free; this lives in `dsh-blueprint`.

## Roadmap

Shipped in `dsh-blueprint` 0.5.0: reading the live loader tree, linting the
config you actually booted, writing an overlay back behind a marker-delimited
block, refusing to write a row that would stop the harness booting, snapshots
with one-click restore, importing the running config onto the canvas, and
compiling to agent presets so the canvas changes what a session actually gets.
Next, in order:

1. Map `session/event` onto canvas telemetry, replacing the local animation.
2. English and 中文 both first class.
3. Model rows beyond the shipped DeepSeek adapters.

## If a harness will not start

A row naming a package the profile cannot load stops the harness booting
outright, rather than disabling one entry. `dsh-blueprint` refuses to write one,
but if you get there by another route, two things help:

- `dsh --profile <name> --dump-default-config` reads the bundles while skipping
  the profile and home user layers, so it still answers when the overlay is the
  problem. Confirmed on rc.7: a row written into a profile's `cordis.patch.yml`
  shows in `--dump-config` and is absent from `--dump-default-config`.
- The [DSH handbook's recovery runbook](https://sandbaseai.github.io/deepseek-harness-handbook/invalid-overlay-boot-failure.html)
  by the sandbaseai folks is the most thorough write-up of getting back from
  this, including which user layer owns which file.

## Status

Early. DSH is itself a developer preview with breaking changes between release
candidates, so the row ids and patch shape here track a moving target. Verified
against `@deepseek-ai/dsh` `0.1.0-rc.7` and `0.1.1-rc.2`.

One thing `0.1.1-rc.2` does not fix: `agent-presets.roots` set in an overlay is
replaced at boot with the shipped root, and `--dump-config` still prints your
value because the override is applied after the composition it prints. See
[deepseek-harness#403](https://github.com/deepseek-ai/deepseek-harness/discussions/403).
`dsh-overlay-check` warns on it rather than letting an overlay claim it
silently.

## License

MIT. See [LICENSE](LICENSE).
