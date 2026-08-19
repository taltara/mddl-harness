# dsh-harness-gui

Adds a **Harness Map** tab to the DeepSeek Harness web client. Load a graph
exported from mddl studio and the tab shows what its overlay changes, what it
leaves alone, and anything that would break a boot — before you apply it.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-harness-gui
```

Then start the web profile and open the **Harness Map** tab in a conversation:

```sh
npx @deepseek-ai/dsh web
```

## What it does

- **Warnings first.** Duplicate row ids, a graph with no agent loop, and an
  overlay that disables every tool. Rows are addressed by `id`, so a repeated
  id is ambiguous rather than additive.
- **Change vs keep.** Catalog tools that stay wired and enabled emit nothing —
  they already live in `dsh-base` — so the fact list distinguishes a real
  change from an unchanged row.
- **The overlay itself**, exactly as `cordis.patch.yml` would be written.

The tab reads only the file you pick. It does not mutate the running harness;
applying an overlay is still `dsh web --patch <absolute path>`.

## Shape

Dual entry, matching the shipped `ui-trajectory` plugin:

- `lib/index.js` — host half. Browser-only plugin, so `apply` is a no-op.
- `lib/client.js` — browser half, a closure factory the shell's module loader
  executes. Registers one entry in the session-scoped `conversation.view`
  slot ring.

Plus `cordis.patch.yml`, declared as `dsh.bundle.patch`. **A third-party plugin
needs this to become a profile layer** — `dsh.client` alone installs it as a
plain dependency, and `dsh plugin add` says so:

```
warning: dsh-harness-gui declares no dsh.bundle — installed as a plain
dependency, not a profile layer
```

The in-repo UI plugins do not need one, because the `dsh-web-app` bundle
already inserts their rows. A package outside the repo inserts its own.

The client bundle requires only `react` and `react/jsx-runtime` from the
shell's module table; `@mddl/compiler` and `@mddl/graph-schema` are inlined.

## Verified against a real harness

On `@deepseek-ai/dsh` `0.1.0-rc.7` (client packages `0.1.0-rc.8`), installed
into a real web profile:

- `dsh plugin --profile web add` appends the package to the profile's
  `dsh.profile.bundles`.
- `dsh --profile web --dump-config` shows the composed row:
  `- id: mddl-harness-map / name: 'dsh-harness-gui'`.
- `dsh web` serves `/plugins/dsh-harness-gui/client.js` and lists the plugin
  in the browser boot roster beside `ui-trajectory`, with no console errors.

Rendering the tab needs a live conversation, which needs a workspace and a
provider key, so that last step is yours to eyeball. DSH is a developer
preview and its plugin API is still moving.

## Build

```sh
pnpm --filter dsh-harness-gui build
```
