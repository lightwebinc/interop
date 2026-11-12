# Descendant-funded storage replacement reference

The final prospective matrix passes **80 assertions across eight fresh executions**: TypeScript→TypeScript, TypeScript→Go, Go→TypeScript and Go→Go, twice each with a distinct fixture identity. Independent replay from the archived bytes passes. The 22 focused regressions pass, six matrix-level mutations are rejected, and TypeScript typechecking passes. This is engineering reference evidence, **not native-wallet conformance qualification or an unchanged-upstream compatibility claim**.

Only the faucet receives the pinned mined funding transaction. Each separate owner receives an ordinary public BRC29 descendant payment, creates an encrypted PushDrop task, and uses the upstream `WalletStorageManager.syncToWriter` and unadapted `StorageClient` to migrate into empty replacement storage. The source listener stops and the original wallet is destroyed. A fresh same-identity wallet then lists full BEEF, decrypts the exact task, and signs/submits its actual redemption using the replacement alone. No rejected/custom-input branch supplies accidental ancestry, no database is copied, and no root transaction or proof is seeded into the destination. The destination receives only the admitted block headers before synchronization.

The independent oracle reconstructs ancestry from **an initially empty graph populated solely from exported dataset bytes**. Captured creation/payment BEEF cannot fill a missing proof. It verifies transaction hashes, signatures, the exact pinned mined root, BRC29 ownership, task ciphertext/domain, redemption, accepted submission bytes, and source-off timing. It reconstructs every dataset from retained public RPC pages and compares the logical source/destination projection, including exact `inputBEEF` bytes. Database-local IDs/clocks are treated by the existing relationship-aware projector; history timestamps may differ only in equivalent RFC3339 fractional-zero spelling. Raw RPC responses remain unchanged, with the pinned public client’s date/null/byte representation conversion applied separately during reconstruction.

Tiny `maxItems=1`, `maxRoughSize=1` pages retain the same proof bytes and order, advance offsets without omissions or duplicates, and end with an empty page. The established rough-budget convention allows one crossing row. A separately authenticated foreign fixture identity receives the exact authorization rejection. Owner exports retain only owner transaction/output/notification relationships; public ancestor bytes do not import the faucet’s private rows.

The prospective compatibility boundaries are explicit:

- The Go `storage-portability` build adds storage-only reachable ancestor closure and post-enrichment page budgeting. Its original upstream version and parent patch remain pinned separately. The final binary is `34631e87e732e0bb1c14f0494539472ffc250cb4e2ca5419bf731a59a1763268`.
- The opt-in TypeScript instance adapter enriches signed request ancestry before normal page budgeting, maps only exact SQL boolean values to wire booleans, and projects notification transaction IDs to the requesting owner. Same-owner subscriptions on other transaction rows are retained. Unknown, malformed or duplicate IDs reject; an absent optional property and all other notification values are preserved. Source database rows remain unchanged. The manifest SHA-256 is `2db5cb544cdaf7fef14718936f5d1513f5ae885a0442bf1fed9830e9a1e857c7`.
- Historical ITCVE-1.3 defaults and artifacts are unchanged. Retire these adapters only after an admitted upstream release passes the same four-direction descendant-funded matrix without them.

`attempts.zip` preserves the original missing-ancestry failures in both implementations, the TypeScript numeric-boolean and foreign-notification failures, the Go tiny-page failure, and all subsequent observer/startup attempts. Matrix 1 records the cross-module SDK-object and observer-representation errors; matrix 2 failed during source-inventory collection before a worker; matrix 3 ran all customer operations successfully but its frozen observer rejected Go null/date representations. Those original outcomes remain unchanged. Only fresh matrix 4 is accepted as this engineering reference.

`accepted-reference.zip` contains matrix 4, all eight raw observations and worker logs, the exact source-input snapshots, independent replay, focused test/typecheck output, and the six rejected mutation trials. `index.json` binds both original ZIP files and all **191 members** by byte length and SHA-256. The source checkout was dirty because the new implementation had not yet been committed; its exact recorded input bytes, rather than a claim of clean admission, define this reference. Cleanup completed for every accepted execution.

To reproduce from the matching source revision:

```sh
node scripts/prepare-storage-portability-go.mjs
node scripts/run-descendant-storage-matrix.mjs out/descendant-storage-sync
node scripts/verify-descendant-storage-matrix.mjs out/descendant-storage-sync
npm --prefix synthesis test -- descendant-storage-sync.test.ts
```

For archived replay, extract `accepted-reference.zip` into a fresh directory and pass its `descendant-storage-matrix-20261109-4` child to the verifier. The verifier rejects a missing source input, a changed input byte, unadmitted component identities, missing repetitions, or inconsistent fresh identities. Node 24 and the pinned Go toolchain are required. Local owned capacity and development effort were used; their costs are not asserted to be zero.
