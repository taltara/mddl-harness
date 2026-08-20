Coming from the upstream discussion this issue cites. I have been building the write path for a config editor and hit the same failure mode, so rather than describe agreement I will offer what is already implemented and tested, and be explicit about where it stops.

I have extracted the parts that are not specific to my UI into a standalone package — `dsh-overlay-check`, MIT, Node only, **no dependencies** and no opinion about how you edit config. It is meant to be usable by an installer, a CLI, or a GUI, precisely so the ecosystem does not end up with several validators that disagree.

https://github.com/taltara/mddl-harness/tree/main/packages/overlay-check

Mapped onto your seven steps, it covers 2, 3, and the write half of 4:

**Step 3, resolvability.** `preflightOps(profileDir, ops, liveIds)` returns findings; `module-not-installed` is `blocking` and `insert-over-existing` is a warning. One implementation detail worth stealing or arguing with: presence is checked against the profile's `node_modules` rather than `require.resolve`. An ESM-only package that exports no `require` condition resolves fine for the loader and throws for a naive resolve, so a resolve-based check fails packages that actually work. Presence is cruder and, in my testing, correct more often.

**Step 4, snapshot, and the write itself.** `composePatchFile` owns a marker-delimited block and nothing else — hand-written rows, comments and `!!js` expressions outside it survive byte for byte, and passing empty rows removes the block and hands the file back. I would argue this belongs in the contract rather than being left to each installer. A config file that a tool takes ownership of is one people stop hand-editing, which quietly disables the recovery paths in the handbook. `revisionOf` gives you a precondition so a file that moved since the check is a refusal rather than an overwrite.

`diffLines` is a real LCS diff. That sounds cosmetic and is not: a prefix/suffix diff collapses two edits nine lines apart into one wall of red followed by one of green, and if reviewing the diff is the safety story, an unreadable diff means there is no safety story.

**Where it stops, clearly.** It proves nothing about activation. Resolvability is necessary and not sufficient — a module can resolve and still fail to start, and a missing provider leaves an entry pending forever. Only a real isolated boot proves that, which is why I think your step 6 cannot be optimised away and why a canonical `--check` should be explicit about which gate it is.

That is the part I would most like to see nailed down here, because it is where installers will diverge. Three distinguishable gates:

1. **Parse and compose** — what `--dump-config` already does. Cheap, and it proves the least.
2. **Resolvability** against the resulting profile's dependency closure — what this package does. Catches the failure that actually bricks a harness.
3. **Isolated boot with a health probe** — the only one that proves activation, and the only one that costs a process.

If the Store claims 1 and 2 today and says so, that is already a much better contract than most installers ship, and it leaves 3 as an honest roadmap item rather than an implied guarantee.

Two smaller things from breaking my own harness repeatedly while building this:

- Snapshot before the *first* mutation, not before the promote. I restored from those backups more than once.
- Restoring should itself be snapshotted. Rolling back is the moment someone is already having a bad day; it should not be the irreversible step.

Happy to shape the package's API around whatever this issue settles on, including renaming or moving it if you would rather the primitive lived somewhere neutral. I care much more about one shared implementation than about it being mine.
