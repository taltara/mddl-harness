Corroborating this from the other direction, in case it helps confirm the diagnosis: I ship a tool that writes custom presets ([`dsh-blueprint`](https://github.com/taltara/mddl-harness/tree/main/packages/blueprint), MIT), and it works — precisely because it writes to the default user root and never touches `roots`.

Concretely, on rc.7: writing `$DSH_HOME/.agent-presets/<id>/agent.cordis.yml` plus a `preset.yml` makes the preset appear in the session picker alongside the shipped ones, with no restart. Discovery is unmemoized, so it is selectable the moment the files land. I did not configure `roots` at all, and I had no idea until reading this that configuring it would have silently done nothing.

So this report matches what I see: the default user root is the one path that works, and it is the one I would tell people to use today.

The detail I would underline for anyone landing here from a broken setup is your last one — `--dump-config` not showing the injected override. That is the part that costs the most time, because the natural way to check whether config took effect is to dump it, and here the dump agrees with you while the runtime does not. Anyone debugging a custom root will conclude their YAML is correct, because by the composition it is.

If it is useful for a workaround section, the shape that does work:

```
$DSH_HOME/.agent-presets/
  my-preset/
    preset.yml          # name, description, order
    agent.cordis.yml    # persona row, then one flat row per tool
```

`agent.cordis.yml` follows the same shape as the shipped `standard` preset — a `persona` row using `@deepseek-ai/dsh-persona`, then `- id: <row> / name: '<package>'` per tool. A directory whose composition is unparsable or is not a list of named rows is listed as broken with a reason rather than skipped, which is a genuinely nice touch when authoring by hand.

If it saves anyone the YAML, the compiler that emits this shape is [`compileGraphToPreset`](https://github.com/taltara/mddl-harness/blob/main/packages/compiler/src/compileGraphToPreset.ts) — about eighty lines, MIT, and the tests next to it double as worked examples of the format.
