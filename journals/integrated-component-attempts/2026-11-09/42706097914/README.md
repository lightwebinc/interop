# Failed storage repetition — 42706097914

Foundation at frozen source `4e7c1e1050bbb29a31093e19dfd4e8c089d12451` completed all 15 component lane runs but correctly failed its repeated-outcome gate. The original artifact records **502 PASS and eight FAIL observations out of 510**. Six are the unchanged upstream Go MessageBox findings. TypeScript→Go storage repetition 2 additionally fails `mediated-initial-sync` and `incremental-tombstone`; repetition 1 passes both. This attempt is **NOT_ACCEPTED** and issues no component or native-wallet qualification. The later descendant matrix was skipped and produced no artifact or assertion count.

Independent replay at the exact frozen source reproduces the parent's storage repetition rejection. Fourteen other child-oracle replays accept their retained observations. The storage child oracle independently rejects its initial raw logical dataset comparison. All 140 original integrated artifact members remain unchanged. No failed result was rewritten or retried into a passing sample.

Read-only comparison identifies exactly one difference in both initial and incremental projections: `/provenTxReqs/0/history/notes/1/when` is `2026-11-09T21:54:52.660Z` in TypeScript and `2026-11-09T21:54:52.66Z` in Go. Both represent the same instant. Pinned unpatched Go wallet-toolbox v0.191.4 models this field as `time.Time`, whose JSON serialization removes trailing fractional-second zeros. The certificate tombstone itself propagated: zero certificates remain. The frozen 1.0 oracle compares these history strings literally, so both original FAIL results remain valid under that declared rule. Any future equal-instant comparison needs a separately declared prospective projection policy, retaining raw values and every other metadata field. `storage-diagnosis.json` binds the inspected raw observations, transcript and result by hash and identifies the typed upstream source.

The timeout-only recovery passed offline-core: 90 core tests, 289 synthesis tests with nine gated skips, five Python tests, zero reported dependency vulnerabilities, type checking, standards, historical archive replay and history checks. Go-components passed 11 tests. The integrated setup separately passed all 11 shutdown-retention regressions, including actual TypeScript and Go counterparts, three transport tests, 14 service tests and one Rust test. Those successful checks do not override the subsequent storage matrix mismatch.

`integrated-lab.zip` is the original 1,830,338-byte GitHub artifact, SHA-256 `aa8c3b2787a73e08ec60c97564f746ae8bf3c291e0ffa7c2d4ed3434b8693ce0`. The separate original Go component ZIP is 60,504 bytes, SHA-256 `e36eeaf45c01e2e0b9957a7e9a1dcb84d09648a2355f4561c0bc4537b670e964`. Both match GitHub API digests. Full API receipts and all three original job logs are retained. `observed-results.json` records every ZIP member hash and the exact findings; `attempt.json` binds the full retained file inventory. No browser profiles, private wallet databases or recovery material are added.

To reproduce the strict rejection, use the frozen source and pinned dependencies:

```sh
unzip journals/integrated-component-attempts/2026-11-09/42706097914/integrated-lab.zip -d out/recheck-42706097914
node scripts/verify-integrated-lab.mjs out/recheck-42706097914
node scripts/verify-storage-sync.mjs out/recheck-42706097914/storage-sync
```

Both commands reject this original sample. `independent-replay.json` preserves their errors and all 15 child replay outputs. The published attempt guard checks inventory integrity without issuing a semantic qualification. Native execution is a separate workflow; these reference component observations do not establish native or complete BRC-100 conformance.
