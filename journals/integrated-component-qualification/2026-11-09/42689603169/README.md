# Integrated component qualification — 42689603169

All three Foundation jobs passed at frozen source
`d02414f58d888e3d11913dedd888a3e5871bf29f`. The original artifact qualifies eight component lanes with
510 assertions: 504 PASS and six retained upstream Go MessageBox FAIL
observations. Both repetitions reproduce paid internalization, replay after
acknowledgment and replay rejection defects. The TypeScript participant and
explicit Go compatibility participant pass. Storage has eight isolated
source/destination/repetition cells; the other seven lanes each run twice,
for 22 isolated executions. This is infrastructure qualification under
ITCVE-1 1.3.0, not native wallet or complete BRC-100 conformance.

`integrated-lab.zip` is the original GitHub artifact: 1,830,073 bytes,
SHA-256 `435bb88519dd5ff7b106b57b5d9c0964f0f04516c91a55081e1ba3ac2cecbdab`, matching the GitHub API digest. All 141
original artifact members remain unchanged after independent local replay,
including `verification.json`. `foundation-logs.zip` retains all three original
job logs. Run/job/artifact API receipts and the independent result accompany
the pack. `provenance.json` binds every retained file; `qualification.json`
records every lane, repetition and retained finding.

CI passed 76 core tests, 195 synthesis tests with eight gated skips, five
Python tests, 11 Go component tests, three transport tests, 14 service tests
and one Rust test. The audit reported zero vulnerabilities. Type checking,
catalog/standards checks, historical journal replay and append-only history,
funding-reserve and clause archive replay, all component child oracles, two
messaging negative cases and five Rust tamper cases passed.

The separate descendant-storage-sync artifact verifies the prospective
TypeScript/Go descendant-funded replacement matrix. It is archived separately
under journals/descendant-storage-qualification/2026-11-09/42689603169; its opt-in
compatibility source does not change this historical 1.3 matrix's scope.
Native conformance remains a separate qualification. Original native recovery,
metadata-order and proof-export failures remain unchanged; component checks
do not retrospectively qualify a native wallet. Earlier failed attempts remain
separately recorded.

Reproduce with the frozen source and pinned dependencies, using a fresh directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42689603169/integrated-lab.zip -d out/recheck-42689603169
node scripts/verify-integrated-lab.mjs out/recheck-42689603169
```

The verifier checks frozen inputs, exact repeated outcomes and every child
oracle. It recomputes storage metadata and proof projections, wallet boundary
assertions, transport/replay behavior, overlay/identity observations, messaging
findings and independent Rust transaction/certificate evidence. Prepared
dependencies are required; offline replay starts no services. Local
macOS/arm64 verification used exact frozen git blobs in an isolated source cache
with the pinned dependencies. It passed without rewriting CI paths or artifact bytes.
