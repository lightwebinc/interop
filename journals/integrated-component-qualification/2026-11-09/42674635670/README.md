# Integrated component qualification — 42674635670

All three Foundation jobs passed at frozen source
`def98acc4d5dcf37b9ef7d52d9dbd13fe70023b8`. The exact component artifact qualifies
eight lanes with 510 assertions: 504 PASS and six retained upstream Go MessageBox
FAIL observations. Both repetitions reproduce paid internalization, replay after
acknowledgment and replay rejection defects. TypeScript MessageBox and the
separately declared adapted Go participant pass. Storage has eight isolated
source/destination/repetition cells; the other seven lanes each run twice, for
22 isolated executions. This is infrastructure qualification under ITCVE-1 1.3.0,
not native wallet or complete BRC-100 conformance. The separate native run on
this source evaluates the prospective ITCVE-1 1.4.0 profile.

`integrated-lab.zip` is the original GitHub artifact: 1,830,097 bytes, SHA-256
`a9bea2ecc4dadb81e7f147b904fc210f2a42b691e6a0642c9ffcbc18f445c01a`, matching
the GitHub API digest. All 141 original artifact members remain unchanged after
independent local replay, including `verification.json`. `foundation-logs.zip`
retains all three original job logs. Run/job/artifact API receipts and the local
verification result accompany the pack. `provenance.json` binds every retained
file; `qualification.json` records each lane, repetition and upstream finding.

CI passed 76 core tests, 145 synthesis tests with eight gated skips, five Python
tests, 11 Go component tests, three transport tests, 14 service tests and one
Rust test. The audit reported zero vulnerabilities. Type checking,
catalog/standards checks, historical journal replay and append-only history,
new funding-reserve archive replay, all component child oracles, two messaging
negative cases and five Rust tamper cases passed. The original native recovery
failures retained by the reserve archive remain FAIL; that archive replay
establishes faithful evidence handling and reference setup, not a native result.

The earlier failed Foundation attempts remain separately recorded. In particular,
this successful run does not alter run 42666966132's failed historical-publication
gate or run 42663404897's invalid positive certificate fixture observations.

Reproduce with the frozen source and its pinned dependencies, using a fresh
extraction directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42674635670/integrated-lab.zip -d out/recheck-42674635670
node scripts/verify-integrated-lab.mjs out/recheck-42674635670
```

The verifier checks frozen inputs, exact repeated outcomes and every child
oracle. It recomputes storage metadata and proof projections, wallet boundary
assertions, transport/replay behavior, overlay/identity observations, messaging
findings and independent Rust transaction/certificate evidence. Prepared
dependencies are required; offline replay starts no services. Local macOS/arm64
verification passed without rewriting CI paths or any original artifact bytes.
