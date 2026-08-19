I published a web-client plugin (`dsh-blueprint`) built against `0.1.0-rc.7` with client packages at `rc.8`. Four things cost me real time that the cookbook does not cover. Writing them down in case they save someone else the afternoon, and in case any of it is worth folding into the docs.

### A third-party plugin needs `dsh.bundle`, not just `dsh.client`

This is the one that stops you before anything else works. I declared `dsh.client` the way `ui-trajectory` does, ran `dsh plugin --profile web add`, and nothing appeared. The CLI does tell you, and the message is exact:

```text
warning: <pkg> declares no dsh.bundle — installed as a plain dependency,
not a profile layer (a later update that gains one activates it automatically)
```

The in-repo UI plugins do not need one because the `dsh-web-app` bundle patch already inserts their rows. A package outside the repo has to insert its own.

In `package.json`:

```json
{
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": ["@deepseek-ai/dsh-client-ui-conversation"],
      "platform": "web"
    }
  }
}
```

And a `cordis.patch.yml` beside it:

```yaml
- insert:
    - id: ui-blueprint
      name: 'my-package'
```

`dsh plugin add` then appends the package to the profile's `dsh.profile.bundles`, and the row composes. Following `ui-trajectory` as a template — which is otherwise an excellent template — leads you straight into this, because the one file you need is the one it does not have.

### `inject` at module level must be an array

I wanted an optional service, so I wrote the object form:

```ts
export const inject = {
  required: ['loader', 'webServer'],
  optional: ['agentPresets'],
}
```

The result was that the entry never activated and the **whole harness refused to boot**:

```text
dsh: plugin tree failed to load: dsh: 1 entry did not activate
<pkg>: pending (waiting for services: required, optional)
```

It read the object's keys as service names. A plain array works. If the object form is meant to be supported for a module-level `inject`, this is a bug report; if it is not, it seems worth a line in the cookbook, because the failure is total rather than local.

### Reading an undeclared service throws rather than returning undefined

Related, and it is the right design — just worth stating. This does not degrade gracefully:

```ts
const presets = (ctx as { agentPresets?: unknown }).agentPresets
// throws: cannot get property "agentPresets" without inject
```

So "check whether the service exists" is not something you can do defensively from outside `inject`. I ended up not needing the service at all, which was the better answer anyway.

### The browser module table is small, and that is a feature

For anyone building a client bundle, the shell shares exactly these:

- `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`
- `@deepseek-ai/cordis`
- `@deepseek-ai/dsh-client-ui-slots`
- `@deepseek-ai/dsh-client-ui-primitives`
- preloaded: `@deepseek-ai/dsh-client-runtime/client`

Everything else must be inlined or type-only — including `dsh-client-ui-conversation`, which you import type-only to get the `conversation.view` SlotMap row into the program, while declaring it in `dsh.client.inject`.

Once that clicked, the bundle contract was straightforward: CJS for the browser, wrapped in the loader handoff, with the id matching the package name since the shell serves it from `/plugins/<name>/client.js`.

```js
window.__ModuleLoader__.load({
  id: '<package name>',
  factory: (require) => {
    /* ... */
  },
})
```

Happy to open a PR against the cookbook if external PRs ever open up. In the meantime the working example is MIT if it is useful to anyone: https://github.com/taltara/mddl-harness/tree/main/packages/blueprint
