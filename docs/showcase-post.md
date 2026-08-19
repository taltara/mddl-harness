# Draft: DSH Discussions showcase post

**Do not post until `dsh-blueprint` 0.2.0 is on npm.** As of writing, npm has
0.1.0, which cannot read the live config — the thing this post leads with.
Check with `npm view dsh-blueprint version` first.

Post to <https://github.com/deepseek-ai/deepseek-harness/discussions> under
Show and tell. Upstream accepts no external PRs, so a Discussion is the channel.

Screenshots to add before posting:
1. The Blueprint tab showing the phase chips and a health warning.
2. The studio canvas with the overlay drawer open.

---

**Title:** dsh-blueprint — see the config your harness actually booted, and what's broken in it

When something in my harness wasn't working, the hard part was never the agent.
It was answering a much dumber question: *is this plugin even running?*

A stock web profile boots around 140 entries. Your config file lists what you
asked for. It cannot tell you which of those loaded, which threw on the way up,
and which are still sitting there waiting for a service that never arrived —
because those are runtime facts, not YAML. So a plugin that silently failed
looks exactly like a plugin that works, until the feature just isn't there.

**dsh-blueprint** adds a Blueprint tab to the web client that reads the live
Cordis loader tree and tells you:

- **Configured but failed.** It's in your config and it threw. This is the one
  that answers "why isn't this working."
- **Still waiting on a service that never appeared** — and which services, by
  name. A silent half-boot is indistinguishable from a healthy one otherwise.
- **Disabled but still required** by something that is running.
- **Duplicate entry ids.** Rows are addressed by `id`, so a repeat is ambiguous
  rather than additive.

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-blueprint
```

### It also checks an overlay before you apply it

The other half is a canvas: drag models and tools, wire them into an agent
loop, and get a real `cordis.patch.yml` out. Two things make it more than a
YAML pretty-printer.

**It emits deltas, not a dump.** A catalog tool that stays wired and enabled
compiles to *nothing*, because it already lives in `dsh-base`. The overlay
carries only what you actually changed, and the editor says which is which —
"Keep Bash from dsh-base" versus "Set default model to …". This matters more
than it sounds: patch `config` is full replacement, not a deep merge, so an
overlay that restates a row's whole config pins today's defaults and quietly
overrides them the next time you upgrade. Small overlays are safe overlays.

**It lints before you apply.** Duplicate patched row ids, a graph with no agent
loop, an overlay that disables every tool.

### It does not touch your config

Read-only by construction: it registers no mutating route and never writes
config. Applying an overlay is still `dsh web --patch`, by you.

Credential-shaped values are withheld **on the host** and never reach the
browser — by key (`apiKey`, `token`, …) and by value shape (`sk-…`,
`bearer …`, `scheme://user:pass@…`). Only strings can be credentials, so
`maxOutputTokens: 64` stays readable while `apiKeyEnv` doesn't. The route
answers same-origin loopback `GET` only, and checks the socket peer
independently of the `Host` header, so a harness bound to a LAN address does
not expose it.

Repo: <https://github.com/taltara/mddl-harness> (MIT)

### Honest about the state

Early. Verified against `0.1.0-rc.7` with client packages `0.1.0-rc.8` — a
moving target by design, and the plugin API has already shifted twice since
launch. The canvas catalog covers the shipped `dsh-base` tools and the DeepSeek
adapters. Canvas telemetry is still a local animation, not `session/event`.
Writing config back is next, and it is the part I want to get slowest and most
carefully: managed-block confinement so hand-written YAML survives untouched,
atomic replace, and verifying the running tree matches before a change is kept.

If you hit a config shape that should be caught and isn't, that's the most
useful thing you could tell me — the lint rules are the part I most want to
grow from real breakage rather than from my imagination.

---

## Where else to list it

- `dsh-plugin` topic on GitHub — already set on the repo.
- [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness) (~746 stars) — PR to the list.
- [dshmarket](https://github.com/dsh-market/dsh-market) — the de-facto in-app marketplace.
- npm with the `dsh-plugin` keyword — already in `package.json`.
