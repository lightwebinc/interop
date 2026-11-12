# Lifecycle metadata set comparison regression

The exact two lifecycle reports from native run [42674638927](https://github.com/p2ppsr/interop/actions/runs/42674638927), source `def98acc4d5dcf37b9ef7d52d9dbd13fe70023b8`, remain `PASS / PASS / FAIL` under their original schema2 observer. Both recovery calls actually returned a signed, accepted transaction and preserved the prior output. Its labels were returned in a different order. The original ZIP and complete native report remain separately archived by the parent run record.

The pinned [BRC100 source](https://github.com/bsv-blockchain/BRCs/blob/39a643ff148a8dcd23ec08986a8ddeb7d5713743/wallet/0100.md#L29) explicitly defines transaction labels and output tags as sets. The prospective `tpnil-native-lifecycle-oracle@3.0.0` compares only those fields as unique string sets. It preserves raw observations and exact comparisons for every other field. Deletion, substitution, duplicate or non-string set members still fail; unrelated arrays retain order.

`summary.json` binds the compressed archive and original artifact digest. Every expanded member has its own byte length and SHA256. The archive retains both exact native lifecycle JSON files and the independent identity, mined-proof, authenticated-storage, timing and no-refill review. That review verifies all scenario input branches terminate at the three declared upfront native payment outpoints; no rejected input chain is reused. This establishes continued use of unaffected pre-existing funds, not release of quarantined funds or an unchanged-wallet UnFail interface.

The regression test replays the captured public responses through both producer modes and the independent oracle, including an actual `EvidenceBundle` serialization round trip. The original mode remains FAIL; explicit v3 produces PASS for this diagnostic replay. This is observer regression evidence, not a new native execution or retrospective qualification.

Validation passed: 21 focused tests; 155 synthesis tests with 8 pre-existing skips; 76 core tests; typecheck and repository checks; semantic replay of 8 published qualifications and 6 observer attempts; 14 clause reference archives with 4 final replays; and 2 Go fixture tests with 8 subcases. A fresh actual Go-backed Toolbox reference using the explicitly admitted compatibility build and message-only error transport passed all three lifecycle predicates. This reference remains distinct from the native wallet. The first reference startup refusal, caused by omitting that explicit build admission, is retained alongside the corrected attempt. Logs, diagnostic reports, the fresh reference and source hashes are included in the compressed archive.

Reproduce from the repository root:

```sh
npm --prefix synthesis test -- native-conformance-lifecycle.test.ts native-conformance-wiring.test.ts
```
