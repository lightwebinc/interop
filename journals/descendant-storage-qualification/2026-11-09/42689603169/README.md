# Clean-CI descendant-funded replacement — 42689603169

All four source/destination directions pass twice at clean frozen source
`d02414f58d888e3d11913dedd888a3e5871bf29f`: **eight fresh identities, eight executions, 80 PASS assertions**.
All three Foundation jobs succeeded. Independent offline replay on macOS/arm64
using the exact frozen git source also passes. Every recorded source-input byte
matches its git blob and all 46 original artifact members remain unchanged.

`descendant-storage-sync.zip` is the original GitHub artifact, 1,515,951 bytes,
SHA-256 `6e58bbd59e27fb2a82227d7ed965498cf7aca70475ac92bafceb1b3756f52fca`, matching the GitHub API digest. Original run/job/artifact
receipts and all three job logs are retained. `provenance.json` binds every file;
`qualification.json` binds every input, repetition, assertion and artifact member.

The test gives only the faucet the pinned mined transaction. Each separate owner
receives a public BRC29 descendant payment, creates an encrypted task, migrates
through the unchanged upstream WalletStorageManager/StorageClient into empty
storage, retires its original wallet, and stops its source listener. A fresh
same-identity wallet lists full BEEF, decrypts and actually redeems the task using
the replacement alone. The independent oracle starts its proof graph empty and
uses only exported dataset bytes; separately captured creation/payment BEEF
cannot supply a missing ancestor. Exact proof bytes, logical metadata, paging,
owner isolation, signed submissions and cleanup are checked independently.

The source implementations explicitly select the versioned Go portability patch
and opt-in TypeScript export adapter. The Linux/amd64 Go binary SHA-256 is
`5c92bb1714591d1e3afe200401afb33c01491074545f261578b04b82746b1005`. This is storage reference qualification; it is
not unchanged native-wallet or complete BRC-100 conformance. Original unadapted
proof-export failures and local engineering attempts remain in
`journals/descendant-storage-sync/2026-11-09`. The historical 510-assertion
component pack is separately archived under
`journals/integrated-component-qualification/2026-11-09/42689603169`.

Reproduce from the frozen source with pinned dependencies:

```sh
node scripts/prepare-storage-portability-go.mjs
node scripts/run-descendant-storage-matrix.mjs out/descendant-storage-sync
node scripts/verify-descendant-storage-matrix.mjs out/descendant-storage-sync
```

For offline replay, extract this ZIP to a fresh directory and give that directory
to `verify-descendant-storage-matrix.mjs`. Use the matching frozen source: the
verifier deliberately rejects changed source bytes or missing input inventory.
No services start during offline replay. Retire the compatibility adapters only
when admitted upstream releases pass this same matrix without them.
