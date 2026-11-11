# Retained native evidence reevaluation — 43059172140

The [November 11 CI workflow](https://github.com/p2ppsr/interop/actions/runs/43059172140) succeeds at frozen evaluator source `9cded11fae9c8a48fc23894157bbab0b561077e5`. It qualifies a separately identified reevaluation of the unchanged [November 9 native observations](../../../integrated-native-attempts/2026-11-09/42711700295/README.md), whose original source is `c338a93c97ffebeeef318e679ff82b7dbf309dd5`. It starts **zero new native wallet sessions**.

| Scope | Each original repetition |
| --- | --- |
| Native ISI-4 4.0.0 / ITCVE-1 2.0.0 | 180 PASS / 99 FAIL / 1 BLOCKED out of 280; V001–V007 PASS, V008 FAIL |
| Integrated component graph | 77 PASS |
| New Rust corpus 3 observer | 48 PASS |

The native and combined conformance outcome remains **FAIL**, with complete BRC-100 conformance false. The original workflow is still failed. Original Rust corpus 2 retains 42 PASS/six FAIL in repetition 1 and NOT_EXECUTED in repetition 2. The new indexed observer resolves shared ancestors only from each unchanged original BEEF; it does not supplement ancestry, edit wallet records or replace original results.

The frozen plan `YOURS-5.1.0-NATIVE-42711700295-RUST-3.0.0-CANONICAL-REEVALUATION` has SHA256 `f49f2dbb984ce227cebd305bbe31e827908dfd683b304b63488b4bbd9b863aef`. It binds both native repetitions, all four original input reports per repetition, original source and qualification hashes, and exact evaluator/graph-oracle source manifests. The source-bound invocation guard requires nonempty JSON receipts and canonical paths. All 16 producer/verifier receipts are present and independently validated. CI also passes 14 Rust adversarial tests and independently replays the complete result.

The original GitHub reevaluation ZIP is 8,916,753 bytes, SHA256 `4f2c50c5481700d0ce69d8607d87dcb10637935705c2322185d0fe290af2c51c`. All 220 members remain unchanged after independent exact-source replay, including all 186 original native members and the byte-identical original native ZIP. The separate verifier-preparation ZIP is 1,572 bytes, SHA256 `1613dbcf6bf23f6f49f6100f7162b02d34eeca2e49f10bf9479899ca2a74a494`. Its receipt proves the pinned TypeScript Message Box source/archive/package lock and SDK 4.0.1 in an isolated verifier cache, with no Go or SQLite service build. Local source/SDK identities match that CI receipt exactly.

`all-job-logs.zip` preserves the original complete CI logs. Run/job/artifact APIs, both original artifact ZIPs, preparation receipt, original member inventory, independent canonical replay stdout/stderr and detailed review are retained. `provenance.json` binds every file. The [first failed offline attempt](../../../integrated-native-attempts/2026-11-09/42720214271/README.md) remains unchanged; its missing dependency was corrected before this separately frozen run.

Reproduce from the recorded evaluator source with full Git history, pinned Node 24.22.1, locked synthesis/transport/services dependencies and Rust 1.88.0 dependencies prepared. Prepare the exact messaging verifier dependency and select its isolated cache:

```sh
node scripts/prepare-messaging.mjs --native-verifier-only
export TPNIL_MESSAGING_PATHS="$PWD/out/messaging-native-verifier/paths.json"
unzip journals/native-integrated-reevaluation/2026-11-11/43059172140/native-reevaluation.zip -d out/recheck-reevaluation-43059172140
RUSTUP_TOOLCHAIN=1.88.0 CARGO_NET_OFFLINE=true node scripts/verify-native-reevaluation.mjs out/recheck-reevaluation-43059172140
```

Offline replay starts no services or funded transactions. The five broader coverage obligations and 99 pinned native findings remain explicit in the [results report](../../../../docs/native-conformance-results-2026-11-09.md).
