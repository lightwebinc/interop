# Integrated component qualification — 42680171419

All three Foundation jobs passed at frozen source
`3f9cbead7c05a17b663f9c2c52b93abdf04eac69`. The original artifact qualifies eight component lanes with
510 assertions: 504 PASS and six retained upstream Go MessageBox FAIL
observations. Both repetitions reproduce paid internalization, replay after
acknowledgment and replay rejection defects. The TypeScript participant and
explicit Go compatibility participant pass. Storage has eight isolated
source/destination/repetition cells; the other seven lanes each run twice,
for 22 isolated executions. This is infrastructure qualification under
ITCVE-1 1.3.0, not native wallet or complete BRC-100 conformance.

`integrated-lab.zip` is the original GitHub artifact: 1,828,386 bytes,
SHA-256 `ce08e663ed44b74223bd1cea2e79e7b440bf4fcafb0ab47c88bf3a089a6e0d6a`, matching the GitHub API digest. All 141
original artifact members remain unchanged after independent local replay,
including `verification.json`. `foundation-logs.zip` retains all three original
job logs. Run/job/artifact API receipts and the independent result accompany
the pack. `provenance.json` binds every retained file; `qualification.json`
records every lane, repetition and retained finding.

CI passed 76 core tests, 155 synthesis tests with eight gated skips, five
Python tests, 11 Go component tests, three transport tests, 14 service tests
and one Rust test. The audit reported zero vulnerabilities. Type checking,
catalog/standards checks, historical journal replay and append-only history,
funding-reserve and clause archive replay, all component child oracles, two
messaging negative cases and five Rust tamper cases passed.

The new lifecycle metadata-set oracle is covered by observer regressions and
separately frozen for the next native run. The original native recovery and
metadata-order FAIL reports remain unchanged; passing component checks or
captured-trace diagnostics do not retrospectively qualify a native wallet.
Earlier failed Foundation and native attempts remain separately recorded.

Reproduce with the frozen source and pinned dependencies, using a fresh directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42680171419/integrated-lab.zip -d out/recheck-42680171419
node scripts/verify-integrated-lab.mjs out/recheck-42680171419
```

The verifier checks frozen inputs, exact repeated outcomes and every child
oracle. It recomputes storage metadata and proof projections, wallet boundary
assertions, transport/replay behavior, overlay/identity observations, messaging
findings and independent Rust transaction/certificate evidence. Prepared
dependencies are required; offline replay starts no services. Local
macOS/arm64 verification passed without rewriting CI paths or artifact bytes.
