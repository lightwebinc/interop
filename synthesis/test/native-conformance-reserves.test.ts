import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { LockingScript, P2PKH, PrivateKey, ProtoWallet, PublicKey, Transaction, UnlockingScript } from '@bsv/sdk'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'
import { createFixtureWallet } from '../src/storage-sync/fixture-wallet.js'
import { EvidenceBundle } from '../src/wallet-lab/evidence.js'
import { conformanceReservePolicy, prepareConformanceReserves } from '../src/wallet-lab/native/conformance-reserves.js'
import { spendsOnlyDeclaredNativePayments, verifyBoundaryFundingRoot, verifyConformanceReserves, verifyReserveGraph } from '../src/wallet-lab/native/verify-conformance-reserves.js'
import { readNativeReserveStorage } from '../src/wallet-lab/native/conformance-reserve-storage.js'
import { runConformanceLifecycle } from '../src/wallet-lab/native/conformance-lifecycle.js'
import { verifyConformanceLifecycle } from '../src/wallet-lab/native/verify-conformance-lifecycle.js'

const root = path.resolve(import.meta.dirname, '../..')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-native-reserves-'))
fs.writeFileSync(path.join(directory, 'index.html'), '<title>Reserve fixture</title>')
const language = process.env.TPNIL_RESERVE_STORAGE === 'go' ? 'go' : 'typescript'
const services = new ControlledWalletServices({ webroot: directory, components: { storage: language }, ...(language === 'go' ? { go: { binary: path.join(root, 'out/itcve-go-storage-sync'), storageSyncPatch: true, terminalRejectionReceipts: true } } : {}) })
let wallet: Awaited<ReturnType<typeof createFixtureWallet>> | undefined
let report: any, lifecycle: any, binding: Parameters<typeof verifyConformanceReserves>[1]
let boundary: any, boundaryBinding: Parameters<typeof verifyBoundaryFundingRoot>[1]
beforeAll(async () => {
  const workerStartedAt = new Date().toISOString()
  await services.start(); await services.fundRemoteWalletFromTeranode('77'.repeat(32), fixture)
  wallet = await createFixtureWallet(services, '79'.repeat(32))
  const identity = (await wallet.getPublicKey({ identityKey: true })).publicKey
  const senderIdentityKey = (await new ProtoWallet(PrivateKey.fromHex('22'.repeat(32))).getPublicKey({ identityKey: true })).publicKey
  const derivationPrefix = Buffer.from('tpnil-wallet-lab').toString('base64'), derivationSuffix = Buffer.from('funding-001').toString('base64')
  const key = await wallet.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${derivationPrefix} ${derivationSuffix}`, counterparty: senderIdentityKey, forSelf: true })
  const initial = await services.payNativeWallet(key.publicKey, 10_000)
  await wallet.internalizeAction({ tx: initial.tx, outputs: [{ outputIndex: 0, protocol: 'wallet payment', paymentRemittance: { senderIdentityKey, derivationPrefix, derivationSuffix } }], description: 'Initial native fixture payment' })
  const evidence = new EvidenceBundle(directory)
  report = await prepareConformanceReserves({ wallet, services, evidence }); evidence.flush()
  report = JSON.parse(fs.readFileSync(path.join(directory, 'evidence/conformance/funding-reserves.json'), 'utf8'))
  const scenarioStartedAt = new Date().toISOString()
  const created = await wallet.createAction({ description: 'First customer operation after reserves', outputs: [{ lockingScript: '51', satoshis: 2, outputDescription: 'Customer fixture output' }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
  // These bytes originate in the separately authenticated read-only Storage RPC
  // snapshot, not in the submitted BEEF that the oracle must independently bind.
  const storageTransactions = new Map<string, Transaction>()
  for (const row of [...report.storageSnapshot.dataset.transactions, ...report.storageSnapshot.dataset.provenTxs, ...report.storageSnapshot.dataset.provenTxReqs]) {
    if (Array.isArray(row.rawTx) && row.rawTx.length) { const tx = Transaction.fromBinary(row.rawTx); expect(tx.id('hex')).toBe(row.txid); storageTransactions.set(row.txid, tx) }
  }
  const transactions = new Map<string, Transaction>()
  const add = (tx: Transaction) => { if (transactions.has(tx.id('hex'))) return; transactions.set(tx.id('hex'), tx); for (const input of tx.inputs) if (input.sourceTransaction) add(input.sourceTransaction) }
  add(Transaction.fromAtomicBEEF(initial.tx)); for (const payment of report.payments) add(Transaction.fromAtomicBEEF(payment.beef)); add(Transaction.fromAtomicBEEF(created.tx!))
  for (const [id, tx] of storageTransactions) if (!transactions.has(id)) transactions.set(id, tx)
  for (const tx of transactions.values()) for (const input of tx.inputs) if (!input.sourceTransaction) input.sourceTransaction = transactions.get(input.sourceTXID!)
  binding = { policy: conformanceReservePolicy, identity, initialFundingTxid: initial.txid, scenarioStartedAt, workerStartedAt,
    submissions: services.submissions.map(row => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') })), firstCustomerTxid: created.txid!, transactions, storageTransactions, fixture }
  services.enqueueVerdict('REJECTED')
  await expect(wallet.createAction({ description: 'Earlier independent rejection scenario', outputs: [{ lockingScript: '51', satoshis: 2, outputDescription: 'Earlier rejected output' }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })).rejects.toThrow()
  expect(services.submissions.at(-1)?.verdict).toBe('REJECTED')
  lifecycle = await runConformanceLifecycle(wallet, services, language === 'go' ? { receiptMode: 'storage-rpc' } : {})
  const funder = await createFixtureWallet(services, '77'.repeat(32))
  try {
    const senderIdentityKey = (await funder.getPublicKey({ identityKey: true })).publicKey
    const derivationPrefix = Buffer.from('tpnil boundary corpus').toString('base64'), derivationSuffix = Buffer.from('payment 1').toString('base64')
    const publicKey = (await funder.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${derivationPrefix} ${derivationSuffix}`, counterparty: identity })).publicKey
    const payment = await funder.createAction({ description: 'TPNIL boundary fixture payment', outputs: [{ satoshis: 1000, lockingScript: new P2PKH().lock(PublicKey.fromString(publicKey).toAddress()).toHex(), outputDescription: 'Boundary fixture wallet payment' }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
    const args = { tx: [...payment.tx!], outputs: [{ outputIndex: 0, protocol: 'wallet payment' as const, paymentRemittance: { senderIdentityKey, derivationPrefix, derivationSuffix } }], description: 'TPNIL boundary incoming payment' }
    const receipt = await wallet.internalizeAction(args)
    boundary = { trace: [{ method: 'getPublicKey', args: { identityKey: true }, result: { publicKey: identity } }, { method: 'internalizeAction', args, result: receipt }] }
    const metadata = await wallet.createAction({ description: 'Clause metadata after exact corpus payment', outputs: [2, 3, 4].map(satoshis => ({ satoshis, lockingScript: '51', outputDescription: 'Clause metadata fixture' })), options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
    const observed = await readNativeReserveStorage(wallet, services), captured = new Map<string, Transaction>()
    for (const row of [...observed.dataset.transactions, ...observed.dataset.provenTxs, ...observed.dataset.provenTxReqs]) if (Array.isArray(row.rawTx) && row.rawTx.length) captured.set(row.txid, Transaction.fromBinary(row.rawTx))
    boundaryBinding = { identity, fixture, metadataTxid: metadata.txid!, storageTransactions: captured, submissions: services.submissions.map(row => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') })) }
  } finally { await funder.destroy() }
  if (process.env.TPNIL_RESERVE_EVIDENCE) {
    fs.mkdirSync(process.env.TPNIL_RESERVE_EVIDENCE, { recursive: true })
    fs.writeFileSync(path.join(process.env.TPNIL_RESERVE_EVIDENCE, `${language}-reserve.json`), JSON.stringify({ report, initialBeef: initial.tx, customerBeef: created.tx, binding: { ...binding, transactions: [...transactions].map(([txid, tx]) => ({ txid, rawTxHex: tx.toHex() })), storageTransactions: [...storageTransactions].map(([txid, tx]) => ({ txid, rawTxHex: tx.toHex() })) } }, null, 2) + '\n')
    fs.writeFileSync(path.join(process.env.TPNIL_RESERVE_EVIDENCE, `${language}-lifecycle.json`), JSON.stringify(lifecycle, null, 2) + '\n')
    fs.writeFileSync(path.join(process.env.TPNIL_RESERVE_EVIDENCE, `${language}-boundary.json`), JSON.stringify({ boundary, binding: { ...boundaryBinding, storageTransactions: [...boundaryBinding.storageTransactions].map(([txid, tx]) => ({ txid, rawTxHex: tx.toHex() })) } }, null, 2) + '\n')
  }
}, 60_000)
afterAll(async () => { await wallet?.destroy(); await services.close(); fs.rmSync(directory, { recursive: true, force: true }) })

it('prepares two public BRC29 reserves against real storage and survives canonical evidence encoding', async () => {
  const verified = await verifyConformanceReserves(report, binding)
  expect(verified.verified).toBe(true); expect(verified.roots).toHaveLength(2)
  expect(spendsOnlyDeclaredNativePayments(binding.transactions.get(binding.firstCustomerTxid)!, [binding.initialFundingTxid, ...verified.roots].map(txid => `${txid}.0`))).toBe(true)
})
it('keeps unaffected initial funds available after two separate policy rejections without refilling', async () => {
  const verified = await verifyConformanceLifecycle(lifecycle)
  expect(verified.assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'PASS'])
})
it('rejects cross-identity, missing independent storage bytes, late preparation and rebound submissions', async () => {
  await expect(verifyConformanceReserves(report, { ...binding, identity: new PrivateKey(3).toPublicKey().toString() })).rejects.toThrow()
  const storageTransactions = new Map(binding.storageTransactions); storageTransactions.delete(report.payments[0].txid)
  await expect(verifyConformanceReserves(report, { ...binding, storageTransactions })).rejects.toThrow(/storage bytes/)
  await expect(verifyConformanceReserves(report, { ...binding, scenarioStartedAt: '2000-01-01T00:00:00.000Z' })).rejects.toThrow()
  const changed = structuredClone(report); changed.payments[0].submissionIndex = binding.submissions.length - 1
  await expect(verifyConformanceReserves(changed, binding)).rejects.toThrow()
})
it('admits only the exact later corpus BRC29 payment bound to identity, mined fixture, storage bytes and ordered submission', async () => {
  const outpoint = await verifyBoundaryFundingRoot(boundary, boundaryBinding)
  expect(outpoint).toMatch(/^[a-f0-9]{64}\.0$/)
  const storageTransactions = new Map(boundaryBinding.storageTransactions); storageTransactions.delete(outpoint!.slice(0, -2))
  await expect(verifyBoundaryFundingRoot(boundary, { ...boundaryBinding, storageTransactions })).rejects.toThrow()
  await expect(verifyBoundaryFundingRoot(boundary, { ...boundaryBinding, identity: new PrivateKey(3).toPublicKey().toString() })).rejects.toThrow()
  await expect(verifyBoundaryFundingRoot(boundary, { ...boundaryBinding, fixture: { ...fixture, txid: 'ab'.repeat(32) } })).rejects.toThrow(/exact mined/)
  const changed = structuredClone(boundary); changed.trace[1].args.outputs[0].paymentRemittance.derivationSuffix = Buffer.from('different').toString('base64')
  await expect(verifyBoundaryFundingRoot(changed, boundaryBinding)).rejects.toThrow()
  const submissions = structuredClone(boundaryBinding.submissions); submissions.find((row: any) => row.txid === outpoint!.slice(0, -2)).beefHex = '00'
  await expect(verifyBoundaryFundingRoot(boundary, { ...boundaryBinding, submissions })).rejects.toThrow()
})

const source = () => { const tx = new Transaction(); tx.addOutput({ lockingScript: LockingScript.fromHex('51'), satoshis: 100 }); return tx }
const spend = (parent: Transaction, vout: number, amount: number) => { const tx = new Transaction(); tx.addInput({ sourceTransaction: parent, sourceOutputIndex: vout, unlockingScript: UnlockingScript.fromHex('') }); tx.addOutput({ lockingScript: LockingScript.fromHex('51'), satoshis: amount }); return tx }
it('permits sequential faucet change descendants while detecting conflicting and duplicate input spends', () => {
  const parent = source(), payment = spend(parent, 0, 20); payment.addOutput({ lockingScript: LockingScript.fromHex('51'), satoshis: 79 })
  const later = spend(payment, 1, 20)
  expect(() => verifyReserveGraph([payment, later], [`${payment.id('hex')}.0`, `${later.id('hex')}.0`])).not.toThrow()
  const conflict = spend(payment, 1, 19)
  expect(() => verifyReserveGraph([payment, later, conflict], [])).toThrow(/Conflicting/)
  const duplicate = spend(payment, 1, 18); duplicate.addInput({ sourceTransaction: payment, sourceOutputIndex: 1, unlockingScript: UnlockingScript.fromHex('') })
  expect(() => verifyReserveGraph([duplicate], [])).toThrow(/duplicate/)
  expect(() => verifyReserveGraph([spend(payment, 0, 19)], [`${payment.id('hex')}.0`])).toThrow(/already consumed/)
})
it('requires every funding input branch to terminate at an exact declared native outpoint', () => {
  const parent = source(); parent.addOutput({ lockingScript: LockingScript.fromHex('51'), satoshis: 100 })
  const owned = spend(parent, 0, 99), extra = spend(parent, 1, 99), mixed = spend(owned, 0, 1)
  mixed.addInput({ sourceTransaction: extra, sourceOutputIndex: 0 })
  expect(spendsOnlyDeclaredNativePayments(owned, [`${parent.id('hex')}.0`])).toBe(true)
  expect(spendsOnlyDeclaredNativePayments(mixed, [`${parent.id('hex')}.0`])).toBe(false)
  expect(spendsOnlyDeclaredNativePayments(mixed, [`${parent.id('hex')}.0`, `${parent.id('hex')}.1`])).toBe(true)
})
