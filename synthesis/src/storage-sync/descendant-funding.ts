import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Beef, MerklePath, PrivateKey, ProtoWallet, PushDrop, Transaction, Utils, type WalletInterface } from '@bsv/sdk'
import { StorageClient, type Wallet } from '@bsv/wallet-toolbox'
import { ControlledWalletServices } from '../wallet-lab/services.js'
import type { GoServiceOptions } from '../wallet-lab/go-services.js'
import { createFixtureWallet } from './fixture-wallet.js'
import { ObservedStorageClient, readDataset, type Implementation, type Transcript } from './run.js'
import type { Dataset } from './projection.js'
import { descendantProjectionV2Binding } from './descendant-profile.js'
import { storageProjectionV2Runtime } from './projection-profile.js'

const root = path.resolve(import.meta.dirname, '../../..')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const task = 'TPNIL descendant-funded replacement task'
const basket = 'tpnil descendant tasks'
const protocol = [2, 'tpnil descendant task'] as const
const tracker = { currentHeight: async () => fixture.fundingHeight + fixture.maturityDepth,
  isValidRootForHeight: async (root: string, height: number) => root === fixture.merkleRoot && height === fixture.fundingHeight }
const clean = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value))

/** Start empty: a separately captured task/funding BEEF must never fill an export
 * gap. Only the public dataset's transaction bytes and proofs enter this graph. */
export async function verifyDescendantDataset(dataset: Dataset, txid: string): Promise<{ txid: string; rawHex: string; beef: number[]; minedRoot: string }> {
  const beef = new Beef()
  for (const row of [...(dataset.transactions ?? []), ...(dataset.provenTxReqs ?? [])]) {
    if (Array.isArray(row.inputBEEF) && row.inputBEEF.length) beef.mergeBeef(row.inputBEEF as number[])
  }
  for (const row of [...(dataset.transactions ?? []), ...(dataset.provenTxReqs ?? [])]) {
    if (Array.isArray(row.rawTx) && row.rawTx.length) {
      assert.equal(Transaction.fromBinary(row.rawTx as number[]).id('hex'), row.txid)
      beef.mergeRawTx(row.rawTx as number[])
    }
  }
  for (const row of dataset.provenTxs ?? []) {
    assert.equal(row.height, fixture.fundingHeight); assert.equal(row.merkleRoot, fixture.merkleRoot); assert.equal(row.blockHash, fixture.fundingBlockHash)
    const proof = MerklePath.fromBinary(row.merklePath as number[])
    assert.equal(proof.computeRoot(String(row.txid)), fixture.merkleRoot)
    assert.equal(Transaction.fromBinary(row.rawTx as number[]).id('hex'), row.txid)
    beef.mergeRawTx(row.rawTx as number[], beef.mergeBump(proof))
  }
  const atomic = beef.toBinaryAtomic(txid), tx = Transaction.fromAtomicBEEF(atomic)
  assert.equal(tx.id('hex'), txid)
  assert.ok(await tx.verify(tracker), 'Dataset alone does not supply independently valid mined ancestry')
  const ancestry = (current: Transaction, depth = 0): boolean => {
    assert.ok(depth < 32)
    return current.id('hex') === fixture.txid || current.inputs.some(input => input.sourceTransaction !== undefined && ancestry(input.sourceTransaction, depth + 1))
  }
  assert.ok(ancestry(tx), 'Dataset ancestry does not terminate at the exact pinned funding root')
  return { txid, rawHex: tx.toHex(), beef: atomic, minedRoot: fixture.txid }
}

/** The mediator uses the same unadapted public StorageClient wire as the pinned
 * native wallet. Canonicalization is confined to separate read-only observers. */
class DirectObservedClient extends StorageClient {
  constructor(wallet: WalletInterface, endpoint: string, readonly provider: string, readonly transcript: Transcript[]) { super(wallet, endpoint) }
  protected override async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const row: Transcript = { provider: this.provider, method, request: clean(params) }; this.transcript.push(row)
    try { const response = await super.rpcCall<T>(method, params); row.response = clean(response); return response }
    catch (error) { row.error = String(error); throw error }
  }
}

