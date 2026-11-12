# Mediated storage interoperability with exact history instants

Version **2.0.0**, status **EXPERIMENTAL**. Select it with
`node scripts/run-storage-sync.mjs OUTPUT --projection-v2`. Omitting the flag
keeps version 1, including its literal history timestamp comparison. Native
portability continues to use its separately frozen projection and criteria.

This profile retains every operation and predicate from the version 1 mediated
storage profile: authenticated multi-remote synchronization, committed response
loss, restart/resume, replay, identity isolation, tombstones, active-provider
replacement, fresh-client decryption and a signed post-replacement write. It
changes only the explicitly declared logical representation of
`provenTxReqs.history.notes[].when`.

The pinned TypeScript source emits millisecond timestamps such as
`2026-11-09T21:54:52.660Z`. The pinned Go `HistoryNote.When` is a `time.Time`;
its JSON serializer can emit `2026-11-09T21:54:52.66Z` for the same instant.
Foundation run 42706097914 retained that exact difference and failed the original
version 1 initial and incremental comparisons. That sample remains failed under
its original rule. Certificate relinquishment itself propagated correctly.

Version 2 validates each present timestamp as a four-digit Gregorian date and
UTC time with uppercase `T`, hours 00–23, minutes/seconds 00–59, optional decimal
fraction, and suffix `Z` or `+00:00`. Unknown offsets and leap-second spelling
are rejected. Only trailing fractional zeros are stripped; an all-zero fraction
is omitted. The original UTC suffix remains unchanged. All significant digits
are preserved as strings, including precision finer than a nanosecond. No
`Date`, floating-point time, rounding, clock deletion, or array sorting occurs.
All other history attributes, order, metadata, relationships and transaction /
proof bytes retain version 1 semantics. Original datasets and RPC traces remain
unchanged.

[profile.json](profile.json) binds the pure projection implementation, unchanged
version 1 projector, and exact typed Go source provenance. Producer and offline
verifier explicitly bind its policy and digest in version 2 run/matrix schemas.
The aggregate component profile selects it explicitly; older records cannot
implicitly opt into it. The independent verifier also rejects digest-rebound
changes to significant timestamp digits, calendar validity, unrelated metadata,
and mined proof bytes.

The v2 reference profile requires an observed UTC process. Its matrix CLI starts
only its v2 children with `TZ=UTC`; the direct v2 API rejects missing or
mismatched `TZ`, resolved timezone, or current UTC offset before opening any
services. Each cell records all three observations and their timestamp. The
first local v2 attempt retained four passing TypeScript-source cells and four
failed Go-source cells whose history inherited the macOS `-08:00` offset. That
failed matrix remains unchanged; no offset conversion was added to the oracle.
Older profiles and native wallet execution receive no timezone changes.
