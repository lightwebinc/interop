# Third-party notices

The files under `src/lch-reference/` and `test/lch-reference.test.ts` are adapted from `bsv-blockchain/ts-stack`, application `apps/lch-reference`, commit `f999e0c1aad9a7afd0cbadaaf23841d049af9d5a`. They are distributed under the Open BSV License. The upstream license text is retained in `LICENSES/ts-stack-lch-reference.txt`.

The pinned `@bsv/sdk`, `@bsv/chirp`, and `@bsv/lch` packages contain their own notices and license metadata in the resolved npm artifacts.

Original TPNIL synthesis code outside the imported paths above uses [Apache-2.0](../LICENSE). The package contains materials under different licenses; the root [inventory](../THIRD_PARTY_NOTICES.md) describes the boundary.

The installed pinned artifacts for `@bsv/sdk`, `@bsv/chirp`, `@bsv/lch`, `@bsv/wallet-toolbox`, `@bsv/auth-express-middleware` and `@bsv/payment-express-middleware` each carry Open BSV License Version 6 in `LICENSE.txt`. Their license-text SHA-256 is `bac995a0c84dd533f7d5335b6d870aae9fee7d28d189b8aa78b103e0c9932bc0`, matching the retained [reference](../LICENSES/Open-BSV-License-6.reference.txt). These dependency terms remain in force.

## Optional Go controlled-service dependencies

The optional ITCVE Go host links the exact Go Overlay Services, Go ChainTracks,
Go SDK and Go Wallet Toolbox modules resolved by `synthesis/go/go.mod` and
`go.sum`. The three service source revisions and module checksums are recorded
in [the component lock](go/components.lock.json). The three pinned service modules carry Open BSV License Version 5; their
unchanged license texts remain in the resolved module archives; linking or downloading them supplies no additional rights.
The digest-pinned MongoDB container used for component qualification retains
its own license. Original laboratory host and adapter code remains Apache-2.0.
