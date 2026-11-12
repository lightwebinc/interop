# Trusted-click permission observer, version2

Two fresh macOS sessions of the unchanged released Yours Wallet 5.1.0, each using the declared Go storage compatibility build, passed the original eight protocol-permission predicates and all16 category/revocation predicates: 48 passing assertions across two distinct native identities. These are engineering preflights for prospective ITCVE-1@2.0.0 / ISI-4@4.0.0, not Linux qualification or full BRC-100 conformance.

Native run42697283161 exposed the previous observer race: a real Deny action could close its popup while Playwright was still completing `locator.click`. Version1 retained an empty click-completion timestamp and replaced the native promise observation with an observer error. Both original failed reports and their unequal repetitions remain unchanged in `journals/integrated-native-attempts/2026-11-09/42697283161`. Version1 defaults and its frozen journal replay remain unchanged.

Version2 arms a passive capture listener before the ordinary visible button click. It records the exact trusted left click, popup/main frame, enabled visible control, prompt body, event timestamp and host receipt. Distinct request nonces bind these records to the original public CWI promise, including cached responses. The automation result is separate. A target-closed transport error can accompany PASS only when the actual trusted matching click and subsequent native terminal result were both observed. Closure alone, synthetic events, stale responses, missing receipts and unrelated errors fail. The observer does not synthesize wallet events, change handlers, cancel propagation, access private grants or use extension messaging.

The real popup-closes-on-Deny selftest passed20 repetitions. These synthetic application observations are explicitly separate from native wallet evidence. All20 click calls happened to resolve; the logs do not claim a reproduced Playwright transport failure. The focused unit corpus additionally checks the target-closed exception branch, missing/synthetic events, causal ordering and request/event replay. The initial selftest observer transpilation error is retained unchanged.

`manifest.json` binds every file and the exact replay input inventory. Each native repetition retains public reports, screenshots, the original execution log, source snapshots copied before execution and cleanup receipts. No browser profiles, private wallet database or recovery material are archived. `replay-source/` permits independent offline verification without changing historical verdicts when development source advances.

```sh
node scripts/verify-native-permission-click-archive.mjs --semantic
npm --prefix synthesis test -- native-permission-click.test.ts native-conformance-permissions.test.ts native-conformance-permission-lifecycle.test.ts
```
