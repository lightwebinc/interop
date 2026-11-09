import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Beef, P2PKH, PublicKey, PrivateKey, ProtoWallet, PushDrop, Transaction, Utils } from '@bsv/sdk'
import { canonicalJson } from '../determinism.js'
import { canonicalSyncChunk } from './compatibility.js'
import { entities, projectDataset, type Dataset } from './projection.js'
import { verifyDescendantDataset } from './descendant-funding.js'

export const descendantAssertions = ['descendant-only-owner', 'empty-replacement', 'proof-expansion-pagination', 'owner-scoped-export', 'source-export-proof-closure', 'destination-export-proof-closure', 'source-offline', 'cold-list-and-decrypt', 'cold-redemption', 'cleanup'] as const
const equal = (a: unknown, b: unknown, detail = 'Retained evidence differs') => assert.ok(canonicalJson(a) === canonicalJson(b), detail)
const timestamp = (value: string) => { const result = Date.parse(value); assert.ok(Number.isFinite(result)); return result }

function publicClientRepresentation(input: any): any {
  const chunk = structuredClone(input)
  for (const row of [chunk.user, ...entities.flatMap(name => chunk[name] ?? [])]) {
    if (!row) continue
    for (const key of Object.keys(row)) if (row[key] === null) delete row[key]
    for (const field of ['created_at', 'updated_at']) if (row[field] !== undefined && row[field] !== null) row[field] = new Date(row[field]).toISOString()
    for (const field of ['rawTx', 'inputBEEF', 'lockingScript', 'merklePath']) {
      const value = row[field]
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        assert.ok(typeof value === 'object')
        const keys = Object.keys(value)
        assert.ok(keys.every((key, i) => key === String(i)), 'Invalid byte-array wire keys')
        const bytes = keys.map(key => value[key])
        assert.ok(bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255))
        row[field] = bytes
      }
    }
  }
  return chunk
}

/** Independently reconstruct each observer dataset from its retained public RPC
 * pages. The only wire normalization is the pre-existing documented bool/alias
 * conversion; transaction, ancestry, labels and other bytes remain intact. */
function readRetainedDataset(report: any, name: string, provider: string, implementation: 'go' | 'typescript'): Dataset {
  const range = report.datasetReads[name]
  assert.ok(Number.isSafeInteger(range.start) && range.start >= 0 && range.end > range.start && range.end <= report.transcript.length)
  const dataset: Dataset = Object.fromEntries(entities.map(name => [name, []]))
  const rows = report.transcript.slice(range.start, range.end)
  assert.ok(rows.every((row: any) => row.provider === provider && !row.error))
  const pages = rows.filter((row: any) => row.method === 'getSyncChunk')
  assert.ok(pages.length >= 2)
  for (const [index, row] of pages.entries()) {
    const args = row.request[0], raw: any = canonicalSyncChunk(row.response, implementation)
    equal(raw, row.canonicalResponse)
    const chunk = publicClientRepresentation(raw)
    assert.equal(args.identityKey, report.identity); assert.equal(chunk.userIdentityKey, report.identity)
    assert.equal(chunk.fromStorageIdentityKey, args.fromStorageIdentityKey)
    assert.equal(chunk.toStorageIdentityKey, args.toStorageIdentityKey)
    assert.equal(chunk.user.identityKey, report.identity)
    dataset.user = chunk.user
    for (const name of entities) {
      assert.equal(args.offsets.find((offset: any) => offset.name === name.slice(0, -1)).offset, dataset[name]!.length)
      assert.ok(Array.isArray(chunk[name]))
      if (index === pages.length - 1) assert.equal(chunk[name].length, 0)
      dataset[name]!.push(...chunk[name])
    }
  }
  equal(dataset, report[name], `${name} differs from public RPC pages`)
  return dataset
}

/** Go JSON encodes the same history instant without redundant fractional zeros.
 * Normalize ONLY history.notes[].when; no other array/order/metadata is ignored. */
