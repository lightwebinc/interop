# Descendant storage profile 2.0.0

This explicit engineering profile verifies public descendant-funded storage replacement in all four TypeScript/Go directions, twice with fresh state and eight distinct identities. It changes only the logical comparison of `provenTxReqs.history.notes[].when`: insignificant trailing fractional-second zeros are removed, while every significant digit, UTC suffix and other metadata value remains exact. Raw public RPC pages and original timestamp strings remain unchanged.

Version 1 retains its original millisecond projection and frozen-source archive replay. Version 2 binds its own manifest, the shared storage-history policy and both implementations' admitted source identities. A v1 report cannot claim v2 acceptance, and a v2 report cannot omit its policy. This does not change native ITCVE-1 2.0.0 acceptance or the unchanged wallet artifact.

The command sets `TZ=UTC` for v2. The direct API requires that declaration and independently observes the resolved process timezone and zero offset before creating services or output. Non-UTC inputs, malformed calendar values and changed instants are rejected; no timezone conversion or numeric rounding is performed.

```sh
node scripts/run-descendant-storage-matrix.mjs out/descendant-storage-v2 --exact-history
node scripts/verify-descendant-storage-matrix.mjs out/descendant-storage-v2 --exact-history
```

The matrix requires 80 passing predicates across eight executions: only public BRC29 descendant funding; empty replacement; bounded and stable proof pagination; authenticated owner isolation; independently complete source and destination ancestry; source listener stopped; fresh-wallet cold list/decrypt; actual task redemption; and cleanup. The independent graph starts empty and admits only public exported transaction/proof bytes. The source compatibility adapters remain explicit; this is reference-storage evidence, not unchanged native-wallet or full BRC-100 conformance.

The original Foundation timestamp mismatch remains failed under its original strict rule in `journals/integrated-component-attempts/2026-11-09/42706097914`. Version 2 also rejects significant sub-millisecond changes that version 1's `Date` conversion could collapse. Retire the compatibility adapters only after admitted upstream releases pass the same replacement contract without them.
