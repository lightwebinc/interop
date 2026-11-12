# Native conformance attempt42667035861

[The CI run](https://github.com/p2ppsr/interop/actions/runs/42667035861) executes
frozen source`60c87315cccdfef86523b03a9ce2390bae639dae`. Both native workers
completed, but independent parent verification failed. This archive issues no
qualification and preserves the original reported observations unchanged.

Both repetitions report permission8PASS; lifecycle2PASS/1FAIL;
portability1PASS/8FAIL; clause132PASS/98FAIL/2BLOCKED; integrated graph
62PASS/7FAIL/8BLOCKED. V001–V005 reportPASS and V006–V008 reportFAIL.
The lifecycle recovery call fails before submission with insufficient funds,
while its verifier assumes every scheduled phase submitted a transaction.
The two controlled negative cases exhaust the two available change chains:
Go storage deliberately retains inputs after terminal invalidTx because a
submission service can give a false-positive terminal verdict. This retained
state is not quietly unlocked or retrospectively reclassified.

Portability does not reach its settings UI: its ToDo task cannot be funded.
The later graph carries related funding failures. The extra clause blocker is
a native noSendChange return containing an outpoint for the unsigned transaction,
while the actual returned signed transaction has a different TXID. Original
raw calls and transaction bytes are retained for independent diagnosis.

Both disposable containers were removed and the host user-namespace setting
returned to its original1. Original artifact13697339702 is1,239,936 bytes at
SHA256`6422dc19008616785e6299a23ef9536e11c89de44d9773675ec28b815f66152b`.
All120 artifact members match the extracted observation bytes. The original
all-job log ZIP and API receipts are retained. [Assessment](assessment.json)
records timings, cleanup and per-member hashes; [manifest](attempt.json)
binds the complete publication. A corrected later attempt has separate evidence.

Independent child replay confirms both permission reports at8PASS and both
clause reports at132PASS/98FAIL/2BLOCKED. Public BRC42 derivation binds all five
fulfilled permission keys in each repetition to its joined native identity.
The [noSendChange diagnostic](independent-review/no-send-change.json) independently
hashes signed transaction bytes and proves that clearing the unlocking scripts
reproduces the stale returned outpoint TXID exactly. Its script and input/source
hashes are retained alongside [the review receipt](independent-review/review.json).
These diagnostics do not turn this failed parent verification into qualification.
