# Native conformance execution

This prospective closure uses the unchanged Yours Wallet 5.1.0 release with
[ITCVE-1 1.4.0](../../../itcves/ITCVE-1/1.4.0/README.md) and
[ISI-4 2.0.0](../../../programs/ISI-4/2.0.0/README.md). The plan freezes both
documents' machine-readable inputs and the source-located BRC-100 contract.
The historical 1.3.0 image and plans remain separate.

The workflow `ISI-4 Yours Wallet controlled-service run` accepts the
`integrated-native-conformance` profile. It builds the existing native and
integrated closures, then this Dockerfile. On the admitted Linux/amd64 runner,
the equivalent execution commands are:

```sh
node scripts/run-native-go-wallet.mjs IMAGE NEW_OUTPUT --conformance
node scripts/verify-native-integrated.mjs NEW_OUTPUT
```

Every repetition runs the original ToDo sequence, the isolated visible-consent
scenario, terminal rejection/recovery, native Wallet Backup replacement, the
joined component graph and the clause corpus. The clause corpus executes while
the explicitly authorized fixture certifier remains trusted; the existing
trust finalizer then restores the settings. The replacement storage stays alive
for the graph and is retired with the parent controlled services.

The Go fixture enables `--terminal-rejection-receipts` explicitly. Both the
primary and replacement storage identities declare `terminal-rejection-v1`.
Only a matching transaction ID, HTTP 400 and `REJECTED` verdict establish a
terminal rejection. Historical profiles retain the original status-only
behavior. This is a declared lab adapter correction, not a wallet modification.

Raw evidence lives in `evidence/conformance/`: `baseline-vectors.json`,
`permissions.json` and screenshots, `lifecycle.json`, `portability.json`,
`clauses.json`, `service-counterparts.json` and `result.json`. The enclosing
evidence manifest binds every file. Independent verification retains genuine
SUT failures, proves the metadata transaction against captured signed ancestry,
and prevents reference-wallet observations from qualifying native behavior.
Remaining comprehensive BRC-100 obligations remain explicit; successful
environment admission is not complete BRC-100 conformance or certification.

The runner requires committed source, two fresh containers, network-none,
read-only root filesystems, the native Chromium sandbox and scoped controlled
CA trust. The per-repetition bound is 900 seconds, plus 60 seconds for the host
deadline. It preserves every failed attempt, restores the runner namespace
setting, removes containers, and verifies wallet, service and database cleanup.
