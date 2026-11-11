# Canonical verifier invocation correction

The retained November9 local preflight reported complete independent replay on
source `8055aab`. Review on November11 found three mandatory invocations with
only a newline in their logs: the original corpus2 Rust replay and both frozen
native messaging verifiers. Their legacy entry-point guards compare the CLI
argument with the module's canonical path. On macOS, a `/var` temporary path
resolves to `/private/var`; a guarded CLI can exit successfully without invoking
its verifier.

The complete-replay claim for that local1 preflight is withdrawn. Its original
receipt, including its `PASS` field, remains unchanged in this correction
archive. The original three one-byte logs, source-bound scope review and minimal
alias reproduction are preserved. Native base admission, transport, synthesis,
trust, wallet-boundary and new Rust3 logs contain substantive results. Those
observations remain data. The separate Rust3 engineering journal already uses
canonical paths and parsed receipts and is unaffected. The unchanged native9
artifact and its failing conformance findings are not reclassified.

The [Linux CI attempt42720214271](../../../integrated-native-attempts/2026-11-09/42720214271/README.md)
actually invoked the messaging verifier and failed because its exact pinned SDK
was absent. That dependency failure remains distinct from this local invocation
defect. Neither review launches a wallet, service or funded transaction.

The correction canonicalizes frozen source paths and requires a complete final
JSON receipt with expected verification fields. Empty output, diagnostics alone,
wrong fields and a truncated outer envelope cannot establish verification.
`evidence.zip` binds the four corrected source/test files, both original guarded
verifiers,27 passing focused tests and112 passing core tests. Independent
canonical-path and explicit exported-function messaging replays each pass all
six assertions for both original repetitions. A new complete local preflight
and CI reevaluation must be frozen and recorded separately.

Run `python3 journals/native-invocation/2026-11-11/canonical-paths/verify.py` to
check this archive's exact bytes and the correction boundary. This integrity
command executes no wallet or conformance verifier. Run the current
`test/frozen-component-replay.test.mjs` regression tests for the invocation
behavior; the retained source snapshots identify the tested correction.
