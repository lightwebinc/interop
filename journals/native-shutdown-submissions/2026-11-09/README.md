# Shutdown submission observer preflight

These are engineering tests for the explicitly selected ITCVE2.0 shutdown observer. They do not qualify a native wallet run. The tests reuse immutable public evidence from failed native run42697283161; prospective version labels and late-receipt counterfactuals exist only in unit fixtures. The original archive and reports are unchanged.

The actual controlled-service test starts and closes isolated source and replacement providers for both TypeScript and patched Go. It proves that detached observer references retain all provider receipts after normal service cleanup retires the ownership maps. The async finalizer tests append observations during browser/service close and verify capture occurs afterward. The parent must also admit real native process shutdown and the final worker hash in a future frozen run.

Eleven final tests pass. They cover the exact provider inventory, complete initial/global/module prefixes, every provider suffix with unique provenance, cleanup failures and ordered timestamps. Sixteen rebound receipt mutations fail. Eight delayed denied-payment amount/verdict combinations fail, as does an approved transaction repeated outside its original grant window. A same-script5sat receipt before the module begins is preserved. The independently verified approved payment retains its exact native signed bytes and original grant position.

The initial failed test experiment is retained: its supposed premature capture used an equal millisecond timestamp, and its teardown called a non-idempotent close method twice. The corrected tests establish the intended counterfactuals. The temporary2.0 type-union error during coordinated version wiring is also retained; final typechecking passes.

```sh
npm test --prefix synthesis -- native-shutdown-submissions.test.ts
```

The live Go test explicitly skips if the separately prepared versioned Go binary is absent; it passed here with that exact binary. All task-owned services were closed. Historical profiles do not select this observer implicitly.
