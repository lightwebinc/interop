import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { Transaction } = await import('../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js')
const { verifyConformanceReserves, verifyBoundaryFundingRoot, spendsOnlyDeclaredNativePayments } = await import('../synthesis/src/wallet-lab/native/verify-conformance-reserves.ts')
const { verifyConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts')
const root = path.resolve(import.meta.dirname, '..'), directory = path.resolve(process.argv[2] ?? path.join(root, 'journals/native-funding-reserve-reference/2026-11-09'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'))), bytes = fs.readFileSync(path.join(directory, summary.archive.path))
assert.equal(summary.claim, 'ENGINEERING_OBSERVATION_ONLY'); assert.equal(bytes.length, summary.archive.size); assert.equal(sha(bytes), summary.archive.sha256)
const archive = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })), files = new Map()
for (const file of archive.files) { assert(!files.has(file.path)); const bytes = Buffer.from(file.content); assert.equal(bytes.length, file.size); assert.equal(sha(bytes), file.sha256); files.set(file.path, file.content) }
assert.equal(files.size, summary.archive.files)
const read = name => JSON.parse(files.get(name)), fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/teranode/wab-funding-v1.json'))), results = []
const tracker = { currentHeight: async () => fixture.fundingHeight + fixture.maturityDepth, isValidRootForHeight: async (root, height) => root === fixture.merkleRoot && height === fixture.fundingHeight }
for (const language of ['typescript', 'go']) {
  const observed = read(`reference/${language}-reserve.json`), lifecycle = read(`reference/${language}-lifecycle.json`), boundary = read(`reference/${language}-boundary.json`)
  assert.deepEqual(observed.binding.fixture, fixture)
  const transactions = new Map(), storageTransactions = new Map(observed.binding.storageTransactions.map(row => [row.txid, Transaction.fromHex(row.rawTxHex)]))
  const add = tx => { const id = tx.id('hex'); if (transactions.has(id)) { assert.equal(transactions.get(id).toHex(), tx.toHex()); if (tx.merklePath) transactions.get(id).merklePath = tx.merklePath; return } transactions.set(id, tx); for (const input of tx.inputs) if (input.sourceTransaction) add(input.sourceTransaction) }
  for (const beef of [observed.initialBeef, observed.customerBeef, ...observed.report.payments.map(row => row.beef), ...lifecycle.transactions.map(row => row.beef)]) add(Transaction.fromAtomicBEEF(beef))
  for (const row of observed.binding.transactions) if (!transactions.has(row.txid)) add(Transaction.fromHex(row.rawTxHex))
  for (const row of boundary.binding.submissions) { const bytes = [...Buffer.from(row.beefHex, 'hex')]; let tx; try { tx = Transaction.fromAtomicBEEF(bytes) } catch { tx = Transaction.fromBinary(bytes) } assert.equal(tx.id('hex'), row.txid); add(tx) }
  for (const tx of transactions.values()) for (const input of tx.inputs) if (!input.sourceTransaction) input.sourceTransaction = transactions.get(input.sourceTXID)
  const reserves = await verifyConformanceReserves(observed.report, { ...observed.binding, transactions, storageTransactions })
  const verifiedLifecycle = await verifyConformanceLifecycle(lifecycle); assert.equal(verifiedLifecycle.result, 'PASS')
  const verifiedBoundary = await verifyBoundaryFundingRoot(boundary.boundary, { ...boundary.binding, storageTransactions: new Map(boundary.binding.storageTransactions.map(row => [row.txid, Transaction.fromHex(row.rawTxHex)])) })
  assert(verifiedBoundary)
  const rejected = boundary.binding.submissions.filter(row => row.verdict === 'REJECTED'); assert.equal(rejected.length, 2)
  const roots = [observed.binding.initialFundingTxid, ...reserves.roots].map(txid => `${txid}.0`)
  for (const row of [...rejected, ...lifecycle.transactions]) { const tx = transactions.get(row.txid); assert(tx); assert(await tx.verify(tracker)); assert(spendsOnlyDeclaredNativePayments(tx, roots), 'A post-setup refill funded the rejection/recovery exercise') }
  results.push({ storage: language, reserves: reserves.roots.length, independentlyVerifiedPolicyRejections: rejected.length, lifecycle: verifiedLifecycle.assertions, boundaryPaymentVerified: true })
}
const native = []
for (const repetition of [1, 2]) { const verified = await verifyConformanceLifecycle(read(`native-42667035861/repetition-${repetition}-lifecycle.json`)); assert.deepEqual(verified.assertions.map(row => row.result), ['PASS', 'PASS', 'FAIL']); native.push({ repetition, result: verified.result, assertions: verified.assertions }) }
console.log(JSON.stringify({ verified: true, claim: 'ENGINEERING_OBSERVATION_ONLY', files: files.size, references: results, preservedNativeFailures: native }, null, 2))