export async function runDescendantFundingSync(options: {
  source: Implementation; destination: Implementation; output: string; go?: GoServiceOptions; typescriptDescendantExport?: boolean; ownerKeyHex?: string; exactHistory?: boolean
}): Promise<any> {
  const projectionRuntime = options.exactHistory ? storageProjectionV2Runtime() : undefined
  const projection = options.exactHistory ? descendantProjectionV2Binding() : undefined
  assert.ok(!fs.existsSync(options.output), 'Evidence output already exists')
  fs.mkdirSync(options.output, { recursive: true })
  const keyHex = options.ownerKeyHex ?? '79'.repeat(32)
  assert.match(keyHex, /^[0-9a-f]{64}$/)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-descendant-sync-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>Descendant funding sync regression</title>')
  const source = new ControlledWalletServices({ webroot: directory, components: { storage: options.source }, walletStorageRootKeyHex: '11'.repeat(32), go: options.go, typescriptDescendantExport: options.typescriptDescendantExport })
  const destination = new ControlledWalletServices({ webroot: directory, components: { storage: options.destination }, walletStorageRootKeyHex: '12'.repeat(32), go: options.go, typescriptDescendantExport: options.typescriptDescendantExport })
  const transcript: Transcript[] = [], walletCalls: any[] = []
  const report: any = { schema: options.exactHistory ? 'tpnil-descendant-storage-sync@2' : 'tpnil-descendant-storage-sync@1', ...(options.exactHistory ? { projection, projectionRuntime } : {}), claim: 'ENGINEERING_OBSERVATION_ONLY', startedAt: new Date().toISOString(), configuration: { source: options.source, destination: options.destination }, fixture, task, basket, mediator: 'unadapted upstream StorageClient with actual WalletStorageManager.syncToWriter', transcript, walletCalls, datasetReads: {}, assertions: [], cleanup: {} }
  const check = (id: string, passed: boolean, detail: string) => report.assertions.push({ id, result: passed ? 'PASS' : 'FAIL', detail })
  let wallet: Wallet | undefined, fresh: Wallet | undefined, foreign: Wallet | undefined, unavailable = false
  const call = async (client: Wallet, stage: string, method: string, args: any) => {
    const row: any = { stage, method, args: clean(args), startedAt: new Date().toISOString() }; walletCalls.push(row)
    try { const value = await (client as any)[method](args); row.result = clean(value); return value }
    catch (error) { row.error = String(error); throw error } finally { row.endedAt = new Date().toISOString() }
  }
  const dataset = async (name: string, client: StorageClient) => {
    const start = transcript.length
    const result = await readDataset(client, report.identity)
    report.datasetReads[name] = { start, end: transcript.length }
    return result
  }
  try {
    await source.start(); await destination.start()
    report.faucetFunding = await source.fundRemoteWalletFromTeranode('77'.repeat(32), fixture)
    // Header admission carries no transaction, output, raw bytes or merkle path
    // into destination storage. All storage ancestry must arrive via sync.
    for (const header of source.headers.values()) destination.registerHeader(header)
    wallet = await createFixtureWallet(source, keyHex, (wallet, endpoint) => new DirectObservedClient(wallet, endpoint, 'source-active', transcript))
    report.identity = (await call(wallet, 'source', 'getPublicKey', { identityKey: true })).publicKey
    assert.notEqual(report.identity, PrivateKey.fromHex('77'.repeat(32)).toPublicKey().toString())
    const senderIdentityKey = (await new ProtoWallet(PrivateKey.fromHex('22'.repeat(32))).getPublicKey({ identityKey: true })).publicKey
    const derivationPrefix = Buffer.from('tpnil-descendant-sync').toString('base64'), derivationSuffix = Buffer.from('owner-payment').toString('base64')
    const publicKey = (await call(wallet, 'source', 'getPublicKey', { protocolID: [2, '3241645161d8'], keyID: `${derivationPrefix} ${derivationSuffix}`, counterparty: senderIdentityKey, forSelf: true })).publicKey
    report.payment = await source.payNativeWallet(publicKey, 30_000)
    report.internalized = await call(wallet, 'source', 'internalizeAction', { tx: report.payment.tx, outputs: [{ outputIndex: 0, protocol: 'wallet payment', paymentRemittance: { senderIdentityKey, derivationPrefix, derivationSuffix } }], description: 'Descendant funding with an independently owned mined ancestor' })
    check('descendant-only-owner', report.internalized.accepted === true && report.payment.txid !== fixture.txid, 'The subject receives a descendant public BRC29 payment, never the faucet-owned mined root.')
    const ciphertext = (await call(wallet, 'source', 'encrypt', { plaintext: Utils.toArray(task, 'utf8'), protocolID: protocol, keyID: 'task', counterparty: 'self' })).ciphertext
    const script = await new PushDrop(wallet).lock([Utils.toArray('tpnil descendant task', 'utf8'), ciphertext], [...protocol], 'task', 'self', true, true)
    const created = await call(wallet, 'source', 'createAction', { description: 'Descendant-funded portable task creation', outputs: [{ satoshis: 3, lockingScript: script.toHex(), basket, tags: ['descendant', 'encrypted'], customInstructions: 'tpnil:descendant:1', outputDescription: task }], labels: ['tpnil-descendant-sync'], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
    assert.ok(created.txid && created.tx)
    report.outpoint = `${created.txid}.0`; report.taskTxid = created.txid; report.ciphertext = ciphertext
    assert.ok(await Transaction.fromAtomicBEEF(created.tx).verify(tracker))
    const reader = new ObservedStorageClient(wallet, source.storageUrl, 'source-observer', transcript, options.source)
    const targetReader = new ObservedStorageClient(wallet, destination.storageUrl, 'destination-observer', transcript, options.destination)
    const writer = new DirectObservedClient(wallet, destination.storageUrl, 'destination-mediator', transcript)
    await writer.makeAvailable(); await writer.findOrInsertUser(report.identity)
    report.destinationBefore = await dataset('destinationBefore', targetReader)
    check('empty-replacement', ['transactions', 'outputs', 'provenTxs', 'provenTxReqs'].every(name => (report.destinationBefore[name] ?? []).length === 0), 'The replacement has no seeded transaction or proof rows before synchronization.')
    report.sourceDataset = await dataset('sourceDataset', reader)
    const names = ['provenTx', 'outputBasket', 'outputTag', 'txLabel', 'transaction', 'output', 'txLabelMap', 'outputTagMap', 'certificate', 'certificateField', 'commission', 'provenTxReq']
    const settings = await reader.makeAvailable()
    const pageArgs: any = { identityKey: report.identity, fromStorageIdentityKey: settings.storageIdentityKey, toStorageIdentityKey: settings.storageIdentityKey,
      maxItems: 1, maxRoughSize: 1, offsets: names.map(name => ({ name, offset: name === 'provenTxReq' ? 0 : (report.sourceDataset[`${name}s`] ?? []).length })) }
    report.proofPages = []
    for (let page = 0; page <= report.sourceDataset.provenTxReqs.length; page++) {
      const observed = await reader.getSyncChunk(pageArgs)
      report.proofPages.push({ args: clean(pageArgs), response: clean(observed) })
      const rows = observed.provenTxReqs ?? []
      assert.ok(rows.length <= 1, 'Tiny item/rough-size budget returned multiple proof-expanded rows')
      pageArgs.offsets.find((row: any) => row.name === 'provenTxReq').offset += rows.length
      if (rows.length === 0) break
    }
    const pagedIds = report.proofPages.flatMap((page: any) => (page.response.provenTxReqs ?? []).map((row: any) => row.txid))
    check('proof-expansion-pagination', JSON.stringify(pagedIds) === JSON.stringify(report.sourceDataset.provenTxReqs.map((row: any) => row.txid)) && report.proofPages.at(-1).response.provenTxReqs?.length === 0, 'One-item/one-byte rough budgets preserve source order and offsets; a final oversized row follows the upstream rough-budget convention, then the terminal page is empty.')
    foreign = await createFixtureWallet(source, '88'.repeat(32))
    report.foreignIdentity = (await foreign.getPublicKey({ identityKey: true })).publicKey
    const foreignReader = new ObservedStorageClient(foreign, source.storageUrl, 'foreign-observer', transcript, options.source)
    try { await readDataset(foreignReader, report.identity); report.foreignDenied = false }
    catch (error) { report.foreignError = String(error); report.foreignDenied = /(?:UNAUTHORIZED|unauthorized|identityKey does not match authentication)/.test(report.foreignError) && !/(?:500|fetch failed|timeout)/i.test(report.foreignError) }
    check('owner-scoped-export', report.foreignDenied === true && report.sourceDataset.transactions.every((row: any) => row.userId === report.sourceDataset.user.userId) && report.sourceDataset.outputs.every((row: any) => row.userId === report.sourceDataset.user.userId) && report.sourceDataset.txLabels.every((row: any) => !['tpnil-fixture', 'wab-faucet', 'teranode-mined'].includes(row.label)), 'Foreign authentication cannot export the subject; ancestor enrichment adds public proof bytes without the faucet account’s private transaction/output/label records.')
    try { report.sourceClosure = await verifyDescendantDataset(report.sourceDataset, created.txid) }
    catch (error) { report.sourceClosureError = String(error) }
    check('source-export-proof-closure', Boolean(report.sourceClosure), 'An empty graph reconstructed solely from exported raw transactions and inputBEEF must verify against the pinned mined root; a failed check remains FAIL while later public diagnostics continue.')
    report.sync = await wallet.storage.syncToWriter(await wallet.storage.getAuth(), writer)
    report.destinationDataset = await dataset('destinationDataset', targetReader)
    try { report.destinationClosure = await verifyDescendantDataset(report.destinationDataset, created.txid) }
    catch (error) { report.destinationClosureError = String(error) }
    check('destination-export-proof-closure', report.destinationClosure?.rawHex === Transaction.fromAtomicBEEF(created.tx).toHex(), 'The replacement public dataset independently reconstructs the exact task with complete signed ancestry.')
    await wallet.storage.addWalletStorageProvider(writer); await wallet.storage.setActive(writer.getSettings().storageIdentityKey)
    await foreign.destroy(); foreign = undefined
    await wallet.destroy(); wallet = undefined; report.originalClientRetiredAt = new Date().toISOString()
    await source.setStorageEndpointAvailable(false); unavailable = true
    report.sourceUnavailableAt = new Date().toISOString()
    try { await fetch(source.storageUrl, { signal: AbortSignal.timeout(1000) }); report.sourceReachable = true } catch (error) { report.sourceReachable = false; report.sourceUnavailableError = String(error); report.sourceUnavailableCause = String((error as any)?.cause) }
    check('source-offline', report.sourceReachable === false, 'Source storage listener is stopped before the original wallet is replaced.')
    fresh = await createFixtureWallet(destination, keyHex, (wallet, endpoint) => new DirectObservedClient(wallet, endpoint, 'replacement-fresh', transcript))
    report.freshClientCreatedAt = new Date().toISOString()
    report.coldIdentity = (await call(fresh, 'replacement', 'getPublicKey', { identityKey: true })).publicKey
    assert.equal(report.coldIdentity, report.identity)
    report.recovered = await call(fresh, 'replacement', 'listOutputs', { basket, include: 'entire transactions', includeCustomInstructions: true, includeTags: true, includeLabels: true })
    const row = report.recovered.outputs.find((output: any) => output.outpoint === report.outpoint)
    assert.ok(row?.spendable)
    const recoveredTask = Transaction.fromAtomicBEEF(Beef.fromBinary(report.recovered.BEEF).toBinaryAtomic(created.txid))
    assert.equal(recoveredTask.toHex(), Transaction.fromAtomicBEEF(created.tx).toHex()); assert.ok(await recoveredTask.verify(tracker))
    const token = PushDrop.decode(recoveredTask.outputs[0]!.lockingScript)
    assert.equal(Utils.toUTF8(token.fields[0]!), 'tpnil descendant task')
    report.decrypted = await call(fresh, 'replacement', 'decrypt', { ciphertext: token.fields[1], protocolID: protocol, keyID: 'task', counterparty: 'self' })
    check('cold-list-and-decrypt', Utils.toUTF8(report.decrypted.plaintext) === task, 'A freshly constructed same-identity wallet reads full BEEF and decrypts the exact task from the replacement while source storage is unavailable.')
    const pending = await call(fresh, 'replacement', 'createAction', { description: 'Replacement redeems descendant-funded task', inputBEEF: report.recovered.BEEF, inputs: [{ outpoint: report.outpoint, unlockingScriptLength: 74, inputDescription: 'Descendant-funded portable token' }], options: { signAndProcess: false, randomizeOutputs: false, acceptDelayedBroadcast: false } })
    assert.ok(pending.signableTransaction)
    const redemption = Transaction.fromAtomicBEEF(pending.signableTransaction.tx)
    const inputIndex = redemption.inputs.findIndex(input => input.sourceTXID === created.txid && input.sourceOutputIndex === 0)
    assert.ok(inputIndex >= 0)
    redemption.inputs[inputIndex]!.sourceTransaction ??= recoveredTask
    const unlockingScript = await new PushDrop(fresh).unlock([...protocol], 'task', 'self').sign(redemption, inputIndex)
    report.redeemed = await call(fresh, 'replacement', 'signAction', { reference: pending.signableTransaction.reference, spends: { [inputIndex]: { unlockingScript: unlockingScript.toHex() } }, options: { acceptDelayedBroadcast: false } })
    assert.ok(report.redeemed.txid)
    report.after = await call(fresh, 'replacement', 'listOutputs', { basket, include: 'entire transactions' })
    const afterReader = new ObservedStorageClient(fresh, destination.storageUrl, 'replacement-after-observer', transcript, options.destination)
    report.destinationAfter = await dataset('destinationAfter', afterReader)
    report.redemptionClosure = await verifyDescendantDataset(report.destinationAfter, report.redeemed.txid)
    const redeemedTx = Transaction.fromAtomicBEEF(report.redemptionClosure.beef)
    check('cold-redemption', report.after.outputs.every((output: any) => output.outpoint !== report.outpoint) && redeemedTx.inputs.some(input => input.sourceTXID === created.txid && input.sourceOutputIndex === 0), 'The replacement signs, submits and stores an actual spend of the task; its complete ancestry verifies without the source.')
  } catch (error) {
    report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : { message: String(error) }
    check('execution', false, report.error.message)
  } finally {
    const errors: string[] = []
    for (const client of [fresh, wallet, foreign]) { try { await client?.destroy() } catch (error) { errors.push(String(error)) } }
    if (unavailable) { try { await source.setStorageEndpointAvailable(true); report.cleanup.sourceRestored = true; report.cleanup.sourceRestoredAt = new Date().toISOString() } catch (error) { errors.push(String(error)) } }
    report.components = { source: source.componentIdentity, destination: destination.componentIdentity }
    report.serviceDiagnostics = { source: source.componentDiagnostics, destination: destination.componentDiagnostics }
    report.submissions = { source: source.submissions.map(row => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') })), destination: destination.submissions.map(row => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') })) }
    for (const service of [destination, source]) { try { await service.close() } catch (error) { errors.push(String(error)) } }
    fs.rmSync(directory, { recursive: true, force: true }); report.cleanup.errors = errors
    check('cleanup', errors.length === 0, 'Wallet clients, isolated services and temporary state are retired.')
  }
  for (const id of ['descendant-only-owner', 'empty-replacement', 'proof-expansion-pagination', 'owner-scoped-export', 'source-export-proof-closure', 'destination-export-proof-closure', 'source-offline', 'cold-list-and-decrypt', 'cold-redemption']) {
    if (!report.assertions.some((row: any) => row.id === id)) report.assertions.push({ id, result: 'BLOCKED', detail: 'A preceding failure prevented this observation.' })
  }
  report.result = report.assertions.every((row: any) => row.result === 'PASS') ? 'PASS' : 'FAIL'; report.endedAt = new Date().toISOString()
  fs.writeFileSync(path.join(options.output, 'observations.json'), JSON.stringify(clean(report), null, 2) + '\n')
  return clean(report)
}
