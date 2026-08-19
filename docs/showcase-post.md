# Showcase post — ready to paste

Post to the **Show Your Plugins!** category at
<https://github.com/deepseek-ai/deepseek-harness/discussions>. Upstream accepts
no external PRs, so a Discussion is the channel.

**Before posting:** confirm npm is on 0.2.1 (`npm view dsh-blueprint version`).
0.2.0 shipped a lint bug that reported 21 false errors on a healthy harness.

**Images**, both in `scratchpad/shots/`, drop where marked below:
- `studio-canvas.png` → under "Build it on a canvas"
- `blueprint-tab.png` → under "See what's actually running"

Everything from the title down is the post. Paste it verbatim.

---

**Title:**

```
dsh-blueprint — build your harness config on a canvas, and see what's actually running
```

**Body:**

---

Two things kept costing me time in the harness, and neither was the agent.

Writing config: `cordis.patch.yml` by hand, guessing which rows exist, finding
out I was wrong at boot. And reading it back: a stock web profile boots ~140
entries, and when a feature was missing I could not answer the dumbest possible
question — *is that plugin even running?*

**dsh-blueprint** is a plugin for both halves.

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-blueprint
```

## Build it on a canvas

<!-- studio-canvas.png -->

Drag a model and the tools you want out of a searchable palette, drop them on
the canvas, and wire them into the agent loop. The wiring *is* the
configuration — no YAML to hand-write, no row ids to memorize.

It tries to stay out of your way:

- `/` jumps to palette search, matching label, row id, package, and description
  — so "fs search" finds Filesystem Search.
- Modules already placed carry an **on canvas** badge, and a filter hides them.
- Connections that cannot compile are **refused while you drag**. Tools and
  models only wire *into* an agent loop, one model per loop. You cannot draw a
  graph that fails later.
- The overlay and a plain-English summary of it recompile underneath as you
  work. The canvas survives a reload.

## See what's actually running

<!-- blueprint-tab.png -->

The plugin adds a **Blueprint** tab to the web client that reads the live
Cordis loader tree — not a file you hand it. Your config lists what you *asked
for*; only the runtime knows what loaded, what threw on the way up, and what is
still waiting for a service that never arrived.

It flags:

- **Configured but failed.** It is in your config and it threw. This is the one
  that answers "why isn't this working."
- **Still waiting on a service that never appeared** — and names the services.
  A silent half-boot looks exactly like a healthy one otherwise.
- **Disabled but still required** by something that is running.

## The overlay it writes is a diff, not a dump

A catalog tool that stays wired and enabled compiles to *nothing*, because it
already lives in `dsh-base`. The overlay carries only what you actually
changed, and the editor says which is which — "Keep Bash from dsh-base" versus
"Set default model to …".

This matters more than it sounds. Patch `config` is **full replacement, not a
deep merge**. An overlay that restates a row's whole config pins today's
defaults and quietly overrides them the next time you upgrade. Small overlays
are safe overlays.

It also lints the overlay before you apply it: duplicate patched row ids, a
graph with no agent loop, an overlay that disables every tool.

## It does not touch your config

Read-only by construction — no mutating route, no writes. Applying an overlay
is still `dsh web --patch`, by you.

Credential-shaped values are withheld **on the host** and never reach the
browser, by key (`apiKey`, `token`, …) and by value shape (`sk-…`, `bearer …`,
`scheme://user:pass@…`). Only strings can be credentials, so
`maxOutputTokens: 64` stays readable while `apiKeyEnv` does not. The route
answers same-origin loopback `GET` only, and checks the socket peer
independently of the `Host` header, so a harness bound to a LAN address does
not expose it.

## Honest about the state

Early. Verified against `0.1.0-rc.7` with client packages `0.1.0-rc.8` — a
moving target by design. The canvas catalog covers the shipped `dsh-base` tools
and the DeepSeek adapters. Canvas telemetry is still a local animation, not
`session/event`. Writing config back is next, and it is the part I want to take
slowest: managed-block confinement so hand-written YAML survives untouched,
atomic replace, and verifying the running tree matches before a change is kept.

Repo: <https://github.com/taltara/mddl-harness> · MIT

If you hit a config shape that should be caught and isn't, that is the most
useful thing you could tell me — I would rather grow the lint rules from real
breakage than from my imagination.

---

## Where else to list it

- `dsh-plugin` topic on GitHub — already set on the repo.
- [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness) (~746 stars) — PR to the list.
- [dshmarket](https://github.com/dsh-market/dsh-market) — the de-facto in-app marketplace.
- npm with the `dsh-plugin` keyword — already in `package.json`.
