/** Exact prospective engineering matrix source inventory. Replay rejects an
 * omitted source/lock rather than accepting a smaller caller-selected list. */
export const descendantInputs = [
  'fixtures/teranode/wab-funding-v1.json',
  'synthesis/src/storage-sync/descendant-inputs.ts',
  'synthesis/src/storage-sync/descendant-export.ts',
  'synthesis/src/storage-sync/descendant-funding.ts',
  'synthesis/src/storage-sync/verify-descendant.ts',
  'synthesis/src/storage-sync/fixture-wallet.ts',
  'synthesis/src/storage-sync/run.ts',
  'synthesis/src/storage-sync/compatibility.ts',
  'synthesis/src/storage-sync/projection.ts',
  'synthesis/src/determinism.ts',
  'synthesis/src/wallet-lab/services.ts',
  'synthesis/src/wallet-lab/go-services.ts',
  'synthesis/src/wallet-lab/submission-verdicts.ts',
  'synthesis/package.json',
  'synthesis/package-lock.json',
  'synthesis/go/components.lock.json',
  'synthesis/go/go.mod',
  'synthesis/go/go.sum',
  'synthesis/go/cmd/itcve-services/main.go',
  'synthesis/go/cmd/itcve-services/sync.go',
  'infra/adapters/storage-sync/patch.lock.json',
  'infra/adapters/storage-sync/go-wallet-toolbox-v0.191.4.patch',
  'infra/adapters/storage-portability/typescript-descendant-export.json',
  'infra/adapters/storage-portability/patch.lock.json',
  'infra/adapters/storage-portability/go-wallet-toolbox-v0.191.4.patch',
  'scripts/prepare-storage-portability-go.mjs',
  'scripts/run-descendant-storage-sync.mjs',
  'scripts/run-descendant-storage-matrix.mjs',
  'scripts/verify-descendant-storage-matrix.mjs'
] as const

/** V1's admitted inventory stays fixed; v2 adds its complete policy closure. */
export const descendantV2Inputs = [...descendantInputs,
  'synthesis/src/storage-sync/history-projection.ts',
  'synthesis/src/storage-sync/projection-profile.ts',
  'synthesis/src/storage-sync/descendant-profile.ts',
  'programs/ISI-3/profiles/storage-http-sync-2.0.0/profile.json',
  'programs/ISI-3/profiles/descendant-storage-2.0.0/profile.json'
] as const
