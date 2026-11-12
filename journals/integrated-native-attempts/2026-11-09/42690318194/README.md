# Native conformance attempt 42690318194 — portability observation failure

[CI](https://github.com/p2ppsr/interop/actions/runs/42690318194) failed independent
parent verification at frozen source `d02414f58d888e3d11913dedd888a3e5871bf29f`.
Both native workers completed and reported V001–V006 PASS and V007–V008 FAIL.
This archive issues no qualification. Original artifact bytes and outcomes remain
unchanged.

All 263 reported predicate identities and outcomes match between repetitions:
162 PASS, 99 FAIL and two BLOCKED. The V007 producer/oracle disagreement prevents
independent qualification of the complete projection. Independent partial replay
verifies permissions 8 PASS, original ToDo lifecycle 3 PASS, public API lifecycle
3 PASS, and clauses 132 PASS / 98 FAIL / 2 BLOCKED per repetition. Both SDK 2 and
SDK 4 derive all five successful permission keys from the joined native identity.
The complete ToDo/API receipt windows identify their transactions independently
of verdict. Authenticated upfront reserves and mined proof ancestry verify, and
the two rejected input sets and rejected outputs are unused by later submitted
transactions.

The frozen V007 verifier requires the literal mixed-case text `In use`; the
retained native page contains `IN USE` and the correct replacement host. The
producer reports native-mediated synchronization PASS, while the frozen oracle
rejects that outcome. Its original failed replay is retained. A separate V007
failure remains: the final source-off snapshot contains an unsigned redemption
and a task-output lock, without a signed spending txid or raw transaction. The
signed spend appears only in later storage evidence, which cannot establish
redemption before the source was restored. The original redemption FAIL is not
converted by correcting the UI text comparison.

The ancestry correction supports actual cold reconstruction in this attempt.
Both repetitions remove the original source, drop and recreate the native wallet
context, recover the same encrypted ToDo outpoint and decrypt the task using the
replacement. Independent source, destination and final-snapshot dataset graphs
each verify 12 signed transactions with the exact pinned mined root. These
observations establish the executed recovery steps; source-off signed redemption
remains unproved. The [detailed diagnosis](independent-review/portability-diagnosis.json)
retains snapshot, public call and later-transaction evidence.

All 77 integrated assertions per repetition independently replay successfully
through transport, TS/Go Message Box, Board/UHRP/LCH synthesis, 42 boundary checks
across 28 methods and eight identity-trust checks. The [child replay receipt](independent-review/integrated-parts.json)
and all ten logs are retained. Rust did not execute because parent native
verification stopped at V007; this archive makes no Rust or integrated-native
qualification claim.

Worker shutdown, sandbox/network receipts, container removal, Mongo cleanup and
restoration of the host user-namespace setting verify. Artifact 13708083357 is
2,734,482 bytes with SHA256
`6e5171faf01d68f2ba0aa30cdfb78c102343e5a02d1aa24166194956d75d989b`, matching
GitHub's artifact digest. All 132 extracted members remain byte-identical to that
original ZIP. [Assessment](assessment.json) inventories each member and retains
counts, cleanup and independent partial findings. All-job logs, API acquisition
receipts, the original failed step and the reproduced parent failure accompany
the archive.

The review used a read-only `git archive` of the exact frozen revision with the
pinned installed dependencies. Helper scripts retain their original `out/`
execution layout and separate diagnostic output paths. A prospective oracle or
driver correction requires its own identified evaluation; this failed sample is
not requalified.
