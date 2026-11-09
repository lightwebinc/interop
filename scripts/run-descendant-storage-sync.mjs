import path from 'node:path'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { runDescendantFundingSync } = await import('../synthesis/src/storage-sync/descendant-funding.ts')
const [source, destination, output, ...flags] = process.argv.slice(2)
if (![source, destination].every(value => ['typescript', 'go'].includes(value)) || !output || flags.some(value => value !== '--exact-history') || flags.length > 1) throw new Error('Usage: run-descendant-storage-sync.mjs typescript|go typescript|go NEW_OUTPUT [--exact-history]')
const exactHistory = flags.includes('--exact-history')
if (exactHistory) process.env.TZ = 'UTC'
const portability = process.env.TPNIL_DESCENDANT_PORTABILITY_PATCH === '1'
const report = await runDescendantFundingSync({ source, destination, output: path.resolve(output), exactHistory, ownerKeyHex: process.env.TPNIL_DESCENDANT_OWNER_KEY, typescriptDescendantExport: process.env.TPNIL_DESCENDANT_TS_ADAPTER === '1', go: {
  binary: path.resolve(process.env.TPNIL_DESCENDANT_GO_BINARY ?? `out/itcve-go-storage-${portability ? 'portability' : 'sync'}`),
  ...(portability ? { storagePortabilityPatch: true } : { storageSyncPatch: true }), terminalRejectionReceipts: true
} })
console.log(JSON.stringify({ result: report.result, assertions: report.assertions, error: report.error, components: report.configuration, cleanup: report.cleanup }, null, 2))
if (report.result !== 'PASS') process.exitCode = 1
