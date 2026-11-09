# Native portability reference preflight

These are engineering reference observations, not native-wallet qualification.
The prospective native scenario uses the unchanged Yours 5.1.0 Settings UI to
add a remote, synchronize, make it active, and remove the original counterpart.
It then stops the source TCP listener, locks and unlocks the wallet to retire its
live context, clears the ToDo application cache, reloads the application, and
decrypts and redeems the same previously unspent encrypted task.

The two final reference runs exercise real authenticated Wallet Storage and
signed transactions with Teranode-mined ancestry. Both pass nine predicates.
The Go mediator uses the upstream StorageClient directly, without a sync wire
adapter, and both counterparts inherit the prospective terminal-rejection
fixture policy. Reference cold recreation uses the public fixture key and is explicitly
rejected by the verifier's default native admission; native execution never
extracts a key or copies a database.

`summary.json` binds the compressed archive, individual files, source inspection,
and source files used for this engineering preflight. The archive retains early
failed runner and verifier attempts. Nothing converts those failures to passing
samples. The final verifier reconstructs the complete datasets from captured
authenticated RPC replies, compares every logical record and relationship,
verifies transaction signatures and proof ancestry, and requires a replacement
redemption while the source listener is unavailable.

Extract the JSON gzip archive, validate every entry's size and SHA-256, and write
each entry's `content` to its declared relative path in an isolated directory.
From the repository, replay either final report with:

```sh
node scripts/verify-conformance-portability.mjs PATH/portability.json --reference
```

Reproduce against fresh isolated services using:

```sh
node scripts/run-conformance-portability-reference.mjs out/new-portability-ts typescript
node scripts/run-conformance-portability-reference.mjs out/new-portability-go go --native-wire --terminal-rejection-receipts
```

No native CI was dispatched by this preflight. The native driver owns its
replacement through the enclosing service graph; it remains active for later
joined application scenarios and is retired by `ControlledWalletServices.close`.
