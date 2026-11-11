# Native Message Box verifier dependency preparation

This engineering preflight corrects the missing dependency setup observed in [retained-evidence CI attempt 42720214271](../../../integrated-native-attempts/2026-11-09/42720214271/README.md). It makes no new native qualification claim. The original failed workflow and original Rust observations remain unchanged.

The new explicit `node scripts/prepare-messaging.mjs --native-verifier-only` path fetches the exact pinned TypeScript Message Box archive and runs its locked `npm ci --ignore-scripts --no-audit --no-fund`. It uses `out/messaging-native-verifier`; the historical full-service preparation path remains `out/messaging-sources`. The verifier-only path prepares neither Go, discovery nor the SQLite native addon and emits a distinct source/archive/package-lock/installed-SDK receipt. Unknown or repeated flags fail. Full-build manifests and full-service path maps in the verifier cache are rejected before mutation.

The cache was absent before this run. Both original native9 Message Box evidence sets replayed with the unchanged c338a93 verifier: six assertions each passed. The existing full-service path/build receipts retained their original hashes. The isolated verifier cache contains no SQLite native addon or Go binary. All 111 core tests and repository checks passed. No wallet, service or transaction was executed during replay.

`evidence.zip` retains exact preparation source, npm output, dependency receipt, before/after preservation evidence, both replay receipts and checks. `index.json` binds every member. The source is explicitly dirty engineering source with exact per-file hashes; CI qualification requires its own committed-source run.

Reproduce dependency preparation with Node 24.22.1 and export `TPNIL_MESSAGING_PATHS="$PWD/out/messaging-native-verifier/paths.json"` before invoking the retained native verifier or reevaluation workflow. The frozen verifier resolves the SDK relative to this path. The preparation stdout includes the complete dependency receipt, so original CI logs retain it even if later replay fails.
