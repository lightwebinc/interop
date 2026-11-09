# Native permission lifecycle engineering preflight

The unchanged released Yours Wallet 5.1.0 passed the original eight permission checks and all 16 new permission lifecycle checks in a fresh macOS Chromium session with the explicit Go storage-portability compatibility build. The final lifecycle ran from 20:48:51.039Z to 20:49:10.595Z; exact timestamps are retained in the report. This is local engineering evidence, not Linux/native qualification or a full BRC-100 conformance claim.

The new scenario exercises visible basket, certificate-field and spending prompts through `window.CWI`, then Settings → Permissions single-grant and origin-wide revocation. It independently verifies the actual signed transactions and mined ancestry, issuer signature, native subject identity, one disclosed certificate field and its 32-byte revelation key. A denied payment must have no matching customer submission; unrelated background receipts remain retained. Reactive spending consent is one-shot. After single revocation, the native wallet must prompt again, deny, then explicitly approve recovery and cache that grant. The certificate grant and another origin remain isolated. Origin-wide revocation requires its visible confirmation and renewed enforcement.

The final report and screenshots are in `go-reference/evidence/conformance/`. The source files in `go-reference/source/` were copied before the final execution. `engineering-runner.ts` retains the public-UI bootstrap and fixture funding procedure. `focused-tests.log` contains 39 passing independent replay and adversarial tests; `typecheck.log` records successful TypeScript validation. The regression suite replays these actual observations; synthetic mutations are oracle tests only.

`prior-attempts.zip` preserves all earlier outputs and logs: a bootstrap handler missed grouped “Allow Selected”, the setup controller missed a later grouped request, two intermediate scenarios passed, and a later fresh-wallet onboarding attempt timed out waiting for “Copy to Clipboard”. A further Go preflight passed before the receipt-window oracle was hardened. Those observations remain unchanged. Every attempt closed its owned browser/services and removed its temporary browser profile. The final controller scopes any grouped approval to ToDo setup; the two test origins have no manifest standing spending allowance.

`manifest.json` binds the exact retained inventory and every original attempt ZIP member. The standalone semantic guard replays the original eight and new16 predicates using the archived observer/model/fixture source and frozen dependency lock; mutable development code does not change that replay. Replay the final evidence and mutation checks with:

```sh
npm --prefix synthesis test -- native-conformance-permission-lifecycle.test.ts
npm --prefix synthesis run typecheck
node scripts/verify-native-permission-lifecycle-archive.mjs --semantic
```

The scenario does not test finite expiry, privileged keys, secondary keyrings, physical USB, grouped standing budgets or counterparty pacts. The wallet artifact is unchanged, original V005 checks remain unchanged, and the new checks are prospective additions for ITCVE-1@1.5.0 / ISI-4@3.0.0.