function portableProjection(dataset: Dataset): unknown {
  const projected = projectDataset(dataset) as any
  for (const row of projected.provenTxReqs) for (const note of row.history?.notes ?? []) {
    if (note.when !== undefined) note.when = new Date(timestamp(note.when)).toISOString()
  }
  return projected
}

export async function verifyDescendantFundingReport(report: any): Promise<any> {
  assert.equal(report.schema, 'tpnil-descendant-storage-sync@1')
  equal(report.fixture, JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../fixtures/teranode/wab-funding-v1.json'), 'utf8')))
  assert.equal(report.task, 'TPNIL descendant-funded replacement task')
  assert.equal(report.basket, 'tpnil descendant tasks')
  assert.equal(report.claim, 'ENGINEERING_OBSERVATION_ONLY')
  assert.equal(report.mediator, 'unadapted upstream StorageClient with actual WalletStorageManager.syncToWriter')
  assert.equal(report.result, 'PASS'); assert.equal(report.error, undefined)
  equal(report.assertions.map((row: any) => row.id).sort(), [...descendantAssertions].sort())
  assert.ok(report.assertions.every((row: any) => row.result === 'PASS'))
  const source = readRetainedDataset(report, 'sourceDataset', 'source-observer', report.configuration.source)
  const destinationBefore = readRetainedDataset(report, 'destinationBefore', 'destination-observer', report.configuration.destination)
  const destination = readRetainedDataset(report, 'destinationDataset', 'destination-observer', report.configuration.destination)
  const after = readRetainedDataset(report, 'destinationAfter', 'replacement-after-observer', report.configuration.destination)
  for (const name of ['transactions', 'outputs', 'provenTxs', 'provenTxReqs'] as const) assert.equal(destinationBefore[name]!.length, 0)
  equal(portableProjection(source), portableProjection(destination), 'Logical dataset or exact proof bytes changed during public sync')
  for (const dataset of [source, destination, after]) {
    const ids = new Set(dataset.transactions!.map(row => row.transactionId))
    for (const row of [...dataset.transactions!, ...dataset.outputs!]) assert.equal(row.userId, dataset.user!.userId)
    for (const row of dataset.provenTxReqs!) {
      const notify = typeof row.notify === 'string' ? JSON.parse(row.notify) : row.notify
      assert.ok((notify.transactionIds ?? []).every((id: number) => ids.has(id)), 'Foreign or unmapped notification subscription')
    }
    assert.ok(dataset.transactions!.every(row => row.txid !== report.fixture.txid), 'Owner dataset contains faucet root transaction metadata')
  }
  assert.ok(report.foreignIdentity !== report.identity && report.foreignIdentity === PrivateKey.fromHex('88'.repeat(32)).toPublicKey().toString())
  const foreign = report.transcript.filter((row: any) => row.provider === 'foreign-observer' && row.method === 'getSyncChunk')
  assert.equal(foreign.length, 1); assert.equal(foreign[0].request[0].identityKey, report.identity)
  assert.match(foreign[0].error, /identityKey does not match authentication/)
  assert.equal(foreign[0].response, undefined); assert.equal(report.foreignDenied, true)
  assert.match(report.foreignError, /identityKey does not match authentication/)
  const calls = (method: string, stage: string) => report.walletCalls.filter((row: any) => row.method === method && row.stage === stage)
  assert.equal(calls('getPublicKey', 'source')[0].result.publicKey, report.identity)
  assert.equal(calls('getPublicKey', 'replacement')[0].result.publicKey, report.identity)
  const internalized = calls('internalizeAction', 'source')[0]
  assert.equal(internalized.result.accepted, true); equal(internalized.result, report.internalized)
  const remittance = internalized.args.outputs[0].paymentRemittance
  const sender = new ProtoWallet(PrivateKey.fromHex('22'.repeat(32)))
  assert.equal(remittance.senderIdentityKey, (await sender.getPublicKey({ identityKey: true })).publicKey)
  assert.equal(remittance.derivationPrefix, Buffer.from('tpnil-descendant-sync').toString('base64'))
  assert.equal(remittance.derivationSuffix, Buffer.from('owner-payment').toString('base64'))
  const pub = (await sender.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${remittance.derivationPrefix} ${remittance.derivationSuffix}`, counterparty: report.identity, forSelf: false })).publicKey
  const payment = Transaction.fromAtomicBEEF(internalized.args.tx)
  equal(internalized.args.tx, report.payment.tx); assert.equal(payment.id('hex'), report.payment.txid)
  assert.notEqual(payment.id('hex'), report.fixture.txid)
  assert.equal(payment.outputs[0]!.satoshis, 30_000)
  assert.equal(payment.outputs[0]!.lockingScript.toHex(), new P2PKH().lock(PublicKey.fromString(pub).toHash()).toHex())
  assert.notEqual(report.identity, PrivateKey.fromHex('77'.repeat(32)).toPublicKey().toString())
  const sourceClosure = await verifyDescendantDataset(source, report.taskTxid)
  const destinationClosure = await verifyDescendantDataset(destination, report.taskTxid)
  const redemptionClosure = await verifyDescendantDataset(after, report.redeemed.txid)
  equal(sourceClosure, report.sourceClosure); equal(destinationClosure, report.destinationClosure); equal(redemptionClosure, report.redemptionClosure)
  assert.equal(sourceClosure.rawHex, destinationClosure.rawHex)
  const onlyPayment = (tx: Transaction, depth = 0): boolean => {
    assert.ok(depth < 32)
    return tx.inputs.length > 0 && tx.inputs.every(input => input.sourceTXID === payment.id('hex') && input.sourceOutputIndex === 0 || input.sourceTransaction !== undefined && onlyPayment(input.sourceTransaction, depth + 1))
  }
  assert.ok(onlyPayment(Transaction.fromAtomicBEEF(sourceClosure.beef)), 'Task uses undeclared owner funding')
  assert.ok(onlyPayment(Transaction.fromAtomicBEEF(redemptionClosure.beef)), 'Redemption uses undeclared owner funding')
  const created = calls('createAction', 'source')[0]
  assert.equal(created.result.txid, report.taskTxid); assert.equal(report.outpoint, `${report.taskTxid}.0`)
  assert.equal(Transaction.fromAtomicBEEF(created.result.tx).toHex(), sourceClosure.rawHex)
  const sourceTx = Transaction.fromAtomicBEEF(sourceClosure.beef)
  const decoded = PushDrop.decode(sourceTx.outputs[0]!.lockingScript)
  assert.equal(sourceTx.outputs[0]!.satoshis, 3); assert.equal(Utils.toUTF8(decoded.fields[0]!), 'tpnil descendant task')
  equal(decoded.fields[1], report.ciphertext)
  const proofIds: string[] = []
  const sourceSettings = report.transcript.find((row: any) => row.provider === 'source-observer' && row.method === 'makeAvailable').response
  const transferVersion = sourceSettings.syncTransfer?.version === 1 ? { syncTransferVersion: 1 } : {}
  for (const [i, page] of report.proofPages.entries()) {
    assert.equal(page.args.identityKey, report.identity); assert.equal(page.args.maxItems, 1); assert.equal(page.args.maxRoughSize, 1)
    assert.equal(page.args.offsets.find((row: any) => row.name === 'provenTxReq').offset, proofIds.length)
    const observed = report.transcript.find((row: any) => row.provider === 'source-observer' && row.method === 'getSyncChunk' && canonicalJson(row.request[0]) === canonicalJson({ ...page.args, ...transferVersion }))
    assert.ok(observed); equal(publicClientRepresentation(canonicalSyncChunk(observed.response, report.configuration.source)), page.response)
    assert.ok(page.response.provenTxReqs.length <= 1)
    for (const row of page.response.provenTxReqs) {
      equal(row, source.provenTxReqs!.find(candidate => candidate.txid === row.txid), 'Repeated proof export bytes changed')
      proofIds.push(row.txid)
    }
    if (i === report.proofPages.length - 1) assert.equal(page.response.provenTxReqs.length, 0)
  }
  equal(proofIds, source.provenTxReqs!.map(row => row.txid))
  assert.equal(report.sourceReachable, false); assert.match(report.sourceUnavailableCause, /ECONNREFUSED|ECONNRESET|SocketError: other side closed/)
  const retired = timestamp(report.originalClientRetiredAt), offline = timestamp(report.sourceUnavailableAt), fresh = timestamp(report.freshClientCreatedAt), restored = timestamp(report.cleanup.sourceRestoredAt)
  assert.ok(retired <= offline && offline <= fresh && fresh < restored)
  for (const row of report.walletCalls.filter((row: any) => row.stage === 'replacement')) assert.ok(timestamp(row.startedAt) >= fresh && timestamp(row.endedAt) <= restored && !row.error)
  equal(calls('listOutputs', 'replacement')[0].result, report.recovered)
  assert.equal(report.recovered.outputs.find((row: any) => row.outpoint === report.outpoint).spendable, true)
  const coldTx = Transaction.fromAtomicBEEF(Beef.fromBinary(report.recovered.BEEF).toBinaryAtomic(report.taskTxid))
  assert.equal(coldTx.toHex(), sourceClosure.rawHex)
  equal(calls('decrypt', 'replacement')[0].args, { ciphertext: decoded.fields[1], protocolID: [2, 'tpnil descendant task'], keyID: 'task', counterparty: 'self' }); equal(calls('decrypt', 'replacement')[0].result, report.decrypted)
  assert.equal(Utils.toUTF8(report.decrypted.plaintext), report.task)
  equal(calls('signAction', 'replacement')[0].result, report.redeemed)
  const redemption = Transaction.fromAtomicBEEF(redemptionClosure.beef)
  assert.ok(redemption.inputs.some(input => input.sourceTXID === report.taskTxid && input.sourceOutputIndex === 0))
  equal(calls('listOutputs', 'replacement')[1].result, report.after)
  assert.ok(report.after.outputs.every((row: any) => row.outpoint !== report.outpoint))
  for (const [stage, txid, raw] of [['source', report.payment.txid, payment.toHex()], ['source', report.taskTxid, sourceClosure.rawHex], ['destination', report.redeemed.txid, redemptionClosure.rawHex]]) {
    const rows = report.submissions[stage].filter((row: any) => row.txid === txid)
    assert.ok(rows.length >= 1)
    for (const row of rows) {
      assert.equal(row.verdict, 'ACCEPTED_BY_NETWORK')
      const bytes = [...Buffer.from(row.beefHex, 'hex')]
      let submitted: Transaction
      try { submitted = Transaction.fromAtomicBEEF(bytes) } catch { submitted = Transaction.fromBinary(bytes) }
      assert.equal(submitted.id('hex'), txid); assert.equal(submitted.toHex(), raw)
    }
  }
  assert.ok([...report.submissions.source, ...report.submissions.destination].every((row: any) => row.verdict === 'ACCEPTED_BY_NETWORK'), 'This fixture must have no rejected branch')
  assert.equal(report.cleanup.sourceRestored, true); equal(report.cleanup.errors, [])
  assert.ok(timestamp(report.startedAt) < retired && restored <= timestamp(report.endedAt))
  return { verified: true, result: 'PASS', assertions: descendantAssertions.map(id => ({ id, result: 'PASS' })), identity: report.identity, transactions: [report.payment.txid, report.taskTxid, report.redeemed.txid] }
}
