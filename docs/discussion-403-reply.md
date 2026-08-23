Thanks for the byte-for-byte confirmation — that is the detail that settles it.
I can add a third data point: same file, `profile-boot-DG5t9aNs.js`, same lines,
on `0.1.0-rc.7`. So this is stable across `0.1.0-rc.7` and `0.1.1-rc.2`, and the
filename hash being identical across those two says the module has not been
touched between them.

Worth spelling out exactly what the override does, because it explains why the
config looks half-respected:

```js
if (rows.has("agent-presets")) composedOverlays.push({
  id: "agent-presets",
  config: {
    ...rows.get("agent-presets")?.config ?? {},
    roots: [{ path: SHIPPED_PRESET_ROOT, trust: "system" }]
  }
});
```

It spreads your config and then replaces one key. Every other field you set on
that row survives — only `roots` is discarded. Anyone testing with a row that
sets `roots` alongside something else will see the something else take effect,
which makes the failure look intermittent rather than total.

On `--dump-config` being non-authoritative here, one refinement: the override is
`push`ed onto `composedOverlays` *after* the array the dump prints is built, so
the dump is not stale or cached — it is showing a genuinely different value from
the one the loader receives. Nothing you can pass to the CLI will show you the
effective value, which is why this costs people an afternoon.

@luria-hebb — your point about the user root surviving a `dsh` upgrade is the
part I had not articulated and it is the stronger argument for it. Copying into
the CLI's own install tree loses on every upgrade; `$DSH_HOME/.agent-presets`
does not, and it is immune here for a structural reason rather than by luck,
since `includeUserRoot` appends after the computation that gets corrupted.

Since three of us have now lost time to the dump disagreeing with the runtime, I
put the check in the tool rather than only in this thread. `dsh-overlay-check`
0.4.0 (MIT, no dependencies) refuses to let an overlay claim this silently:

```
warning  config-silently-overwritten  "agent-presets.roots" is replaced at boot
with the shipped root, so setting it here does nothing — and --dump-config will
still show your value, because the override is applied after the composition it
prints. Put presets in $DSH_HOME/.agent-presets/<id>/ instead.
```

It is a plain function over patch rows, so it is usable from anything that
writes config, not only from my own tooling:
<https://github.com/taltara/mddl-harness/tree/main/packages/overlay-check>

Happy to drop the rule the moment this is fixed upstream — it is scoped to this
one row and one key precisely so it can be deleted cleanly.
