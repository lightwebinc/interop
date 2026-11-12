# noSendChange prospective fixture preflight

The TypeScript and Go reference public APIs pass the two bounded oracle4 checks.
The unchanged Yours Wallet 5.1.0 public CWI on macOS/arm64 passes the malformed
outpoint check with an independently established positive control and fails the
separate returned-outpoint check. Its response contains pre-signing transaction
IDs; signed AtomicBEEF and the public action lookup identify different final IDs.

The positive fixture reads a uniquely labelled pending action through
`listActions`, joins every selected change output to signed bytes and the pinned
mined ancestry, and then uses those observed outpoints. It retains the original
wallet return verbatim. This is engineering evidence, not Linux native
qualification or a wallet implementation fix.

The native preflight executed the first oracle4 candidate, which compared the
entire returned set. Its original response, FAIL detail, script and timestamps
remain unchanged. The final checker treats the optional absent or empty return
as an unexercised branch and accepts a valid nonempty subset. Its source hashes
and independent replay are retained in `preflight-review.json`; the actual stale
IDs still fail. This preflight did not freeze a complete observer source snapshot
before execution. The separately frozen Linux evaluation establishes scored
native results.

Two earlier unit-test failures are retained. Their test fixture replaced a
multi-output array instead of changing only element zero; the final test changes
exactly one field. Final checks pass 55 TypeScript and clause tests and seven Go
tests, including proof, signature, output, lookup and response mutations. The
original native5 oracle3 report still replays as 132 PASS, 98 FAIL and two BLOCKED.

From the repository root, after installing the pinned synthesis dependencies:

```sh
node journals/native-nosend-change/2026-11-09/oracle4-preflight/replay.mjs
```

`provenance.json` binds the original raw bytes, compressed copies and logs. Replay
requires the exact recorded checker sources and never modifies archived reports.
