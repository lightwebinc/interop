# Integrated component qualification — 42697115971

All three Foundation jobs passed at frozen source
`cc3cf756272b8d3826612d71e8f6356239fed6fa`. The original artifact qualifies eight component lanes with
510 assertions: 504 PASS and six retained upstream Go MessageBox FAIL
observations. Both repetitions reproduce paid internalization, replay after
acknowledgment and replay rejection defects. The TypeScript participant and
explicit Go compatibility participant pass. Storage has eight isolated
source/destination/repetition cells; the other seven lanes each run twice,
for 22 isolated executions. This is infrastructure qualification under
ITCVE-1 1.3.0, not native wallet or complete BRC-100 conformance.

`integrated-lab.zip` is the original GitHub artifact: 1,820,722 bytes,
SHA-256 `a289af08d3e77ce3c21385469c546117a6634f22c1b484a3c7c3a1f1c5400ffc`, matching the GitHub API digest. All 141
original artifact members remain unchanged after independent local replay,
including `verification.json`. `foundation-logs.zip` retains all three original
job logs. Run/job/artifact API receipts and the independent result accompany
the pack. `provenance.json` binds every retained file; `qualification.json`
records every lane, repetition and retained finding.

CI passed 85 core tests, 250 synthesis tests with eight gated skips, five
Python tests, 11 Go component tests, three transport tests, 14 service tests
and one Rust test. The audit reported zero vulnerabilities. Type checking,
catalog/standards checks, historical journal replay and append-only history,
funding-reserve and clause archive replay, all component child oracles, two
messaging negative cases and five Rust tamper cases passed.

The separate descendant-storage-sync artifact verifies the prospective
TypeScript/Go descendant-funded replacement matrix. It is archived separately
under journals/descendant-storage-qualification/2026-11-09/42697115971; its opt-in
compatibility source does not change this historical 1.3 matrix's scope.
Native conformance remains a separate qualification. Original native recovery,
metadata-order and proof-export failures remain unchanged; component checks
do not retrospectively qualify a native wallet. Earlier failed attempts remain
separately recorded.

Reproduce with the frozen source and pinned dependencies, using a fresh directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42697115971/integrated-lab.zip -d out/recheck-42697115971
node scripts/verify-integrated-lab.mjs out/recheck-42697115971
```

The verifier checks frozen inputs, exact repeated outcomes and every child
oracle. It recomputes storage metadata and proof projections, wallet boundary
assertions, transport/replay behavior, overlay/identity observations, messaging
findings and independent Rust transaction/certificate evidence. Prepared
dependencies are required; offline replay starts no services. Local
macOS/arm64 verification used exact frozen git blobs in an isolated source cache
with the pinned dependencies. It passed without rewriting CI paths or artifact bytes.
