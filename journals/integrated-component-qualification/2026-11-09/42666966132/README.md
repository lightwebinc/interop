# Component artifact qualification within failed Foundation run 42666966132

The original component artifact at source
`60c87315cccdfef86523b03a9ce2390bae639dae` independently qualifies eight component
lanes: 510 assertions, comprising 504 PASS and six retained upstream Go
MessageBox FAIL observations. Both repetitions reproduce paid internalization,
replay after acknowledgment and replay rejection defects. TypeScript MessageBox
and the separately declared adapted Go participant pass. The storage lane has
eight isolated source/destination/repetition cells; the other seven lanes each
run twice. This is component infrastructure qualification under ITCVE-1 1.3.0,
not native wallet or complete BRC-100 conformance.

**The overall Foundation workflow failed.** Go component checks passed. Offline
core and integrated component jobs failed when their historical archive checks
found an omitted `failed-step.log` from earlier attempt 42663404897. Its manifest
already recorded the correct file hash, and local replay had read the original
file, but the global `*.log` ignore rule excluded it from the committed tree.
CI correctly rejected that incomplete publication. Publication repair commit
`957d6bf53204d49138292131a5d2be815f89ed41` adds the exact previously manifested
bytes; it changes no earlier evidence, component runtime or acceptance criterion.
All published integration manifest members were then checked directly against
committed Git blobs. This later correction does not change the failed workflow
status retained here.

The integrated matrix execution and its complete offline child-oracle replay
both passed before the historical publication check failed. Independent local
replay confirms the same result. In particular, both TypeScript and Go wallet
boundary repetitions now pass all 43 checks after the external certificate
issuer correction. The earlier invalid 31-byte proof and its 501 PASS / 9 FAIL
observations remain in their separate failed-attempt archive.

`integrated-lab.zip` is GitHub's original 1,830,209-byte artifact, SHA-256
`1284a5e3ea28e175091f217a97efcdc27d573af7f2eb9f63896b4e0f5e4edc17`, matching
the GitHub API digest. All 141 original members remain byte-identical after
independent replay, including `verification.json`. `foundation-logs.zip` retains
all three original job logs. Run, job and artifact API receipts preserve the
failed workflow and exact frozen source. `provenance.json` binds every retained
file; `qualification.json` records component counts separately from workflow
failure, and `independent-verification.json` retains the local oracle result.

Completed CI checks include 75 core tests, 133 synthesis tests with eight gated
skips, 11 Go component tests, three transport tests, 14 service tests and one
Rust test. Type checking, catalog/standards checks and the dependency audit
(zero reported vulnerabilities) passed. Later offline-core Python, demo and
history checks were skipped after the publication failure; the final messaging
and Rust tamper commands were likewise not reached in CI. Their independent
local results are retained separately in the verification receipt and are not
represented as CI passes.

Reproduce with the frozen source and pinned dependencies, using a fresh directory:

```sh
unzip journals/integrated-component-qualification/2026-11-09/42666966132/integrated-lab.zip -d out/recheck-42666966132
node scripts/verify-integrated-lab.mjs out/recheck-42666966132
```

The verifier checks frozen inputs, exact repetitions and every child oracle,
including storage metadata/proofs, wallet boundary assertions, transport/replay,
overlay/identity, messaging and independent Rust evidence. Offline replay
requires prepared dependencies but no running services. Local macOS/arm64
verification used unchanged component verifier sources and did not rewrite CI
paths or artifact members. A separately recorded native run evaluates ITCVE-1
1.4.0; these reference component results make no native conformance claim.
