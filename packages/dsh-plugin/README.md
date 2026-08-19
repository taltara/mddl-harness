# @mddl/dsh-plugin

Adds a **Harness Map** tab to the DeepSeek Harness web client. Load a graph
exported from mddl studio and the tab shows what its overlay changes, what it
leaves alone, and anything that would break a boot — before you apply it.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add @mddl/dsh-plugin
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

The client bundle requires only `react` and `react/jsx-runtime` from the
shell's module table; `@mddl/compiler` and `@mddl/graph-schema` are inlined.

Verified against `@deepseek-ai/dsh` `0.1.0-rc.7` / client packages
`0.1.0-rc.8`. DSH is a developer preview and its plugin API is still moving.

## Build

```sh
pnpm --filter @mddl/dsh-plugin build
```
