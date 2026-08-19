# Upstream Discussion drafts

Two posts for <https://github.com/deepseek-ai/deepseek-harness/discussions>.
Both are findings from building a third-party plugin against rc.7/rc.8, and
both are things the docs do not currently say. Neither asks for anything.

Post them separately — they have different audiences. The first helps plugin
authors, the second helps anyone who edits config.

Suggested category for both: **Show and tell** or **General**, whichever the
category list offers when you post. Not a bug report; these are field notes.

---

# Post 1 — for plugin authors

**Title:**

```
Field notes from shipping a third-party plugin: dsh.bundle, the module table, and three ways I broke my own boot
```

**Body:**

I published a web-client plugin (`dsh-blueprint`) built against `0.1.0-rc.7`
with client packages at `rc.8`. Four things cost me real time that the cookbook
does not cover. Writing them down in case they save someone else the afternoon,
and in case any of it is worth folding into the docs.

### 1. A third-party plugin needs `dsh.bundle`, not just `dsh.client`

This is the one that stops you before anything else works. I declared
`dsh.client` the way `ui-trajectory` does, ran `dsh plugin --profile web add`,
and nothing appeared. The CLI does tell you, and the message is exact:

```
warning: <pkg> declares no dsh.bundle — installed as a plain dependency,
not a profile layer (a later update that gains one activates it automatically)
```

The in-repo UI plugins do not need one because `dsh-web-app`'s bundle patch
already inserts their rows. A package outside the repo has to insert its own:

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "inject": ["@deepseek-ai/dsh-client-ui-conversation"], "platform": "web" }
}
```

```yaml
# cordis.patch.yml
- insert:
    - id: ui-blueprint
      name: 'my-package'
```

`dsh plugin add` then appends the package to the profile's
`dsh.profile.bundles` and the row composes. Following `ui-trajectory` as a
template — which is otherwise an excellent template — leads you straight into
this, because the one file you need is the one it does not have.

### 2. `inject` at module level must be an array

I wanted an optional service, so I wrote the object form:

```ts
export const inject = { required: ['loader', 'webServer'], optional: ['agentPresets'] }
```

The result was that the entry never activated and the **whole harness refused
to boot**:

```
dsh: plugin tree failed to load: dsh: 1 entry did not activate
<pkg>: pending (waiting for services: required, optional)
```

It read the object's keys as service names. A plain array works. If the object
form is meant to be supported at module level, this is a bug report; if it is
not, it is worth a line in the cookbook, because the failure is total rather
than local.

### 3. Reading an undeclared service throws rather than returning undefined

Related, and it is the right design — just worth stating. This does not
degrade gracefully:

```ts
const presets = (ctx as { agentPresets?: ... }).agentPresets  // throws
// cannot get property "agentPresets" without inject
```

So "check whether the service exists" is not a thing you can do defensively
from outside `inject`. I ended up not needing the service at all, which was the
better answer anyway.

### 4. The browser module table is small, and that is a feature

For anyone building a client bundle: the shell shares exactly `react`,
`react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`,
`dsh-client-ui-slots`, `dsh-client-ui-primitives`, plus preloaded
`dsh-client-runtime/client`. Everything else must inline or be type-only —
including `dsh-client-ui-conversation`, which you import type-only to get the
`conversation.view` SlotMap row into the program while declaring it in
`dsh.client.inject`.

Once that clicked, the bundle contract was straightforward: CJS for the
browser, wrapped in

```js
window.__ModuleLoader__.load({ id: "<package name>", factory: (require) => { ... } })
```

with the id matching the package name, since the shell serves it from
`/plugins/<name>/client.js`.

---

Happy to open a PR against the cookbook if external PRs ever open up. In the
meantime the working example is MIT if it is useful to anyone:
<https://github.com/taltara/mddl-harness/tree/main/packages/blueprint>

---

# Post 2 — for anyone who edits config

**Title:**

```
A bad row in cordis.patch.yml doesn't disable a plugin — it stops the harness booting entirely
```

**Body:**

I hit this while building tooling that edits overlays, and I think it is worth
stating plainly because the failure is much larger than it looks.

I added a row naming a package that was not installed in the profile:

```yaml
- insert:
    - id: probe
      name: '@example/not-installed'
```

I expected one dead entry that I could then inspect. What actually happens is
`ERR_MODULE_NOT_FOUND` during boot and **the process exits**. Not a degraded
row — no harness at all. Which means:

- The Web UI is gone, so you cannot fix it in the Web UI.
- Anything that inspects a running tree cannot help you, because there is no
  running tree.
- The only way back is editing YAML by hand, or restoring a backup.

That is a sharp edge for a file people are encouraged to hand-edit, and it is
the same shape as several boot incidents already reported here.

**What I took from it, in case it is useful to others building on this:**

The check has to happen before the write, not after. In my own tooling I now
verify every inserted package is present in the profile before an overlay is
written, and refuse the write otherwise — because after the write there is
nothing left running to warn in. Snapshotting the file before each write turned
out to matter just as much; I bricked my own test harness twice while learning
this, and the backup is what got it back.

**Two things that might be worth considering upstream**, offered as questions
rather than requests:

1. Could an unresolvable row fail *that entry* rather than the process? A
   plugin that cannot load is bad; a harness that will not start is worse,
   because it removes every tool you would use to diagnose it.
2. Would a `dsh --profile <p> --check` that validates an overlay without
   booting be welcome? There is clear appetite for a doctor command
   (discussion #1719 has 57 comments), and resolvability seems like the
   highest-value single check.

Either way, the behaviour is worth a line in the config docs. "A row naming a
package you have not installed will prevent startup" is the sentence I wish I
had read first.
