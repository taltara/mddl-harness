# dsh-blueprint

Adds a **Blueprint** tab to the DeepSeek Harness web client. It reads the
config your harness *actually booted* — not a file you hand it — tells you what
is broken in it, and checks an overlay before you apply it.

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-blueprint
```

Then start the web profile and open the **Blueprint** tab in a conversation:

```sh
npx @deepseek-ai/dsh web
```

## What it does

**Reads the live loader tree.** The host half projects `ctx.loader.entries()`
onto a read-only JSON route, so the tab shows post-merge reality: every entry
that booted, with its runtime phase. A file-based tool cannot show you that a
plugin is configured, loaded, and *crashed* — that fact only exists at runtime.

**Tells you what is wrong with it.** Live checks, not YAML checks:

- `entry-failed` — configured, not running. It is in your config and it threw.
- `entry-pending` — still waiting for a service that never appeared, naming the
  services it waits on. A silent half-boot looks identical to a healthy one.
- `disabled-dependency` — you disabled something another live entry requires.
- `duplicate-entry-id` — rows are addressed by `id`, so a repeat is ambiguous
  rather than additive.

**Checks an overlay before you apply it.** Load a graph exported from mddl
studio and the tab shows what changes, what stays, and the same lint pass —
plus the exact `cordis.patch.yml` that would be written.

## Safety

Read-only by construction: this plugin registers no mutating route and never
writes config.

Credential-shaped values are withheld **on the host** and never reach the
browser. Detection is by key (`apiKey`, `token`, `secret`, …) and by value
shape (`sk-…`, `bearer …`, `scheme://user:pass@…`), and only strings can be
credentials — so `maxOutputTokens: 64` stays visible while `apiKeyEnv` does
not. Values that merely nest are reported separately from secrets: calling a
port number "redacted" trains people to ignore the word where it matters.

The route answers same-origin loopback `GET` only. The socket peer is checked
independently of the `Host` header, so a harness bound to a LAN address does
not expose it, and a cross-site fetch is refused even from loopback.

## Shape

Dual entry, matching the shipped `ui-trajectory` plugin:

- `lib/index.js` — host half. `inject = ['loader', 'webServer']`; registers one
  exact route, `GET /dsh-blueprint/api/live`.
- `lib/client.js` — browser half, a closure factory the shell's module loader
  executes. Registers one entry in the session-scoped `conversation.view` ring.

Plus `cordis.patch.yml`, declared as `dsh.bundle.patch`. **A third-party plugin
needs this to become a profile layer** — `dsh.client` alone installs it as a
plain dependency, and `dsh plugin add` says so:

```
warning: dsh-blueprint declares no dsh.bundle — installed as a plain
dependency, not a profile layer
```

The in-repo UI plugins do not need one, because the `dsh-web-app` bundle
already inserts their rows. A package outside the repo inserts its own.

## Verified against a real harness

On `@deepseek-ai/dsh` `0.1.0-rc.7` (client packages `0.1.0-rc.8`), installed
into a real web profile:

- `dsh plugin --profile web add` appends the package to the profile's
  `dsh.profile.bundles`; `--dump-config` shows the composed row `ui-blueprint`.
- `dsh web` serves `/plugins/dsh-blueprint/client.js` and lists the plugin in
  the browser boot roster beside `ui-trajectory`.
- The live route returns the real tree — 140 entries on a stock web profile —
  with a credential audit showing nothing credential-shaped in the payload.
- A foreign `Host` header, a cross-site fetch, and any non-`GET` method are
  each refused with 403.

DSH is a developer preview and its plugin API is still moving.

## Build

```sh
pnpm --filter dsh-blueprint build
pnpm --filter dsh-blueprint test
```
