# Native conformance attempt 42674638927 — observer limitations

[CI](https://github.com/p2ppsr/interop/actions/runs/42674638927) succeeds at frozen
source `def98acc4d5dcf37b9ef7d52d9dbd13fe70023b8`. Both workers complete and
independent replay verifies the original reported results. Publication review
identifies two observer limitations, so this archive is not accepted as the
completed native conformance qualification. The original qualification files,
including their environment-qualified flags, remain unchanged inside the ZIP.

Each repetition reports V001–V005 PASS and V006–V008 FAIL. Independent review
confirms permission 8 PASS, integrated graph 77 PASS and Rust 48 PASS per
repetition. The clause result is 132 PASS, 98 FAIL and 2 BLOCKED. All 263
conformance predicate outcomes match between repetitions, including their FAILs.

V006's recovered action actually succeeds with its accepted signed transaction.
The preserved output has identical values and label membership, but a different
label order. Lifecycle oracle@2 compares raw array order and reports FAIL.
[Pinned BRC100](https://github.com/bsv-blockchain/BRCs/blob/39a643ff148a8dcd23ec08986a8ddeb7d5713743/wallet/0100.md#L29)
defines labels/tags as sets. A separately versioned correction and fresh run
are required; this original FAIL is not rewritten. All three native funding
outpoints were prepared before customer scenarios; independent all-input ancestry
checks exclude hidden refills and reuse of quarantined rejected input chains.

V007 proceeds after clicking Create as soon as it sees a new 3-satoshi row,
although that pending row has an empty outpoint and its BEEF lacks the new
transaction. The later signed ToDo transaction exists in retained raw evidence.
No settings UI, synchronization, outage or cold reload was attempted. Correcting
this driver readiness race does not establish portability without a fresh run.

Both containers were removed, wallet/service shutdown was clean, and the host
user-namespace setting returned to its original1. Original artifact13701186998
is1,847,441 bytes, SHA256
`ff199e65316ed2501efcf4a34124977e9dd62a94f5086c5b82ba08a1449ef410`.
All148 original members remain byte-identical after full independent replay.
Original all-job logs and API receipts are retained. [Assessment](assessment.json)
records the publication decision, timings, per-member hashes and original
outcomes. [Independent reviews](independent-review/review.json) bind actual
permission keys and full predicate agreement; [lifecycle review](independent-review/lifecycle-reserves.json)
and [portability diagnosis](independent-review/portability.json) identify the
remaining observer defects. `independent-verification.txt` retains full frozen
parent replay with the assertion-only publication agreement check. Runtime and
publication checker revisions are recorded separately; no original file changed.
