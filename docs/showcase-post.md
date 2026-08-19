# Draft: DSH Discussions showcase post

Not posted. Review, then post to
<https://github.com/deepseek-ai/deepseek-harness/discussions> under Show and
tell. Upstream accepts no external PRs, so a Discussion is the channel.

Before posting, replace the placeholders: a canvas screenshot, a Blueprint
screenshot, and the npm install line once the package is published.

---

**Title:** mddl — a visual editor for `cordis.patch.yml`, plus a Blueprint tab

Configuring the harness is where I kept losing time. Not the agent, the config:
an overlay that patches a row id nothing declares, two rows claiming the same
id, a `--patch` path resolved from a cwd I wasn't in. The failure usually shows
up as a broken boot, some distance from the edit that caused it.

So I built **mddl**: a canvas where you drag models and tools, wire them into an
agent loop, and get a real `cordis.patch.yml` out. Two things make it more than a
YAML pretty-printer.

**It emits deltas, not a dump.** A catalog tool that stays wired and enabled
compiles to *nothing*, because it already lives in `dsh-base`. The overlay only
carries what you actually changed, and the editor tells you which is which —
"Keep Bash from dsh-base" versus "Set default model to …". Overlays stay small
and reviewable, which is most of what makes them safe.

**It lints before you apply.** Duplicate patched row ids, a graph with no agent
loop, an overlay that disables every tool. Rows are addressed by `id`, so a
repeated id is ambiguous rather than additive — that one is easy to write and
annoying to debug.

There's also a plugin, `dsh-blueprint`, that adds a **Blueprint** tab to the
web client. Load a graph and it shows what the overlay changes, what it leaves
alone, and the warnings — inside the harness, before you apply anything. It
registers one entry in the `conversation.view` ring and follows the
`ui-trajectory` shape: a no-op host half and a browser closure factory. It reads
only the file you pick and never mutates the running harness.

```sh
npx @deepseek-ai/dsh plugin --profile web add dsh-blueprint
```

Repo: <https://github.com/taltara/mddl-harness> (MIT)

Honest about the state: it's early, the row catalog covers the shipped
`dsh-base` tools and the DeepSeek adapters, and it's verified against
`0.1.0-rc.7` / client `0.1.0-rc.8` — a moving target by design. Canvas telemetry
is a local animation, not `session/event`; wiring that up is next, along with
importing `--dump-config` so you can see a config you already have rather than
one you built.

If you hit a config shape that should be caught and isn't, that's the most
useful thing you could tell me — the lint rules are the part I most want to grow
from real breakage.

---

## Where else to list it

- `dsh-plugin` topic on GitHub — already set on the repo.
- [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness) (~746 stars) — PR to the list.
- [dshmarket](https://github.com/dsh-market/dsh-market) — the de-facto in-app marketplace.
- npm with the `dsh-plugin` keyword — already in `package.json`.
