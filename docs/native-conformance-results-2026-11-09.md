# Native conformance evaluation — November 9, 2026

The prospective [ITCVE-1 1.4.0](../itcves/ITCVE-1/1.4.0/README.md) profile
evaluates unchanged Yours Wallet 5.1.0 with Go Overlay Services, Go ChainTracks
and Go Wallet Storage under [ISI-4 2.0.0](../programs/ISI-4/2.0.0/README.md).
The [frozen plan](../infra/native/conformance/plan.json) requires two fresh
Linux/amd64 native Chromium repetitions, a 900-second bound per repetition,
the original wallet and compiled ToDo artifacts, controlled mined funding,
kernel network isolation, browser sandboxing and complete cleanup.

The [November 6 results](integrated-lab-results-2026-11-06.md) remain unchanged:
V001–V004 PASS, V005–V006 FAIL and V007–V008 BLOCKED. New acceptance rules have
separate program, environment and oracle identities. No result in this report
establishes complete BRC-100 conformance or certification.

## Retained attempts

| Run | Result and retained evidence |
| --- | --- |
| [Native 42661306475](https://github.com/p2ppsr/interop/actions/runs/42661306475) | Official artifact download returned HTTP 500; no wallet executed. [Original logs and receipts](../journals/native-conformance-attempts/2026-11-09/42661306475/README.md) remain intact. A bounded official asset-API fallback preserves the exact pinned bytes. |
| [Native 42663444149](https://github.com/p2ppsr/interop/actions/runs/42663444149) | Root-owned mode 0600 artifact was unreadable to the unprivileged worker; no wallet executed. [Original artifact and cleanup](../journals/native-conformance-attempts/2026-11-09/42663444149/README.md) remain intact. Preparation sets 0644 only after digest verification. |
| [Foundation 42663404897](https://github.com/p2ppsr/interop/actions/runs/42663404897) | A random leading zero exposed the malformed certificate fixture. [Original 501 PASS / 9 FAIL observations](../journals/integrated-component-attempts/2026-11-09/42663404897/README.md) and repeatability failure remain intact. |
| [Foundation 42666966132](https://github.com/p2ppsr/interop/actions/runs/42666966132) | Component artifact independently verifies 504 PASS / 6 unchanged upstream FAIL across 510 assertions and 22 executions. [Archive](../journals/integrated-component-qualification/2026-11-09/42666966132/README.md) also records the workflow failure: Git had omitted an ignored historical log. The exact already-manifested log is restored. |
| [Foundation 42674635670](https://github.com/p2ppsr/interop/actions/runs/42674635670) | All three jobs pass on `def98ac`: 76 core, 145 synthesis with eight gated skips, five Python, 11 Go, three transport, 14 service and one Rust test; negative/tamper checks also pass. [Original artifact and independent replay](../journals/integrated-component-qualification/2026-11-09/42674635670/README.md) retain 504 PASS and six unchanged upstream FAIL observations. |
| [Native 42667035861](https://github.com/p2ppsr/interop/actions/runs/42667035861) | Both workers completed; recovery genuinely failed before submission, and the parent verifier incorrectly assumed every phase submitted a transaction. [Original artifact and diagnosis](../journals/integrated-native-attempts/2026-11-09/42667035861/README.md) retain both repetitions and issue no qualification. |
| [Native 42674638927](https://github.com/p2ppsr/interop/actions/runs/42674638927) | CI and frozen replay pass, but publication review identifies two observer defects. [Unchanged original artifact and independent review](../journals/integrated-native-attempts/2026-11-09/42674638927/README.md) retain V001–V005 PASS and V006–V008 FAIL; this run is not accepted as completed native conformance qualification. |

In native 42667035861 each worker reports V001–V005 PASS and V006–V008 FAIL.
Independent child review confirms permission 8 PASS and clause 132 PASS / 98 FAIL /
2 BLOCKED per repetition. Lifecycle recovery fails with insufficient funds;
portability never reaches its settings UI, and the integrated graph retains
related funding failures. Go storage deliberately quarantines inputs after
terminal `invalidTx` because a submission service can return a false-positive
verdict. The two negative scenarios exhaust the two available change chains;
the unchanged native wallet has no failed-action review UI.
No rejected input is silently unlocked, and no later funded experiment changes
these original observations.

In native 42674638927, both repetitions retain 77 integrated graph PASS and
48 Rust PASS observations, permission 8 PASS, lifecycle 2 PASS / 1 FAIL,
portability 1 PASS / 8 FAIL, and clauses 132 PASS / 98 FAIL / 2 BLOCKED. All
263 conformance predicate outcomes match. The recovered lifecycle transaction
actually succeeds; only the returned label order changes. V007 consumes a
pending task row with an empty outpoint before its signed transaction is ready,
so it never reaches the storage settings. These are observer defects, not
newly established wallet failures. The original qualification files and their
environment-qualified flags remain inside the unchanged archive. Both workers,
services and containers are cleaned up; the host user-namespace setting is restored.

The additional native clause blocker has independent transaction proof:
`noSendChange` identifies an unsigned transaction's output while `tx` and
`txid` identify the signed transaction. Clearing only the unlocking scripts
reproduces the stale returned TXID exactly. A subsequent call using that returned
outpoint cannot find its output. The [diagnostic receipt](../journals/integrated-native-attempts/2026-11-09/42667035861/independent-review/no-send-change.json)
binds both repetitions, raw signed bytes, independent hashes and unchanged
wallet source. The invalid-input test remains BLOCKED because its positive
control fails; the laboratory does not rewrite the native return value.

## Corrected laboratory boundaries

V005 uses the same protocol/key request across two actual application origins.
Pending-call barriers and three visible native permission decisions establish
approval, cached grants, denial, origin isolation and recovery. Nine calls
support eight independently checked predicates. The prior experiment used
different protocol contexts; a new passing result would establish this new
experiment, not a retrospective security fix to unchanged wallet bytes.

V006 enables an explicit terminal-rejection policy only in the new Go fixture
profile. A transaction-bound HTTP400 `REJECTED` receipt becomes `invalidTx`;
transport errors and malformed or mismatched receipts remain service failures.
The historical adapter discarded the receipt body. The unchanged wallet CWI
also reduces errors to messages, so the new evidence retains its actual error
separately from the authenticated public storage request and response. The
oracle binds identity, RPC ID, transaction bytes, terminal status, preserved
wallet state and recovery without inventing fields on the native exception.
State preservation is measured over the declared lifecycle basket and public
action projections. It does not assert that inputs quarantined by a terminal
rejection remain usable. The prospective plan therefore declares two additional
10,000-satoshi mined BRC29 reserves before customer scenarios, independently
bound to native ownership and read-only public storage observations. Continued
operation uses unaffected existing funds; there is no recovery refill or
observer-side release of rejected inputs.

The separately versioned [lifecycle oracle 3](../programs/ISI-4/profiles/native-conformance-2.0.0/lifecycle-oracle-3.0.0.json)
compares labels and tags as unique string sets, following line 29 of the pinned
BRC100 source. All other state remains exact; deleted, changed, duplicated or
non-string members fail. Historical schemas retain their original order-sensitive
results. Captured-trace replay and a fresh Go reference experiment are engineering
checks; a new frozen native execution must establish the corrected result.

V007 uses supported Wallet Backup controls to add, synchronize and activate a
second independent Go storage provider. The source listener stops while the
wallet locks, unlocks and reconstructs the ToDo state from the replacement.
Public authenticated reads compare complete logical datasets and transaction
proofs; native ToDo redemption must finish before the source listener returns.
The driver neither extracts the wallet private key nor copies a database. The
prospective driver waits for the actual task checkbox and a canonical, new
outpoint whose same-response BEEF proves the amount, script and protocol.
Pending observations remain in the trace; they cannot initiate replacement.

V008 executes 232 source-linked predicates with
[`tpnil-brc100-clause-oracle@3.0.0`](../programs/ISI-4/profiles/native-conformance-2.0.0/oracle-3.0.0.json):
28 return contracts, 181 invalid-input leaves, 11 cryptographic predicates,
seven namespace rules, three metadata predicates, structured errors and an
explicit remaining-coverage gate. Invalid probes require successful controls;
timeouts, denied permission, insufficient funds and JavaScript engine errors
cannot stand in for specified validation errors. Every observation retains
its public call arguments, result or error, source locator and causal controls.

The external certificate issuer now preserves all 32 random symmetric-key bytes.
Its previous integer conversion occasionally stripped a leading zero and
produced an invalid 31-byte positive fixture. A deterministic zero-prefixed key
survives actual remote acquisition, proof and strict SDK disclosure in the
[regression evidence](../journals/certificate-fixture-reference/2026-11-09/README.md).
The correction changes the issuer fixture, not the storage or wallet SUT.

## Reference evidence and unresolved scope

Final TypeScript and Go reference reports under oracle 3 each contain
133 PASS, 98 FAIL and one BLOCKED clause observation. All 11 cryptographic and
three metadata predicates pass. These are engineering observations through
reference Toolbox APIs; they do not substitute for native-wallet execution.
The native attempt also has 98 FAIL observations, but three differ in each
direction: native-only failures accept short action/input/output descriptions;
reference-only failures concern header height and the admin/default baskets,
which the native wallet rejects. Equal counts do not imply identical findings.
The [original diagnostic journal](../journals/native-clause-reference/2026-11-09/README.md)
and its [oracle 3 continuation](../journals/native-clause-reference/2026-11-09/oracle-3.0.0/README.md)
retain failed fixtures, control mistakes and prior oracle outcomes unchanged.

Literal contract mismatches require interpretation at their actual boundary.
For example, negative net outgoing action amounts differ from a positive
`SatoshiValue` return alias; that does not establish invalid transaction values.
Optional `null` acceptance, inactive privileged parameters, reserved namespaces,
engine exceptions and error-field loss remain separately identifiable findings.
TypeScript client behavior shared by both reference paths is not automatically
a Go storage defect, and assertion counts are not independent security-defect
counts.

Five broader obligations remain explicit: secondary privileged keys, remaining
permission categories and grant lifecycle, native byte-wire applicability,
conflicting basket-length limits in the pinned source, and remaining
transaction/default/certificate combinations. V008 stays FAIL when executed
predicates fail, or BLOCKED when those obligations are all that remain.
`completeBRC100Conformance` remains false.

| Remaining obligation | Evidence needed to close it |
| --- | --- |
| Privileged secondary keyring | An admitted released configuration with an actual distinct secondary keyring and user-presence path; approval/denial, reason validation, independent key/crypto separation, lock/reload and cache expiry. Bundled optional manager code alone does not establish that configuration. Unsupported optional functionality needs a prospective applicability decision. |
| Other permission categories | Fresh-origin basket, spending, certificate and linkage approval/denial, cached grants, supported single/all revocation, restart and scope tests. The reviewed UI grants default to no expiry; finite-expiry evidence requires a supported configuration rather than private-state manipulation. |
| Native byte-wire substrate | A released native endpoint, or a prospective applicability decision, followed by all 28 call codes and malformed/truncated/error frames, byte encoding and state/permission parity. A laboratory encoder forwarding to CWI is not a native endpoint. |
| Basket-length conflict | An explicit versioned interpretation or pinned upstream clarification of the typed 300-byte versus prose 400-byte limits, followed by create/query/persistence cases at 299/300/301/399/400/401 UTF-8 bytes. |
| Remaining conditional branches | A clause inventory covering transaction batching/defaults, proof-omission trust, consuming-reference conflicts, filter/pagination/include semantics, actual certificate issuance, conflicting required fields, verifier/keyring/signature/revocation behavior and pagination; each applicable branch needs admitted fixtures and independent state/ancestry checks. |

These are coverage obligations in addition to observed failures. New criteria
and any changed wallet artifact require a separately frozen qualification;
closing coverage does not erase earlier failures.

## Reproduction and cost boundary

Install the exact locked dependencies and service binaries using the
[integrated preparation commands](integrated-lab-results-2026-11-06.md).
The `ISI-4 Yours Wallet controlled-service run` workflow accepts
`integrated-native-conformance`; it builds the Linux/amd64 closure on its
Ubuntu runner. `node scripts/verify-native-integrated.mjs OUTPUT` independently
checks retained native evidence against its recorded source and frozen plan.
Use the corresponding recorded revision for historical attempts; the prospective
reserve plan intentionally does not admit older runs without reserve evidence.
Reference journal replay uses:

```sh
python3 scripts/verify-native-clause-journal.py
python3 scripts/verify-native-clause-journal.py journals/native-clause-reference/2026-11-09/oracle-3.0.0
node scripts/verify-published-integrations.mjs --semantic
```

No paid devices, new subscriptions, production routes, production credentials
or public-mainnet spending are involved. Standard public GitHub runner compute
has no direct tariff; artifact storage, owned capacity, operator effort and
development-agent costs remain unreconciled rather than zero. Every recovery
attempt retains its original evidence and a specific corrected precondition.
