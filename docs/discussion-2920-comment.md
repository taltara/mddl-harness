Strongly in favour, and I want to add evidence for why a recoverable startup mode cannot be replaced by a better error screen.

There are two failure severities here, and they are usually discussed as one:

1. **The client bundle of a plugin fails to register.** The GUI is replaced by the fatal "Failed to load plugins" screen, but the process is alive — host routes still serve, the CLI still works. #2229 proposes recovery actions on that screen, and that is achievable precisely because something is still running to render them.
2. **A host-side row names a module the profile cannot load.** Cordis fails module resolution during boot and the process exits. There is no screen, no degraded mode, no UI to put a button on. Recovery is hand-editing YAML or restoring a backup.

I hit both while building tooling that writes overlays. For the second I deliberately inserted a row naming a package that was not installed, expecting one dead entry I could then inspect — and instead got no harness at all. That is the case this proposal addresses and the error screen cannot.

What a recoverable startup mode would need to survive that, from the outside looking in: the decision to skip has to happen before the failing entry is imported, since the import is what kills the process. A skip-and-warn that runs after the tree is composed is too late for exactly the entries that matter most.

Two things that already exist and are worth wiring into the design rather than inventing:

- `dsh --profile <name> --dump-default-config` deliberately skips the profile and home user layers, so it still answers when the user layer is what broke. I confirmed that on rc.7: a row written into a profile's `cordis.patch.yml` appears in `--dump-config` and is absent from `--dump-default-config`. That makes it a usable bundle-only probe for "would this profile compose without my overlay", which is close to the question a recovery mode has to answer.
- The four community `dsh doctor` implementations in #1719 already detect dangling plugin references offline. A recoverable startup mode and a pre-boot checker are the same predicate on either side of the boot.

Until isolation exists, tools that write config are stuck implementing refusal instead — [mine](https://github.com/taltara/mddl-harness/tree/main/packages/blueprint) will not write a row whose package is not present in the profile, because after the write there is no running harness left to warn in, and the check is extracted as [`dsh-overlay-check`](https://github.com/taltara/mddl-harness/tree/main/packages/overlay-check) for anyone else with the same problem. That is a workaround each of us has to build separately, which is a decent argument that the platform should own it.

Also relevant from the operator side: @ylwl1997 reported in #2229 that from their catalog's install telemetry, many "Failed to load plugins" cases are one bad third-party plugin rather than a broken harness — which is the population this proposal would rescue.
