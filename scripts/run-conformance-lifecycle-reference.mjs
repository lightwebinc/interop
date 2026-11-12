import fs from 'node:fs'
import path from 'node:path'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
import { createHash } from 'node:crypto'
const root = path.resolve(import.meta.dirname, '..')
register()
const { ControlledWalletServices } = await import('../synthesis/src/wallet-lab/services.ts')
const { createFixtureWallet } = await import('../synthesis/src/storage-sync/fixture-wallet.ts')
const { runConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/conformance-lifecycle.ts')
const { verifyConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts')
const language = process.argv[2], output = path.resolve(process.argv[3] ?? '')
if (!['typescript', 'go'].includes(language) || !process.argv[3] || fs.existsSync(output)) throw new Error('Usage: node scripts/run-conformance-lifecycle-reference.mjs typescript|go NEW_OUTPUT')
fs.mkdirSync(output, { recursive: true })
const binary = path.resolve(process.env.TPNIL_LIFECYCLE_GO_BINARY ?? path.join(root, 'out/itcve-go-lifecycle'))
const services = new ControlledWalletServices({ webroot: output, components: { storage: language }, ...(language === 'go' ? { go: { binary, storageSyncPatch: process.env.TPNIL_LIFECYCLE_STORAGE_SYNC_PATCH === '1', terminalRejectionReceipts: process.env.TPNIL_LIFECYCLE_LEGACY_RECEIPTS !== '1' } } : {}) })
let wallet
const result = { schema: 'tpnil-lifecycle-reference-attempt@1', claim: 'ENGINEERING_OBSERVATION_ONLY', storage: language, ...(language === 'go' ? { binarySha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex') } : {}), cleanup: false }
try {
  await services.start()
  const funding = await services.fundRemoteWalletFromTeranode('77'.repeat(32), JSON.parse(fs.readFileSync(path.join(root, 'fixtures/teranode/wab-funding-v1.json'))))
  fs.writeFileSync(path.join(output, 'funding.json'), JSON.stringify(funding, null, 2) + '\n')
  wallet = await createFixtureWallet(services, '77'.repeat(32))
  const stripErrors = process.env.TPNIL_LIFECYCLE_MESSAGE_ONLY_ERRORS === '1'
  if (stripErrors) result.errorTransport = 'message-only-reference-facade'
  const observedWallet = stripErrors ? new Proxy(wallet, { get: (target, method) => typeof target[method] !== 'function' ? target[method] : async (...args) => {
    try { return await target[method](...args) } catch (error) { throw new Error(error.message) }
  } }) : wallet
  const report = await runConformanceLifecycle(observedWallet, services, {
    ...(process.env.TPNIL_LIFECYCLE_STORAGE_RECEIPTS === '1' ? { receiptMode: 'storage-rpc' } : {}),
    ...(process.env.TPNIL_LIFECYCLE_ORACLE ? { oracle: process.env.TPNIL_LIFECYCLE_ORACLE } : {})
  })
  fs.writeFileSync(path.join(output, 'lifecycle.json'), JSON.stringify(report, null, 2) + '\n')
  result.verification = await verifyConformanceLifecycle(report)
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(result.verification, null, 2) + '\n')
  if (report.result !== 'PASS') process.exitCode = 1
} catch (error) { result.error = { name: error.name, message: error.message, stack: error.stack }; process.exitCode = 1 }
finally {
  await wallet?.destroy()
  await services.close()
  result.cleanup = true
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
}
