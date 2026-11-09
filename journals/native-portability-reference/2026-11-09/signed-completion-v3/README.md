# Prospective signed completion observer

This archive retains three macOS Chromium engineering attempts using the unchanged Yours Wallet5.1.0 extension, public CWI, native settings Add/Sync/Make Active/Remove, native Lock/Unlock and the unchanged ToDo application. The declared Go ancestry-closure storage adapter backs both counterparts. Controlled TypeScript overlay and Chaintracks support this isolated preflight. It is not Linux sandbox qualification.

The first two attempts demonstrate why an observer must wait for the application’s public operation to finish. Starting a separate authenticated storage observer while the native redemption was in progress produced two storage createAction calls for one public call, leaving an unsigned input reservation and a subsequent not-spendable error. A complete dataset was retained during the bounded wait; neither failure was promoted. The first attempt additionally omitted replacement RPC evidence on timeout, which caused independent disagreement for its earlier cold-read assertion. The second retained those observations and independently reported8PASS/1FAIL.

The third attempt waits for the unchanged ToDo success message, emitted only after awaited signAction, before observing storage. The signed transaction, exact successful authenticated processAction request/reply, dataset-only ancestry, final public task read and complete final dataset all precede source restoration. The independent oracle reports9PASS. The UI message alone cannot prove redemption. The final source snapshots and probe are included; the earlier experiments are not attributed to the final driver bytes.

The native6 CI sample remains failed and immutable in `journals/integrated-native-attempts/2026-11-09/42690318194`. Its frozen oracle2 rejects CSS-rendered `IN USE`, and its final snapshot captured an unsigned reservation. Oracle3 changes only the prospective1.5 observer and visible status normalization. Schemas1/2 retain their original behavior.

Reproduce the retained evidence check:

```sh
node scripts/verify-native-portability-archive.mjs
npm --prefix synthesis test -- native-portability-completion.test.ts
```

The second command tests both original native6 pending samples, the actual passing preflight and mutations of status text, UI completion, signed bytes, successful RPC identity/body/result, page boundaries and timestamps. The original compressed members are verified before parsing. All temporary native browser profiles and task-owned services were closed.
