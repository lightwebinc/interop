# ISI-4 2.0.0: native wallet conformance and application interoperability

This prospective major version strengthens V005–V008 for the unchanged Yours Wallet 5.1.0 Chromium extension in [ITCVE-1 1.4.0](../../../itcves/ITCVE-1/1.4.0/README.md). The [catalog](catalog.json) retains all eight permanent vector and requirement identifiers. V001–V004 keep their 1.0.0 criteria. Revised V005–V008 use version 2.0.0 and produce new results; the earlier catalog, evidence and non-passing outcomes remain unchanged.

The declared substrate is the wallet's public injected `window.CWI`, with supported native UI for consent, storage settings, and locking. It does not admit another wallet, an Android artifact, an HTTP wallet or a native byte-wire endpoint by analogy. [Production-fidelity intake](../../../docs/intake.md) still requires digest-verified released bytes, declared mainnet configuration, ordinary integration paths and controlled funding provenance.

## Frozen criteria

### V005: real permission decisions

The [permission model](../../../synthesis/src/wallet-lab/native/conformance-permissions-model.ts) specifies the exact same Level 2 protocol, key, counterparty and derivation request at `https://deny.itcve.test` and `https://alternate.itcve.test`. Nine sequential requests establish a fresh rejection, primary approval and cached access, alternate-origin rejection and explicit denial, preserved grants, then alternate approval and cached access.

The controller suspends the legacy automatic prompt handler while it owns the scenario. Three actual native Allow/Deny choices must occur on a matching Protocol Permission popup while its request remains pending. Each observation identifies the origin, protocol, security level and counterparty and binds the captured PNG bytes by digest. Timeouts, unsupported methods, network errors and observer failures cannot satisfy rejection. All eight independent assertions, including cleanup, must pass.

### V006: rejection and recovery with exact state

The original ToDo UI transaction lifecycle remains required. The new native public-CWI scenario submits accepted, rejected and recovered actions with immediate broadcast requested. Its three predicates are `accepted-service-verdict-observed`, `rejection-preserves-wallet-state` and `post-rejection-recovery`.

The controlled service observation is independent of the wallet return value. The rejected action must carry the specified terminal failed/invalidTx result, remain absent from tracked actions, and preserve the exact prior spendable-output projection. Recovery must add exactly the intended accepted output while preserving previous outputs. The observer does not repair state using abort, relinquishment or storage mutation. The verifier checks actual serialized outputs, metadata, signatures and proof-carrying ancestry. Passing the API path cannot override a failed ToDo UI path.

### V007: native-mediated counterpart replacement

The native wallet creates a ToDo task, adds and synchronizes a second storage counterpart through supported settings, activates it and removes the original. The two services have distinct storage identities and databases. Read-only authenticated observers compare all canonical logical records, bytes, metadata and relationships. A native `processSyncChunk` write must establish the wallet's mediation; observer-populated storage is ineligible.

The original source listener is stopped and independently probed unavailable. Native Lock/Unlock discards the live wallet context, the application cache is cleared, and the application reloads. The same wallet identity, encrypted task and unspent outpoint must be recovered from the replacement and the task redeemed through actual ToDo UI while the source remains unavailable. The signed spend and replacement persistence are independently checked. All nine assertions must pass in `native-ui` mode, and cleanup restores the stopped endpoint. A `reference-engineering` result cannot qualify V007.

### V008: comprehensive coverage stays explicit

The [derived contract](../profiles/native-conformance-2.0.0/brc100-contract.json) traces 28 methods to the exact BRC-100 source at commit `39a643ff148a8dcd23ec08986a8ddeb7d5713743`, file `wallet/0100.md`, SHA-256 `537ab393c655195e8cd61897b00d6b187a36f17d930493f8af48430752064082`. The existing stateful 42-assertion native corpus and trusted identity discovery remain part of the execution. The new [clause model](../../../synthesis/src/wallet-lab/native/conformance-clauses-model.ts) adds 232 assertions: 28 output contracts, 181 invalid-input leaf cases and 23 semantic/coverage cases.

Independent semantic cases cover BRC-42 child keys and context separation, peer encryption and authenticated-decryption failures, independently calculated HMACs, direct-hash and peer signatures, reserved namespaces, exact metadata and pagination. Invalid input must produce a matching specified rejection; transport errors and timeouts do not pass. A successful output-shape check is only evidence of that shape, and does not count as complete semantic coverage of the method.

R008 retains its comprehensive meaning. An implemented clause failure makes V008 FAIL. If no implemented clause fails, V008 remains BLOCKED while required source obligations are unqualified. The following obligations remain explicit in the frozen model:

- Privileged secondary-keyring and supported user-presence fixtures.
- Basket, spending, certificate and linkage permission categories, including revocation and expiry.
- A laboratory-admitted native byte-wire ABI endpoint.
- The basket-name length disagreement between the 300-byte interface alias and 400-byte prose.
- Additional optional transaction and certificate paths, batching, defaults, pagination and conflicting-parameter combinations.

Accounting for these gaps is an executable coverage check, not implementation of the missing behavior. `completeBRC100Conformance` remains false. No unexecuted obligation is counted as passing, and this version does not rename comprehensive coverage into a bounded passing subset.

## Qualification and migration

The [native plan](../../../infra/native/conformance/plan.json) and [environment profile](../../../itcves/ITCVE-1/1.4.0/profile.json) are frozen before scored execution. Two fresh isolated native repetitions must retain complete evidence and matching declared semantic projections. The infrastructure qualification result remains separate from SUT findings; reproducible FAIL and BLOCKED outcomes are valid findings. Local mutation tests and reference preflights validate the observer and remain engineering evidence.

Version 2.0.0 adds stronger mandatory predicates and native counterpart replacement, while preserving V008's unresolved comprehensive obligation. Historical [1.0.0](../1.0.0/README.md) results retain their original rules. There is no retrospective upgrade, automatic certification, public-mainnet acceptance claim, or retirement of the historical profile.
