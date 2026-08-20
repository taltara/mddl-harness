Thank you — both of these are more useful than the original post.

The cold-start versus live-HMR distinction is the one that caught me. I had been treating a successful write as the end of the story, and "restart to load it" as a formality. It isn't: a running harness can reject a candidate and keep serving the tree it already has, so the write looks accepted, and the same bytes then fail from cold because there is no prior tree to fall back on. That is a worse failure than an immediate one, because the feedback arrives hours later and somewhere else. I have changed my tooling to say a restart is the real test rather than implying the write was it, and to point at `--dump-default-config` and the snapshot when it does not come back.

I had missed that `--dump-default-config` deliberately skips the user layers. That is exactly the probe you want when the thing you would normally debug with is the thing that is gone, and it deserves to be in the config docs rather than discovered during an incident.

On your point that a successful `--dump-config` proves parse and compose only, not import or activation: agreed, and I can add a data point from the other side. My tooling refuses to write a row whose package is not present in the profile — a filesystem check against the profile's `node_modules`, not a resolve, because an ESM-only package that exports no `require` condition resolves fine for the loader and throws for a naive `require.resolve`. That catches the failure I actually hit, and it is strictly weaker than what you are describing. It says nothing about whether a resolvable module activates, or whether a missing provider leaves something pending forever. Those need a real boot, and I do not think any amount of static checking substitutes for one.

Which is why I think the `--check` primitive is the right ask, and worth being precise about what it would and would not promise. Three distinguishable gates, in increasing cost and confidence:

1. Parse and compose — what `--dump-config` already gives.
2. Resolvability of every inserted module against the resulting profile's dependency closure.
3. Isolated boot with a health probe — the only one that proves activation.

A canonical `--check` covering 1 and 2 would already remove most of the reinvention, and would let each installer be explicit about whether it claims 3. Your `resolve → parse → compose → snapshot → isolated boot + health probe → promote or restore` reads right to me, and the ordering matters as much as the steps: snapshot before the first mutation, not before the promote.

Two things I would add from building the write path, both learned by breaking my own harness:

**Confine the writes.** I own a marker-delimited block in `cordis.patch.yml` and nothing else, so hand-written rows, comments, and `!!js` expressions survive byte for byte. A config file that a tool takes ownership of is a config file people stop hand-editing, and then the recovery paths in your runbook stop being available to them.

**Bind the review to the write.** The preview issues a token over the exact proposed bytes and the revision they were computed against; applying without it is refused. It is a small thing, but it closes the window where a second tab or a hand edit changes what gets written after the human approved it — which in this domain means the difference between a reviewed change and an unreviewed one.

I would rather converge on your contract than ship a second validator with different semantics, so if the Store issue settles on a shape for the offline check I will match it. Fail-loud on missing policy, sandbox, and persistence providers rather than treating a missing row as a safe degraded state seems right to me too — the degraded state is not observable from inside a harness that did not start.
