A second data point for this, with a different cause, plus a distinction I think matters for the fix.

**Different cause, same screen.** Mine was not a wrong id in `__ModuleLoader__.load`. It was a transitive `node:` import: I shared one module between the host half and the client half of my plugin — just a file of route-path constants — and that dragged the host's module graph into the browser bundle, so the client ended up requiring `node:crypto`. The shell's module table cannot answer that, and the result is byte-identical to yours:

```
failed to import loader entry (dsh-blueprint): client-modules:
require("node:crypto") missed the module table — not a platform seed word,
not a materialized module, and no registered package factory
```

Worth noting because the authoring mistake is invisible: nothing about sharing a constants module looks like it crosses a boundary, and the plugin builds and typechecks fine. The bundle only reveals it if you check what it actually requires.

**The distinction.** There are two failure severities here and they need different answers:

1. **This one.** The client bundle fails, the fatal screen replaces the GUI — but the process is alive. Host routes still serve, the CLI still works. A recovery action on the screen, as you propose, is entirely possible because there is something still running to render it.
2. **A host-side row naming a module the profile cannot load.** Cordis fails module resolution during boot and the process exits. There is no screen to put a button on, because there is no process. Recovery is hand-editing YAML.

Both are "one plugin takes down everything", which is the underlying ask, but only the first can be solved with a better error screen. The second needs either per-entry failure isolation or a pre-boot check, and I do not think a UI affordance can reach it.

For what it is worth I ended up building the second as a refusal rather than a recovery — my tool will not write a row whose package is not present in the profile, because after the write there is no running harness left to warn in. That is a workaround for one tool, not a fix for the platform, and I would much rather have the isolation.

Upvoted. The recovery actions you suggest would have saved me an afternoon on case 1.
