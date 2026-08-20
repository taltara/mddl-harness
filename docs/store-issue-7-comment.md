I have implemented the library-shaped half of this and shipped it as `dsh-overlay-check@0.2.0` (MIT, Node only, still zero dependencies), for evaluation against the acceptance tests here — same posture as before: adoption should be decided on API fit and tests, and if it does not fit, the test names below at least give you a coverage checklist that took me three bricked profiles to arrive at.

https://github.com/taltara/mddl-harness/tree/main/packages/overlay-check

The surface is `takeSnapshot(store, label, paths)` → `diffAgainstSnapshot` → `restoreSnapshot`, over an arbitrary file set relative to a root. It knows nothing about DSH semantics on purpose — the caller names the files, which for this transaction is the profile manifest, lockfile, overlay, and whatever bundle-activation state the CLI touches.

Mapped onto the acceptance criteria, each with the test that pins it:

- **"Snapshot is created before the DSH plugin add process starts"** — capture is a pure read; test: *captures without changing any file*. Taking it first costs nothing, so there is no reason left to sequence it anywhere else.
- **"Snapshot covers every file the installation path can modify"** — including files that do not exist yet: an absent file is captured as absent, and restore then *removes* what the failed install created rather than leaving half an install; tests: *records an absent file as absent*, *removes a file the failed install created*. On a fresh profile this case is the common one, not the edge.
- **"The active Web profile returns to its byte-equivalent pre-install configuration"** — restore re-hashes every file after writing and throws rather than report a restore that did not converge; test: *returns every file to byte-equivalent pre-install state*.
- **"Rollback itself is recoverable and does not destroy the failed-state evidence"** — restore snapshots the current (failed) state first, and that evidence snapshot is itself restorable, so you can roll the rollback back to inspect the failure; test: *preserves the failed state as its own snapshot before restoring*.
- **"Tests cover … interrupted rollback"** — a restore that dies midway is re-runnable from the same snapshot and still converges; test: *recovers from an interrupted rollback by running again*.

Details that only showed up in the writing: two captures of identical content must get distinct identities or the second silently overwrites the first's history; paths are confined to the snapshot root so a crafted path cannot walk out; writes are temp-file-then-rename in the same directory.

**Explicitly not covered, and I would keep it that way:** the isolated boot probe and promotion (your step 4–5). Those need a spawned process, a port, and a bounded health check — installer orchestration, not a library. Same for the provenance gate, which you already have. So the seam I would propose: the Store owns *sequence and processes*, the library owns *file-state truth* — what was there, what changed, and getting back to byte-equivalence with evidence intact.

If you would rather the primitive lived under a neutral name or org for the integration review, that still stands.
