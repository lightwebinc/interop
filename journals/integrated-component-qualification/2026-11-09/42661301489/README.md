# Integrated component qualification — 42661301489

The exact GitHub artifact qualifies eight component lanes at source `ec6cff827e6bc29d0c53951a5ed6a9cae72e724b`: 510 assertions, comprising 504 PASS and six retained upstream Go MessageBox FAIL observations. Both repetitions reproduce the three findings: paid internalization, replay after acknowledgment, and replay rejection. TypeScript MessageBox and the separately declared adapted Go participant pass. The storage lane contains eight isolated source/destination/repetition cells; the other seven lanes each run twice. This is component infrastructure qualification under ITCVE-1 1.3.0, not native wallet or complete BRC-100 conformance. The prospective ITCVE-1 1.4.0 native run is separate.

`integrated-lab.zip` is GitHub's original 1,829,149-byte artifact, SHA-256 `3fb70655a73298661740227aaaef80a36d4ba5e93f69126c2985a13ab8fa3876`. Its bytes match GitHub's recorded artifact digest. All 141 original artifact members remain unchanged after independent local replay, including the original `verification.json`. `foundation-logs.zip` retains the raw logs for all three Foundation jobs. GitHub run/job/artifact receipts and a portable offline-verification result accompany the archive; `provenance.json` binds every retained file. `qualification.json` identifies each lane, repetition, count and exact upstream finding.

All three CI jobs completed successfully: offline core checks, Go component checks and integrated components. The logs retain 75 core tests, 129 synthesis tests with eight explicitly gated skips, five Python tests, 11 Go component tests, three transport regressions, 13 service regressions and one Rust test. The dependency audit reported zero vulnerabilities. Type checking, catalog/standards checks, journal replay/history checks, component child oracles and messaging/Rust tamper verification also passed. Passing CI means those checks completed; it does not convert the six upstream findings into passes.

Reproduce from the frozen source with its pinned dependencies installed, using a fresh extraction directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42661301489/integrated-lab.zip -d out/recheck-42661301489
node scripts/verify-integrated-lab.mjs out/recheck-42661301489
```

The verifier checks the manifest, frozen inputs, matching repetitions and every child oracle. It recomputes logical storage projections, proof and metadata integrity, wallet boundary assertions, transport/replay properties, overlay/identity observations, messaging findings and independent Rust transaction/certificate evidence. Dependencies must be prepared before performing offline verification; no service needs to start to verify this pack. Local macOS/arm64 replay passed without rewriting the CI host paths or any artifact member.
