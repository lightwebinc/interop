# Certificate fixture key-width correction

This append-only engineering record follows failed Foundation attempt
[42663404897](../../integrated-component-attempts/2026-11-09/42663404897/README.md).
Its second TypeScript boundary repetition disclosed a 31-byte revelation key:
the external SDK 2.7.1 issuer had discarded a random leading zero. The strict
SDK 4.0.1 Identity Services decoder correctly rejected the invalid fixture.
The original artifact, three job logs, failure and 501 PASS / 9 FAIL observations
remain in that attempt archive; it received no qualification.

The corrected external issuer takes all 32 uniformly random bytes directly into
the field cipher and wrapped revelation key. It never retries a zero-prefix
key or biases the random distribution. Both boundary and prospective clause
fixtures use the shared helper. Native wallet source, runtime dependencies and
strict acceptance criteria are unchanged.

The deterministic regression supplies a 32-byte key beginning with zero, issues
a signed certificate, calls actual Toolbox 2.13 `acquireCertificate` against real
remote TypeScript storage, calls its public `proveCertificate`, and decrypts
the proof with SDK 4.0.1's strict decoder. The revealed key retains all 32 bytes;
only the requested name field is disclosed. A separate unit regression verifies
the signed field with independent Node AES-GCM and rejects invalid key lengths.

Fresh TypeScript and Go boundary runs each independently pass all 43 assertions,
including cleanup. Fresh clause reference runs retain 133 PASS / 98 FAIL /
1 BLOCKED apiece and explicitly decline full BRC100 conformance. These are
reference-wallet observations, not native wallet qualification. The boundary
runs use unbiased random keys; the fixed leading-zero input belongs to the
public-operation regression. All four runs retired their temporary services.

`summary.json` binds the exact source snapshot and compressed raw evidence.
`evidence.json.gz` contains 35 original UTF-8 files with individual sizes and
SHA-256 hashes: four runs, independent results, execution logs, final checks
and the changed source snapshot. It also retains the initial integration test's
prototype-sensitive comparison failure. That test received the correct field
contents in a null-prototype map; comparing exact entries resolves the test
assertion while preserving the strict cryptographic checks. Final checks pass
75 core tests, 133 synthesis tests (8 gated skips), 14 service tests, typecheck
and repository validation.

Reproduce with Node 24 and prepared pinned dependencies:

```sh
npm test --prefix synthesis -- certificate-fixture.test.ts
npm test --prefix integrations/services
node scripts/run-wallet-boundary.mjs out/new-boundary-ts typescript
node scripts/verify-wallet-boundary.mjs out/new-boundary-ts
node scripts/run-wallet-boundary.mjs out/new-boundary-go go
node scripts/verify-wallet-boundary.mjs out/new-boundary-go
node scripts/run-conformance-clauses-reference.mjs out/new-clauses-ts typescript
node scripts/run-conformance-clauses-reference.mjs out/new-clauses-go go
node scripts/verify-published-integrations.mjs --semantic
```

Use a fresh output directory for each execution. Local Mongo installations may
be selected with `TPNIL_MONGOD` and the matching `TPNIL_MONGO_VERSION`; preparation
and CI remain the normal source-pinned paths. No public deployment or native
qualification was performed by these engineering runs.
