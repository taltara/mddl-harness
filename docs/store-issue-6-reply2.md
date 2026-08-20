That is a fast turnaround, and the spec sanitization is the part I would not have thought to prioritise — rejecting URLs, git specs, whitespace and shell syntax from the install command closes an injection surface that most installers leave open because the happy path never exercises it. Good call.

One distinction worth making explicit in the issue text, because I think a reader could conflate them: what Preview 5 enforces is **provenance** — is this package allowed, is it who it claims to be, is the spec well-formed. What this issue opened on is **resolvability** — will the resulting profile actually boot. They are orthogonal, and neither implies the other. A package can be `verified` and `runtime_verified` in the catalog and still leave a profile that will not start, because the property that matters is local: whether every inserted module is present in *this* profile's dependency closure after the install. Catalog verification cannot know that, and resolvability cannot tell you whether the package is trustworthy.

Both are worth having. I only want them named separately so "install-safety gate shipped" is not read as covering the brick.

The sequencing point I raised earlier gets sharper now that the install path is real. `dsh plugin --profile web add -w <spec>` is itself the first mutation: your own evidence shows it writing the profile dependency and auto-activating the bundle in `dsh.profile.bundles`. So by the time it returns, the profile is already changed — and if the result does not boot, you are in the state that has no Web control plane to repair it from. That means the snapshot has to be taken *before* the CLI is invoked, and it has to cover the profile `package.json`, the lockfile, and the overlay together, because the CLI touches all three. Snapshotting after install would capture the broken state.

Two cheap things that fit between install and restart, neither needing a process:

- Run resolvability against the post-install profile. This is where a package that installed cleanly can still fail, because its own `dsh.bundle` patch may insert a row naming something that did not arrive. `preflightOps` does exactly this and returns `module-not-installed` as blocking.
- `dsh --profile <name> --dump-default-config` as the post-install probe. It is from your own handbook and it is the right shape here: bundle-only, offline, and it still answers when the user layer is what broke. I confirmed the layer-skipping behaviour on rc.7 — a row written into a profile's `cordis.patch.yml` shows in `--dump-config` and is absent from `--dump-default-config`.

`insert-over-existing` may also be relevant to your flow: a plugin whose bundle patch inserts an id the running tree already has will collide rather than add, and that is visible before restart.

Happy to help with the snapshot and rollback step when you get to it — that is the half I have already broken my own harness on several times, and the ordering is easier to get right the second time.
