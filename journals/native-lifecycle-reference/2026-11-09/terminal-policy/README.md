# Explicit submission policy and public terminal receipts

These append-only engineering observations extend the earlier lifecycle
diagnosis without changing its files. All four runs use the same freshly built
Go host binary. The prospective `--terminal-rejection-receipts` policy yields
three PASS findings; the default historical policy retains PASS/FAIL/FAIL and
the rejected tracked output. This proves the correction is explicitly scoped.

The second pair captures exact public Go storage `processAction` requests and
responses. Both independently verify PASS/PASS/PASS, including a run through an
explicit reference facade that drops structured error fields and preserves only
the error message. That facade exercises the unchanged native CWI's documented
error-transport limitation; it is not a native wallet qualification. No fields
are invented or restored into the application error.

The v2 oracle binds the authenticated request identity, JSON-RPC ID, submitted
transaction ID and raw transaction bytes to the public storage receipt. Terminal
`invalidTx` and `failed` results are distinct from retryable `serviceError`.
The original checks still require an observed application rejection, exact prior
spendable output metadata, absence of the rejected active action, independently
valid signed ancestry, and a successful subsequent transaction that does not
spend the rejected output. Historical v1 reports retain their original oracle.

`summary.json` records exact host binary identities, every raw file's enclosing
archive hash, cleanup, outcomes and the source snapshot used for independent
verification. `evidence.json.gz` contains all four runs and an actual Playwright
page test of synthetic error transport. The browser test establishes only that
the bridge preserves fields when present; the unchanged wallet discards its
structured fields earlier. V008 retains that separate conformance deficiency.

Reproduction uses the reference script with `TPNIL_LIFECYCLE_GO_BINARY` naming
the freshly built host. `TPNIL_LIFECYCLE_LEGACY_RECEIPTS=1` selects the historical
default. `TPNIL_LIFECYCLE_STORAGE_RECEIPTS=1` selects the v2 receipt oracle, and
`TPNIL_LIFECYCLE_MESSAGE_ONLY_ERRORS=1` enables the explicitly declared reference
error facade. Every run requires a new output directory.
