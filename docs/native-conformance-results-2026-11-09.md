# Native conformance evaluation — November 9, 2026

The [ITCVE-1 2.0.0](../itcves/ITCVE-1/2.0.0/README.md) profile
evaluates unchanged Yours Wallet 5.1.0 with Go Overlay Services, Go ChainTracks
and Go Wallet Storage under [ISI-4 4.0.0](../programs/ISI-4/4.0.0/README.md).
The [frozen plan](../infra/native/conformance/plan-coverage-closure.json) requires two fresh
Linux/amd64 native Chromium repetitions, a 900-second bound per repetition,
the original wallet and compiled ToDo artifacts, controlled mined funding,
kernel network isolation, browser sandboxing and complete cleanup.

The [November 6 results](integrated-lab-results-2026-11-06.md) remain unchanged:
V001–V004 PASS, V005–V006 FAIL and V007–V008 BLOCKED. New acceptance rules have
separate program, environment and oracle identities. No result in this report
establishes complete BRC-100 conformance or certification.

## Latest native observations and component qualification

[Native run 42711700295](https://github.com/p2ppsr/interop/actions/runs/42711700295)
executes two fresh Linux/amd64 repetitions of unchanged Yours Wallet 5.1.0
on source `c338a93`. The original frozen base verifier admits the environment,
cleanup and repetition agreement: **V001–V007 PASS; V008 FAIL**, with
**180 PASS, 99 FAIL and one BLOCKED out of 280 predicates per repetition**.
The [unchanged original archive and independent reviews](../journals/integrated-native-attempts/2026-11-09/42711700295/README.md)
retain all 186 members, exact artifacts and every failed observation.
Environment admission does not mean wallet conformance passes.

| Executed native scope | Result in each repetition |
| --- | --- |
| Original permission decisions and origin isolation | 8/8 PASS |
| Basket, certificate and one-shot spending decisions; individual/origin revocation | 16/16 PASS |
| ToDo and API rejection, input quarantine and funded recovery | 6/6 PASS |
| Source-off replacement storage, cold read/decryption and signed redemption | 9/9 PASS |
| Pinned BRC-100 clause predicates | 133 PASS / 99 FAIL / 1 BLOCKED |
| Integrated component graph and identity bindings | 77/77 PASS |

The final shutdown receipts retain all 53 submissions in each repetition:
20 from source storage and 33 from replacement storage. No provider has an
added shutdown tail, unauthorized payment or later quarantined-input reuse.
All trusted permission events bind to the original public CWI request and
response. Both native identities, signed proof ancestry, source outage and
successful replacement processing independently verify.

The whole original workflow still fails in its Rust observer. Corpus2 records
42 PASS / 6 FAIL in repetition 1; repetition 2 Rust does not execute. Each
original BEEF already contains its complete ancestors, but the observer
incorrectly rejects the pinned SDK's shallow representation of a shared
ancestor before resolving the full transaction elsewhere in the same graph.
A separately versioned corpus 3 reevaluation is required; original corpus 2
results and the failed workflow are not replaced or promoted.

[Foundation run 42711677744](https://github.com/p2ppsr/interop/actions/runs/42711677744)
qualifies the separate component-only ITCVE-1 3.0.0 profile: **584 PASS and six
unchanged Go Message Box FAIL observations across 590 assertions, nine lanes
and 30 isolated executions**. The four-direction storage2 matrix passes 88
predicates; descendant2 passes 80 in eight fresh executions. Those 80 are
already included in 590, and the separate descendant upload is the same bytes.
[Original aggregate evidence](../journals/integrated-component-qualification/2026-11-09/42711677744/README.md)
and [descendant evidence](../journals/descendant-storage-qualification/2026-11-09/42711677744/README.md)
independently replay against the exact recorded source. All three CI jobs pass.

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
| [Foundation 42680171419](https://github.com/p2ppsr/interop/actions/runs/42680171419) | All three jobs pass on `3f9cbea`: 155 synthesis with eight gated skips, 76 core, five Python, 11 Go, three transport, 14 service and one Rust test; dependency audit has zero findings. [Original artifact and independent replay](../journals/integrated-component-qualification/2026-11-09/42680171419/README.md) retain 504 PASS and six unchanged Go FAIL observations. |
| [Native 42680240116](https://github.com/p2ppsr/interop/actions/runs/42680240116) | Both workers complete; replacement storage cannot retrieve a synchronized mined ancestor, and the producer/oracle dataset disagreement prevents qualification. [Original artifact and diagnosis](../journals/integrated-native-attempts/2026-11-09/42680240116/README.md) retain V001–V005 PASS and V006–V008 FAIL. |
| [Foundation 42689603169](https://github.com/p2ppsr/interop/actions/runs/42689603169) | All three jobs pass on `d02414f`. [Generic component archive](../journals/integrated-component-qualification/2026-11-09/42689603169/README.md) retains504 PASS / 6 FAIL; the separate [descendant storage archive](../journals/descendant-storage-qualification/2026-11-09/42689603169/README.md) independently verifies 80 PASS across eight clean runs and four TS/Go directions. |
| [Native 42690318194](https://github.com/p2ppsr/interop/actions/runs/42690318194) | Both workers complete and clean up; original permissions, rejection/recovery and all 77 integrated checks independently pass. Source-off cold task recovery works. The parent rejects portability UI casing and unproven signed redemption timing. [Original artifact and independent diagnosis](../journals/integrated-native-attempts/2026-11-09/42690318194/README.md) retain the failed qualification and no Rust execution. |
| [Foundation 42697115971](https://github.com/p2ppsr/interop/actions/runs/42697115971) | All three jobs pass on frozen `cc3cf75`: 85 core, 250 synthesis with eight gated skips, five Python, 11 Go, three transport, 14 service and one Rust test; audit has zero findings. [Generic component evidence](../journals/integrated-component-qualification/2026-11-09/42697115971/README.md) independently replays 504 PASS / 6 FAIL across 22 executions. [Descendant storage evidence](../journals/descendant-storage-qualification/2026-11-09/42697115971/README.md) independently replays 80 PASS across eight fresh runs; all 187 original members remain unchanged. |
| [Native 42697283161](https://github.com/p2ppsr/interop/actions/runs/42697283161) | Both workers complete on frozen `cc3cf75`, but three permission outcomes differ because native popup closure races the click observer. [Original archive and full independent review](../journals/integrated-native-attempts/2026-11-09/42697283161/README.md) retain 177 PASS / 102 FAIL / 1 BLOCKED and 180 PASS / 99 FAIL / 1 BLOCKED. Both portability scenarios pass 9/9; all 77 integrated checks pass per repetition. No Rust execution or qualification is claimed. |
| [Foundation 42705007019](https://github.com/p2ppsr/interop/actions/runs/42705007019) | Two cryptographic mutation tests exceeded their default five-second deadline; a separate actual TS storage fixture failed with `EADDRINUSE`. Neither component matrix executed. [Original failure archive](../journals/integrated-component-attempts/2026-11-09/42705007019/README.md) retains both failures, all logs and the sole Go artifact. |
| [Native 42705211560](https://github.com/p2ppsr/interop/actions/runs/42705211560) | Canceled during image preparation after the listener-allocation defect was identified. Both native execution steps were skipped and no wallet artifact exists. [Cancellation archive](../journals/native-conformance-attempts/2026-11-09/42705211560/README.md) retains all thirteen original log members and API receipts; no runtime qualification is issued. |
| [Foundation 42706097914](https://github.com/p2ppsr/interop/actions/runs/42706097914) | Offline-core and Go-components pass; actual TS/Go shutdown tests pass. All 22 component executions ran, retaining 502 PASS / 8 FAIL: six unchanged Go findings and two TS-to-Go storage predicates whose strict timestamp-string comparison differs on equivalent `.660Z`/`.66Z` values. [Original archive and independent replay](../journals/integrated-component-attempts/2026-11-09/42706097914/README.md) preserve the repeatability failure. The descendant matrix did not execute. |

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

In native 42680240116, independent child replay verifies permission 8 PASS,
lifecycle API 3 PASS and clauses 132 PASS / 98 FAIL / 2 BLOCKED per repetition.
The original ToDo UI rejection observation still reports FAIL: its observer
selected the last submission, an unrelated accepted change-only transaction,
after the actual rejected ToDo transaction. The recorded aggregate V006 remains
FAIL. A prospective correction must retain the complete phase window and bind
the unique customer transaction independently of the desired verdict.

V007 now reaches real native synchronization, provider activation and removal,
and source-listener outage. The two logical datasets agree, but the replacement
cannot retrieve the mined ancestor required for the recovered task's BEEF.
Cold task visibility times out. Exported inputBEEF does retain the proof bytes;
independent dataset-only reconstruction verifies all 12 owned transactions and
the pinned mined root. Their presence does not establish operational retrieval.
The original producer reports 5 PASS / 4 FAIL while the independent oracle
rejects its complete-dataset PASS because no owned mined-transaction row exists.
Any new proof-closure criterion needs its own version and must independently
verify the complete dataset without borrowing the task's captured BEEF. A Go
sync correction must make actual source-off reads and spends succeed.

The native graph consequently retains 62 PASS / 7 FAIL / 8 BLOCKED per repetition.
No Rust execution occurred because parent verification stopped first. All 263
reported outcomes match, but this does not qualify the disputed portability
observations. Both workers and containers cleanly shut down and the host setting
is restored. The original 124 artifact members remain unchanged.

In native 42690318194, both repetitions report V001–V006 PASS and V007–V008
FAIL, with identical 263-predicate reports: 162 PASS, 99 FAIL, 2 BLOCKED. Independent
partial verification confirms the original eight permissions, all six ToDo/API
rejection-and-recovery checks, and all 77 integrated checks per repetition. Cold
Lock/Unlock and task reconstruction now succeed from replacement storage while
the source listener is unavailable. Each exported dataset independently closes
its 12 signed transactions to the pinned mined root.

Qualification still fails: the rendered native status is `IN USE`, whereas the
frozen oracle 2 requires `In use`. The final replacement snapshot also contains
an unsigned redemption reservation. The original absence read and snapshot
precede completion; later signed storage bytes cannot prove completion during
the source outage. All 132 original artifact members, full failed parent replay,
partial reviews and diagnosis remain unchanged. Rust did not execute. These
observations justify a prospective oracle correction, not retrospective passing
results for the original run.

In native 42697283161, both complete 280-predicate reports independently
recompute, but three V005 outcomes differ. Repetition 1 has 177 PASS, 102 FAIL
and one BLOCKED; repetition 2 has 180 PASS, 99 FAIL and one BLOCKED. The differing
IDs are `permissions.origin-grant-isolation`, `permissions.deny-pending-request`
and `permission-lifecycle.basket-denial`. Deny closes the popup before
Playwright's click command resolves; the observer records a transport error and
an empty completion timestamp instead of retaining the original bounded public
call observation. Those cases remain failed observations. A new trusted-click
observer must record the actual matched button event and the wallet's own result
separately; popup closure alone cannot establish a decision.

Both portability scenarios independently pass all nine checks: 12 source and
initial replacement signed transactions close to the pinned mined proof, and
the final replacement contains 13 signed transactions including redemption.
The actual signed spend, exact successful authenticated processing receipt,
final public read and complete snapshot precede source restoration. All six
rejection/recovery and 77 integrated checks pass per repetition. Clause oracle4
retains 133 PASS, 99 FAIL and one BLOCKED each; the valid noSendChange input
passes and the stale returned value fails separately. Rust does not execute
because the parent rejects repetition agreement first. Both module and final
ledger lengths are 53, with no post-module receipts; the captured evidence does
not extend through shutdown. All 176 original members and failed verification
remain unchanged, and all processes/containers clean up.

The additional native clause blocker has independent transaction proof:
`noSendChange` identifies an unsigned transaction's output while `tx` and
`txid` identify the signed transaction. Clearing only the unlocking scripts
reproduces the stale returned TXID exactly. A subsequent call using that returned
outpoint cannot find its output. The [diagnostic receipt](../journals/integrated-native-attempts/2026-11-09/42667035861/independent-review/no-send-change.json)
binds both repetitions, raw signed bytes, independent hashes and unchanged
wallet source. In the original 1.4 oracle3 observations, the invalid-input test remains
BLOCKED because its positive control fails; the laboratory does not rewrite
the native return value. The later oracle4 caller fixture and separate returned-
outpoint predicate are reported independently above.


Foundation 42705007019 retains 287 synthesis PASS, two timeout failures and
nine gated skips. The bounded cryptographic mutation-test deadline is now
15 seconds with unchanged assertions. Its separate listener startup failure
exposed a probe/release/rebind race. Controlled HTTP, Go forwarding, TS storage
and native proxy listeners now atomically acquire their actual ports before
publishing ready endpoints. Restart preserves the published port and fails
explicitly if it is occupied. Nineteen focused checks pass, including concurrent
actual TS/Go services, authentication, routing, restart, occupied-port failure,
post-close refusal and partial-startup cleanup. Native 42705211560 was canceled
before wallet execution so this runtime correction requires fresh qualification.

Foundation 42706097914 passes 289 synthesis tests with nine gated skips,
90 core tests, five Python tests and the actual TS/Go shutdown checks. Its two
storage differences concern only
`provenTxReqs[0].history.notes[1].when`: TypeScript retains
`2026-11-09T21:54:52.660Z`, while pinned Go `time.Time` serializes
`2026-11-09T21:54:52.66Z`. The original strict-string predicates remain FAIL;
all other dataset relationships, transaction bytes, proofs and certificate
removal agree. Fourteen other child oracles independently pass. No descendant
matrix result is inferred from the skipped step.

The separately versioned [component-only ITCVE-1 3.0.0](../itcves/ITCVE-1/3.0.0/README.md)
compares these history timestamps without discarding sub-millisecond precision.
It changes only the specified typed field, rejects invalid calendar/time strings
and preserves all significant fractional digits, original UTC suffixes and
unrelated metadata. Each new-profile worker declares and observes UTC before
services start. The [storage engineering journal](../journals/storage-history-projection/2026-11-09/README.md)
retains the initial four-PASS/four-FAIL local-offset attempt and both subsequent
passing eight-cell matrices, including the final manifest. The final matrix
independently passes all 88 predicates and rejects four rebound corruptions.
Historical storage and descendant policies retain their original source and
outcomes. The native 2.0 plan and all ten acceptance inputs remain unchanged.

The new aggregate requires nine lanes, 30 fresh isolated executions and 590
assertions. Its additional eight-cell descendant matrix contributes 80 of those
assertions and runs only once; retaining it as a separate artifact does not
create another execution or denominator. Both matrices require their exact new
schemas, source-bound projection policies and independent raw-evidence replay.
Component 1.3 remains available with its historical default selection. These
engineering preflights do not establish a new native-wallet qualification.

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
State preservation compares the declared lifecycle-basket output projection
and confirms the rejected transaction is absent from the corresponding action query. It does not assert that inputs quarantined by a terminal
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
checks; the separately frozen native2 execution now establishes the corrected
result in both repetitions without changing earlier failed observations.

The prospective submission-binding policy retains complete indexed submission
and authenticated `processAction` windows. It selects the unique customer
transaction by its ToDo protocol/amount or pre-derived lifecycle script, never
by the desired verdict. The independent parent binds those windows to the global
receipt ledger and signed ancestry. Scoped fixture faults wait across unrelated
traffic; historical unscoped policies and reports remain unchanged.

V007 uses supported Wallet Backup controls to add, synchronize and activate a
second independent Go storage provider. The source listener stops while the
wallet locks, unlocks and reconstructs the ToDo state from the replacement.
Public authenticated reads compare complete logical datasets and transaction
proofs; native ToDo redemption must finish before the source listener returns.
The driver neither extracts the wallet private key nor copies a database. The
prospective driver waits for the actual task checkbox and a canonical, new
outpoint whose same-response BEEF proves the amount, script and protocol.
Pending observations remain in the trace; they cannot initiate replacement.

The [ancestry export compatibility profile](../infra/adapters/storage-portability/README.md)
now supplies each exported owner request with its complete reachable public
ancestor graph from source storage. It does not change the source database or
fetch missing transactions from a network. The Go build layers on the retained
older patch; the TypeScript adapter is separately identified and opt-in. Its
declared wire conversions restrict broadcast flags to booleans or exact 0/1
and scope notification identifiers to the exported owner's records. Both preserve
owner filtering, metadata, item limits and tested rough-size pagination.

[Portability oracle 2](../programs/ISI-4/profiles/native-conformance-2.0.0/portability-oracle-2.0.0.json)
constructs proof graphs only from each retained dataset, verifies the exact
mined root and every owned signed transaction, and still requires actual cold
read/decrypt/redemption while the source is unavailable. It cannot borrow the
task's separately captured BEEF to fill a missing export. Schema 1 retains its
original guard and failures. The [two final reference runs](../journals/native-portability-reference/2026-11-09/ancestry-closure-v2/README.md)
pass 9/9 each. The separate [descendant-funded matrix](../journals/descendant-storage-sync/2026-11-09/README.md) passes all four TS/Go
directions twice with eight distinct fixture identities: 80/80 predicates,
including empty replacements, private owner boundaries, tiny-page traversal,
dataset-only proof verification and fresh-wallet recovery/redemption. These
engineering results are separate from the latest native2 evidence, which now
proves the actual source-off Go replacement path in both repetitions.

This is a fresh-counterpart replacement contract. It does not establish repair
of a previously synchronized incomplete counterpart whose equal-time merge rules
skip unchanged rows. Existing historical profiles remain separately reproducible.

V008 executes 232 source-linked predicates with
[`tpnil-brc100-clause-oracle@3.0.0`](../programs/ISI-4/profiles/native-conformance-2.0.0/oracle-3.0.0.json):
28 return contracts, 181 invalid-input leaves, 11 cryptographic predicates,
seven namespace rules, three metadata predicates, structured errors and an
explicit remaining-coverage gate. A rejected invalid probe requires a successful positive control to earn PASS;
direct acceptance of a known malformed value remains FAIL even if its control fails;
timeouts, denied permission, insufficient funds and JavaScript engine errors
cannot stand in for specified validation errors. Every observation retains
its public call arguments, result or error, source locator and causal controls.

The external certificate issuer now preserves all 32 random symmetric-key bytes.
Its previous integer conversion occasionally stripped a leading zero and
produced an invalid 31-byte positive fixture. A deterministic zero-prefixed key
survives actual remote acquisition, proof and strict SDK disclosure in the
[regression evidence](../journals/certificate-fixture-reference/2026-11-09/README.md).
The correction changes the issuer fixture, not the storage or wallet SUT.

The separately frozen [ITCVE-1 1.5 profile](../itcves/ITCVE-1/1.5.0/README.md)
and [ISI-4 version 3 criteria](../programs/ISI-4/3.0.0/README.md) add 16 native
category/revocation predicates and one returned-change predicate, for 280
conformance predicates. Historical 1.4 plans and evidence remain unchanged.
[Portability oracle 3 preflights](../journals/native-portability-reference/2026-11-09/signed-completion-v3/README.md) retain both failed attempts and the successful native engineering observation. The oracle retains complete authenticated dataset polls and requires a
signed task spend with valid ancestry and successful replacement processing
before the final read, final snapshot and source restoration. Exact rendered
active-status lines permit case and whitespace normalization only.

The [new permission lifecycle](../journals/native-permission-lifecycle/2026-11-09/README.md) uses native basket, certificate and one-shot
spending prompts, Settings individual revocation and origin-wide revocation.
Subsequent native requests prove denied access, restored access and isolation
of unrelated grants and the other origin. Independent certificate decryption,
actual signed payments, exact matching submission receipts and full global
receipt windows supply effects beyond UI text. No private permission store is
edited, and the scenario introduces no funding. Permission denial observations
are bounded by the retained ledger: the module checks its full receipt window,
and publication review also checks the final captured global tail for matching
denied payments. The frozen driver captures that global ledger before browser
and service shutdown, so it does not establish absence through shutdown. A
future shutdown-final receipt needs separate runtime evidence; no later
observation is invented for this run.

[Clause oracle 4 engineering evidence](../journals/native-nosend-change/2026-11-09/oracle4-preflight/README.md)
establishes a valid caller input from final signed transaction bytes and matching
labelled public action outputs. The released wallet passes this input case but
returns a stale unsigned-transaction outpoint, which separately fails the new
return predicate. TypeScript and Go references pass both. Optional absent/empty
returns remain BLOCKED for that unexercised branch; a valid nonempty subset is
allowed. No returned value is silently repaired and no oracle 3 BLOCKED result
is rewritten. These macOS/reference checks are engineering evidence; the new
Linux native profile still requires its own complete retained qualification.

[ITCVE-1 2.0.0](../itcves/ITCVE-1/2.0.0/README.md) and
[ISI-4 4.0.0](../programs/ISI-4/4.0.0/README.md) separately version the stronger
observation boundary after native 42697283161. Permission oracle2 records the
trusted matching DOM button event, exact pending-request nonce and original
public CWI response. Playwright completion or transport errors remain separate;
a closed popup cannot supply missing user-decision evidence. Both original
protocol and category-permission controllers opt in explicitly; prior schemas,
profile1.5 and its frozen acceptance bytes remain unchanged.

The new shutdown-final receipt is captured after awaited browser, controlled
service and temporary-profile cleanup. It binds the original module/global
ledgers and complete retained provider inventory, preserves their exact prefixes,
and includes every provider suffix with explicit provenance. It does not invent
a chronological order between providers. Independent verification rejects
delayed matching denied payments, missing providers or truncated prefixes; only
the separately verified approved five-satoshi transaction within its exact grant
window is exempt. This requires new native execution, not a reinterpretation of
the earlier pre-shutdown snapshot. The 280 conformance predicate identifiers
remain; new environment admission and oracle requirements are frozen separately.

## Reference evidence and unresolved scope

The earlier oracle3 findings below are historical. The latest native2 run uses
clause oracle4 and retains 99 failures in each repetition:

| Latest observation category | Count |
| --- | ---: |
| Malformed input accepted | 73 |
| Wrapped JavaScript exception | 15 |
| Public storage/RPC HTTP500 | 4 |
| Not implemented | 1 |
| Reserved or uppercase namespace not rejected | 3 |
| `listActions` return-contract violations | 1 |
| Missing structured public error fields | 1 |
| Returned `noSendChange` names unsigned rather than final signed outputs | 1 |

The `listActions` predicate covers negative net satoshis, null labels/inputs,
an empty output description and absent tags. It is not solely a satoshi-alias
finding and does not establish invalid transaction conservation. Only
`control.input.listActions.seekPermission` fails in this latest control set:
the supported `false` request is denied, while malformed `null` is accepted.
That acceptance remains FAIL; it does not establish a working positive pair.
The [source-linked independent review](../journals/integrated-native-attempts/2026-11-09/42711700295/independent-review/clauses-findings.json)
retains exact IDs, calls, contract locations and controls. These 99 predicates
are not 99 independent security defects or exclusively Go storage defects.

### Retained oracle3 reference comparison

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

The [read-only clause review](../journals/native-clause-review/2026-11-09/README.md)
retains exact identifiers and source boundaries. Both earlier oracle3 native repetitions have
the same 98 clause failures:

| Observation category | Count | Proven boundary |
| --- | ---: | --- |
| Malformed input accepted | 73 | Native public CWI return; three have failed positive controls and therefore establish acceptance only, not a valid-control pair |
| Wrapped JavaScript engine exception | 15 | Native CWI error message, not a specified argument-validation error |
| Storage HTTP 500 | 4 | Captured storage/RPC error exposed through CWI |
| Not-implemented reference operation | 1 | Native `signAction` recovery/control path |
| Reserved namespace accepted | 3 | Actual native namespace operations |
| Negative net action amount versus positive alias | 1 | Pinned return-contract interpretation; transaction conservation remains independently checked |
| Structured error fields absent | 1 | Native CWI transport observation |

The failed-control malformed acceptances are `listActions.seekPermission`,
`acquireCertificate.certifierUrl` and `acquireCertificate.privileged`. These
cannot establish that their positive configurations work. The clause oracle
never counts a rejection as PASS without a working control. Native public-CWI
behavior is the default attribution; these totals do not assign unproven causes
to Go storage or identify 98 independent defects.

Five broader obligations remain explicit: secondary privileged keys, remaining
permission categories and grant lifecycle, native byte-wire applicability,
conflicting basket-length limits in the pinned source, and remaining
transaction/default/certificate combinations. V008 stays FAIL when executed
predicates fail, or BLOCKED when those obligations are all that remain.
`completeBRC100Conformance` remains false.

| Remaining obligation | Evidence needed to close it |
| --- | --- |
| Privileged secondary keyring | An admitted released configuration with an actual distinct secondary keyring and user-presence path; approval/denial, reason validation, independent key/crypto separation, lock/reload and cache expiry. Bundled optional manager code alone does not establish that configuration. Unsupported optional functionality needs a prospective applicability decision. |
| Permission lifecycle and additional scope | ITCVE-1 2.0 executes basket, certificate and one-shot spending decisions plus individual/origin revocation and isolation; both latest native Linux repetitions independently pass all 16 predicates. Linkage, permission persistence across restart, standing allowances and finite expiry remain additional obligations. The reviewed UI grants default to no expiry; finite-expiry evidence requires a supported configuration rather than private-state manipulation. |
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
`integrated-native-conformance` for the historical 1.4 plan and
`integrated-native-conformance-coverage` for the separately frozen 1.5 plan, and
`integrated-native-conformance-closure` for the separately frozen 2.0 plan.
It builds the Linux/amd64 closure on its
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

After preparing the locked synthesis dependencies and Go toolchain, the new
reference matrix has its own retained output and independent replay:

```sh
node scripts/prepare-storage-portability-go.mjs
node scripts/run-descendant-storage-matrix.mjs NEW_OUTPUT --exact-history
node scripts/verify-descendant-storage-matrix.mjs NEW_OUTPUT --exact-history
```

Foundation CI runs this matrix and uploads `descendant-storage-sync` separately
from the historical integrated component artifact. Native image construction
copies the new source-bound Go binary/manifest only into the prospective image.
The 1.4 plan remains `YOURS-5.1.0-GO-ITCVE-1.4.0-CONFORMANCE-ANCESTRY-CLOSURE`.
The optional 1.5 plan is
[`YOURS-5.1.0-GO-ITCVE-1.5.0-CONFORMANCE-COVERAGE`](../infra/native/conformance/plan-coverage.json).
The 2.0 plan is
[`YOURS-5.1.0-GO-ITCVE-1-V2.0.0-CONFORMANCE-CLOSURE`](../infra/native/conformance/plan-coverage-closure.json).
The engineering archive guards run without starting services:

```sh
node scripts/verify-descendant-storage-archives.mjs --semantic
node scripts/verify-native-permission-lifecycle-archive.mjs --semantic
node scripts/verify-native-permission-click-archive.mjs --semantic
node scripts/verify-native-portability-archive.mjs
node journals/native-nosend-change/2026-11-09/oracle4-preflight/replay.mjs
```

No paid devices, new subscriptions, production routes, production credentials
or public-mainnet spending are involved. Standard public GitHub runner compute
has no direct tariff; artifact storage, owned capacity, operator effort and
development-agent costs remain unreconciled rather than zero. Every recovery
attempt retains its original evidence and a specific corrected precondition.
