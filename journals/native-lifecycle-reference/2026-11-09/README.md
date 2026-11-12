# Controlled broadcast lifecycle diagnosis

These reference-wallet runs isolate the Go service fixture's terminal-rejection
mapping. They issue `ENGINEERING_OBSERVATION_ONLY`; native wallet qualification
requires a separately frozen production-artifact run.

The original Go host returned a transport error for every non-200 response from
`/tpnil/submit`, including a completed HTTP 400 response carrying the exact
submitted transaction ID and `REJECTED` verdict. Go storage consequently returned
`serviceError`, retained the transaction for retry, and exposed its basket output.
The original-host run reproduces the retained V006 pattern: accepted, rejected
and recovered basket counts are 1, 2 and 3; the independent oracle reports PASS,
FAIL and FAIL.

The corrected fixture maps only an exact HTTP 400, transaction-ID-bound
`REJECTED` receipt to a terminal transaction result. Malformed receipts,
unavailable services, mismatched identities and contradictory statuses remain
service errors. This changes the laboratory fixture adapter; the wallet and
upstream Go storage implementation remain unchanged. Both actual TypeScript and
Go reference-wallet runs then preserve the exact accepted output after rejection
and create one independent recovery output (1, 1 and 2). Their errors report
`invalidTx` and `failed` for the rejected transaction. Public `listActions`
excludes failed actions by default, so the error receipt and absence from active
actions are retained separately.

`summary.json` binds the source files, original and corrected Go binary digests,
five attempts, cleanup observations and `evidence.json.gz`. The compressed archive
contains exact JSON and logs with individual sizes and digests. Two preliminary
attempts retain observer verification failures caused by the reference wallet
mutating its input object; the final helper snapshots arguments before the call.
The source files and archive are append-only evidence for this diagnosis.

The independent oracle verifies exact outpoints and metadata, explicit terminal
errors, causal service responses, serialized transactions, signatures, pinned
Teranode-mined ancestry and value conservation. Recovery cannot depend on an
output of the rejected transaction. Tamper tests reject count-preserving output
replacement, lost metadata, retryable or unrelated errors, missing proofs,
altered transaction bytes, delayed-broadcast substitution and incomplete traces.
Actual `EvidenceBundle` serialization is included in the regression tests.

Reproduce on prepared Node and Go toolchains using new output directories:

```sh
(cd synthesis/go && GOTOOLCHAIN=go1.27.3 go build -trimpath -o ../../out/itcve-go-lifecycle ./cmd/itcve-services)
node scripts/run-conformance-lifecycle-reference.mjs typescript out/lifecycle-ts-new
node scripts/run-conformance-lifecycle-reference.mjs go out/lifecycle-go-new
node scripts/verify-conformance-lifecycle.mjs out/lifecycle-go-new/lifecycle.json
npm test --prefix synthesis -- native-conformance-lifecycle.test.ts
```

The helper uses funded public wallet methods without private storage mutation,
aborting the rejected action or relinquishing its output to force a passing
projection. Each reference run retired its services and wallet. Historical
native findings and their original evidence remain unchanged.
