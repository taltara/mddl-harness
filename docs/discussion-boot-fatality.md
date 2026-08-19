I hit this while building tooling that edits overlays, and I think it is worth stating plainly, because the failure is much larger than it looks.

I added a row naming a package that was not installed in the profile:

```yaml
- insert:
    - id: probe
      name: '@example/not-installed'
```

I expected one dead entry that I could then inspect. What actually happens is `ERR_MODULE_NOT_FOUND` during boot, and **the process exits**. Not a degraded row — no harness at all. Which means:

- The Web UI is gone, so you cannot fix it in the Web UI.
- Anything that inspects a running tree cannot help you, because there is no running tree.
- The only way back is editing YAML by hand, or restoring a backup.

That is a sharp edge for a file people are encouraged to hand-edit, and it is the same shape as several boot incidents already reported here.

### What I took from it

The check has to happen before the write, not after. In my own tooling I now verify that every inserted package is present in the profile before an overlay is written, and refuse the write otherwise — because after the write there is nothing left running to warn in.

Snapshotting the file before each write turned out to matter just as much. I bricked my own test harness twice while learning this, and the backup is what got it back.

### Two things that might be worth considering upstream

Offered as questions rather than requests.

1. Could an unresolvable row fail *that entry* rather than the process? A plugin that cannot load is bad; a harness that will not start is worse, because it removes every tool you would otherwise use to diagnose it.
2. Would a `dsh --profile <name> --check` that validates an overlay without booting be welcome? There is clear appetite for a doctor command — discussion #1719 has 57 comments — and resolvability looks like the highest-value single check.

Either way, the behaviour seems worth a line in the config docs. "A row naming a package you have not installed will prevent startup" is the sentence I wish I had read first.
