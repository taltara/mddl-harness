Four implementations in and a spec drafted — so rather than add a fifth tool to the pile, two things I learned building the same check that I think are worth sharing across all of them.

**A correctness gotcha for dangling-reference detection.** If you implement "is this plugin resolvable" with `require.resolve` from the profile, you will get false positives on packages that work fine. An ESM-only package that exports no `require` condition throws `ERR_PACKAGE_PATH_NOT_EXPORTED` for `require.resolve` while the loader imports it happily. I hit this and switched to a presence check instead — does `<profile>/node_modules/<name>/package.json` exist, walking up one level for the profile root install — which is cruder and, in my testing, wrong less often. Worth a fixture in whichever implementations land, because the failure mode is a doctor that reports FAIL on a healthy profile, which is worse than no doctor.

Scoped names need the two-segment split, and `cordis:` builtins plus relative paths have to be excluded before the check runs or they read as missing packages.

**A check category the spec does not currently have: before the mutation, not after it.** Every proposal here diagnoses a profile that already exists — env, profile, session. All of that runs after something has already been written. But the failure this thread keeps circling is caused by a *write*: a row lands in `cordis.patch.yml`, and the next boot has no harness left to run a doctor in.

So there is a fourth verb worth naming alongside env/profile/session — call it `candidate`: given a proposed change and the current profile, would applying it still resolve? It is the same resolvability logic, run against the result of an edit rather than against the present state. Anything that writes config — a plugin store, an installer, an editor — needs that gate, and a post-hoc doctor cannot provide it because by then the damage is done.

Mapped onto @zoahdev's `{name, status, detail}` shape, the two checks I actually emit are:

- `candidate-module-installed` — FAIL when a row being inserted names a package not present in the resulting profile. Detail carries the package name and the `dsh plugin --profile <name> add <pkg>` that fixes it.
- `candidate-insert-collision` — WARN when an inserted id already exists in the running tree, since that collides rather than adds.

Both are in [`dsh-overlay-check`](https://github.com/taltara/mddl-harness/tree/main/packages/overlay-check) (MIT, Node only, no dependencies) if the code is useful, but the point of this comment is the category and the gotcha, not the package. If the official command grows a `--candidate <patch-file>` mode, every installer in the ecosystem can stop writing its own validator, which seems like the thing this thread has been converging on all along.

For the record on provenance, since that convention came up: verified on rc.7, and the presence-versus-resolve difference was found by a package that resolved for the loader and failed `require.resolve`.
