# Yours Wallet 5.1.0 — all-Go ITCVE-1 native qualification

[The executed source run](https://github.com/p2ppsr/interop/actions/runs/42281886073)
completed two fresh Linux/amd64 repetitions on source
`9906dc9f85c35b4c069acb170889ec62de57fe44`. The [qualification](qualification.json)
issues `EXPERIMENTAL_CONFORMANCE_RESULT` under ITCVE-1 1.2.0, with
`qualifiedEnvironment: true`, matching semantic projections and overall `FAIL`.

| Vectors | Finding |
| --- | --- |
| V001–V004 | PASS: exact native artifact, mined funding, ToDo creation, cold reconstruction and serialized redemption |
| V005 | FAIL: denied-protocol and alternate-origin requests lacked independent denial/origin decisions |
| V006 | FAIL: the controlled rejection increased the returned output count from 1 to 2; recovery increased it to 3, failing preservation and the expected recovery baseline |
| V007–V008 | BLOCKED: ISI-3 counterpart replacement and the remaining clause-level BRC-100 corpus |

Both accepted and recovered immediate submissions were observed. These findings
apply to this wallet, browser and all-Go closure; they do not admit Android,
desktop HTTP wallets or mixed closures. Certification remains unavailable.

The independent verifier checks exact archive installation receipts, Chromium
sandbox and CA trust, kernel network-none and negative IPv4/IPv6 probes,
capability removal, mined fixture header/proof and descendant transaction
scripts, protocol/task contents, retained state and the actual redemption spend.
Both redemptions conserve value with a 31-satoshi fee. Docker containers exited
with code zero and were removed; Mongo exited normally without a forced kill;
the temporary host namespace policy was restored.

The original Actions ZIP is artifact `13536735236`, 258156 bytes, SHA-256
`664787769c0fe04fb7f6843c422b812d198c4ec27141a1f924b7bae1d9e9a254`.
[Provenance](provenance.json) binds every extracted original file. Independent
download and offline verification reproduced the result. Earlier unsuccessful
attempts remain under `journals/native-wallet-attempts/`.

From the repository root, after installing locked synthesis dependencies:

```sh
synthesis/node_modules/.bin/tsx synthesis/src/wallet-lab/native/verify.ts journals/native-wallet-qualification/2026-11-06/yours-wallet-5.1.0-all-go
npm run verify:journals
```
