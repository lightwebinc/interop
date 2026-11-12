# Declared initial native funding reserves

Native run 42667035861 on source `60c87315cccdfef86523b03a9ce2390bae639dae` completed
two real wallet repetitions. Both lifecycle reports retain accepted PASS,
rejection/state-preservation PASS and recovery FAIL. Recovery returned
`funding failed: not enough funds` before submission. The corrected evidence
oracle verifies those exact failures without inventing a recovery transaction;
it still rejects a forged PASS or missing proof for any submitted operation.
The original GitHub artifact digest remains
`6422dc19008616785e6299a23ef9536e11c89de44d9773675ec28b815f66152b`.

The pinned Go Wallet Toolbox 0.191.4 deliberately retains inputs of posted
terminal-invalid transactions. Its status-review code warns that automatically
reusing them could double-spend an accepted transaction after a false rejection.
The unchanged native wallet exposes no public UnFail review UI. These behaviors
are preserved. The earlier ToDo rejection and stronger lifecycle rejection
quarantined both change chains produced from the native wallet's initial 10,000
satoshis. Further operations had no unaffected funding left. Reference tests
using the large faucet identity had not reproduced that funding topology.

The prospective setup declares two additional 10,000-satoshi BRC29 payments before
any customer scenario. Actual public wallet key derivation and internalization
establish ownership; an authenticated read-only Storage RPC snapshot establishes
that both outpoints exist and are spendable. This avoids the native wallet's
admin-only default-basket query. Independent verification binds native identity,
exact signed mined ancestry, raw storage transaction bytes, full authenticated
RPC pages, submission order and preparation timestamps. A shared accepted graph
rejects duplicate/conflicting input spends and consumption of any initial native
payment before the first customer operation.

Every baseline input branch must terminate at the exact original payment or one
of the two declared reserve outpoints. Later clause metadata may also use only
the separately verified 1,000-satoshi BRC29 method-corpus payment. Its receiver,
derivation, script, mined proof, storage bytes and prior submission are checked
independently. Faucet change ancestry alone cannot qualify a native funding root.

Fresh TypeScript and Go reference runs both pass reserve preparation, two real
policy rejections and the subsequent lifecycle recovery without a refill. This
proves continued operation with unaffected pre-existing funds. It does not prove
release or reuse of rejected input chains, nor qualify the native wallet. A fresh
native run is required. All temporary wallets and services were closed.

`summary.json` binds the source snapshot and `evidence.json.gz`. The compressed
record retains raw setup/storage/authentication/transaction observations, exact
old native lifecycle reports, successful checks and earlier local test/oracle
failures. `scripts/verify-native-reserve-reference.mjs` independently replays the
archive, including transaction signatures, both rejected transactions per
reference run, declared funding roots and the original native recovery failures.
Its CI invocation is separate from new native qualification.

```sh
node scripts/verify-native-reserve-reference.mjs
npm test --prefix synthesis -- native-conformance-reserves.test.ts native-conformance-lifecycle.test.ts
TPNIL_RESERVE_STORAGE=go npm test --prefix synthesis -- native-conformance-reserves.test.ts
```

The Go engineering command requires the prepared pinned host at
`out/itcve-go-storage-sync`; ordinary synthesis tests run the TypeScript reference.
`TPNIL_RESERVE_EVIDENCE` selects a fresh directory for retaining new raw reference
observations. No public-network broadcast or new infrastructure was used.
