import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Beef, MerklePath, PushDrop, Transaction, Utils } from '@bsv/sdk'
import { entities, projectDataset, type Dataset } from '../../storage-sync/projection.js'
import { canonicalSyncChunk } from '../../storage-sync/compatibility.js'
import { canonicalJson } from '../../determinism.js'
import { portabilityAssertions, portableTask } from './conformance-portability.js'
const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../../fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const tracker = { currentHeight: async () => 900100, isValidRootForHeight: async (root: string, height: number) => root === fixture.merkleRoot && height === fixture.fundingHeight }

function datasetBeef(dataset: Dataset, starting: number[]): Beef {
  const beef = Beef.fromBinary(starting)
  for (const row of [...(dataset.transactions ?? []), ...(dataset.provenTxReqs ?? [])]) if (Array.isArray(row.inputBEEF) && row.inputBEEF.length) beef.mergeBeef(row.inputBEEF as number[])
  for (const row of [...(dataset.transactions ?? []), ...(dataset.provenTxReqs ?? [])]) if (Array.isArray(row.rawTx) && row.rawTx.length) beef.mergeRawTx(row.rawTx as number[])
  for (const row of dataset.provenTxs ?? []) {
    assert.equal(row.height, fixture.fundingHeight); assert.equal(row.merkleRoot, fixture.merkleRoot); assert.equal(row.blockHash, fixture.fundingBlockHash)
    const proof = MerklePath.fromBinary(row.merklePath as number[])
    assert.equal(proof.computeRoot(String(row.txid)), fixture.merkleRoot)
    beef.mergeRawTx(row.rawTx as number[], beef.mergeBump(proof))
  }
  return beef
}

/** Recompute public operations, full logical projection and signed ancestry. */
export async function verifyNativePortability(report: any, { requireNative = true } = {}) {
  assert.equal(report.schema, 'tpnil-native-storage-portability@1')
  assert.equal(report.claim, 'ENGINEERING_OBSERVATION_ONLY')
  assert.ok(['native-ui', 'reference-engineering'].includes(report.mode))
  if (requireNative) assert.equal(report.mode, 'native-ui', 'Reference recreation cannot qualify native portability')
  assert.deepEqual(report.assertions.map((a: any) => a.id).sort(), [...portabilityAssertions].sort())
  const trace = report.trace as any[]
  const returned = (method: string, result: any) => [...trace].reverse().find(row => row.method === method && canonicalJson(row.result) === canonicalJson(result))
  const snapshots = (provider: string): Dataset[] => {
    // StorageClient exposes JSON RPC entity timestamps as Dates and absent SQL
    // values as undefined. Reconstruct that representation independently; do
    // not import the client's entity validation or discard any logical field.
    const normalizeEntity = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => {
        if (['created_at', 'updated_at'].includes(key)) return [key, new Date(value as string).toISOString()]
        if (['rawTx', 'inputBEEF', 'lockingScript', 'merklePath'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
          const entries = Object.entries(value)
          assert.ok(entries.every(([index, byte], i) => index === String(i) && Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255), 'Malformed captured Uint8Array')
          return [key, entries.map(([, byte]) => byte)]
        }
        return [key, value]
      }))
    const datasets: Dataset[] = []
    let current: Dataset | undefined
    for (const row of report.storage.filter((row: any) => row.provider === provider && row.method === 'getSyncChunk' && row.response)) {
      const request = row.request[0], chunk = canonicalSyncChunk(row.response, 'go') as any
      assert.equal(request.identityKey, report.identity); assert.equal(chunk.userIdentityKey, report.identity)
      assert.equal(chunk.fromStorageIdentityKey, request.fromStorageIdentityKey)
      assert.equal(canonicalJson(row.canonicalResponse), canonicalJson(chunk), 'Recorded wire normalization differs from raw RPC')
      if (request.offsets.every((offset: any) => offset.offset === 0)) { current = Object.fromEntries(entities.map(entity => [entity, []])); datasets.push(current!) }
      assert.ok(current)
      if (chunk.user) current.user = normalizeEntity(chunk.user)
      for (const entity of entities) {
        const offset = request.offsets.find((offset: any) => offset.name === entity.slice(0, -1))
        assert.equal(offset.offset, current[entity]!.length, 'Sync read page cursor differs from captured records')
        current[entity]!.push(...(chunk[entity] ?? []).map(normalizeEntity))
      }
    }
    return datasets
  }
  const predicates: Record<string, () => void | Promise<void>> = {
    'portability.same-identity': () => {
      const identities = trace.filter(row => row.method === 'getPublicKey' && row.args.identityKey)
      assert.equal(identities.length, 2); assert.equal(identities[0].result.publicKey, report.identity); assert.equal(identities[1].result.publicKey, report.identity)
      assert.equal(report.identityAfter, report.identity)
      assert.ok(Date.parse(identities[0].endedAt) <= Date.parse(report.outage.startedAt))
      assert.ok(Date.parse(identities[1].startedAt) >= Date.parse(report.coldReload.at) && Date.parse(identities[1].endedAt) <= Date.parse(report.outage.endedAt))
    },
    'portability.distinct-counterparts': () => {
      assert.notEqual(report.counterparts.source.storageIdentityKey, report.counterparts.destination.storageIdentityKey)
      for (const [provider, settings] of [['source-observer', report.counterparts.source], ['destination-observer', report.counterparts.destination]] as const) assert.ok(report.storage.some((row: any) => row.provider === provider && row.method === 'makeAvailable' && row.response.storageIdentityKey === settings.storageIdentityKey))
    },
    'portability.native-mediated-sync': () => {
      assert.ok(report.storage.every((row: any) => row.method !== 'processSyncChunk'), 'Observer must never migrate native storage records')
      if (report.mode === 'native-ui') {
        assert.ok(report.nativeRpc.some((row: any) => row.host === 'replacement-wallet.itcve.test' && row.method === 'processSyncChunk' && row.completed && row.status === 200))
        assert.ok(report.ui.some((row: any) => row.stage === 'native-sync-complete' && row.text.includes('Sync complete')))
        assert.ok(report.ui.some((row: any) => row.stage === 'replacement-active' && row.text.includes('replacement-wallet.itcve.test') && row.text.includes('In use')))
      } else assert.ok(report.referenceMediator.some((row: any) => row.method === 'processSyncChunk' && row.response && !row.error))
    },
    'portability.complete-logical-dataset': async () => {
      assert.deepEqual(report.source, snapshots('source-observer')[0], 'Source dataset differs from authenticated RPC responses')
      assert.deepEqual(report.destination, snapshots('destination-observer')[0], 'Destination dataset differs from authenticated RPC responses')
      assert.equal(report.source.user.identityKey, report.identity); assert.equal(report.destination.user.identityKey, report.identity)
      assert.ok(report.source.transactions.length >= 2 && report.source.outputs.length >= 2 && report.source.provenTxs.length >= 1)
      assert.deepEqual(projectDataset(report.source), projectDataset(report.destination), 'Portable bytes, metadata or relationships differ')
      const outpoint = report.task.txid + '.' + report.task.vout; assert.equal(outpoint, report.outpoint)
      const sourceOutput = report.source.outputs.find((row: any) => row.txid === report.task.txid && row.vout === report.task.vout)
      assert.equal(sourceOutput.spendable, true)
      const task = Transaction.fromAtomicBEEF([...Buffer.from(report.task.beefHex, 'hex')])
      assert.equal(task.id('hex'), report.task.txid); assert.equal(task.toHex(), report.task.rawHex); assert.ok(await task.verify(tracker))
      const decoded = PushDrop.decode(task.outputs[report.task.vout]!.lockingScript)
      assert.equal(Utils.toUTF8(decoded.fields[0]!), '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG')
      assert.deepEqual(decoded.fields[1], report.task.ciphertext); assert.equal(task.outputs[report.task.vout]!.satoshis, 3)
      for (const dataset of [report.source, report.destination]) assert.ok(await Transaction.fromAtomicBEEF(datasetBeef(dataset, [...Buffer.from(report.task.beefHex, 'hex')]).toBinaryAtomic(report.task.txid)).verify(tracker))
    },
    'portability.source-unavailable': () => {
      assert.equal(report.outage.probe.reachable, false); assert.match(report.outage.probe.error, /fetch failed|connect|refused/i)
      assert.equal(report.outage.events.at(-1).available, false)
      assert.ok(Date.parse(report.outage.endedAt) >= Date.parse(report.outage.startedAt))
    },
    'portability.cold-wallet-reload': () => {
      for (const name of ['locked', 'unlocked', 'contextDropped', 'applicationCacheCleared', 'taskVisible']) assert.equal(report.coldReload[name], true)
      assert.ok(Date.parse(report.outage.startedAt) <= Date.parse(report.coldReload.at) && Date.parse(report.coldReload.at) <= Date.parse(report.outage.endedAt))
      if (report.mode === 'native-ui') {
        assert.equal(report.coldReload.mechanism, 'native-settings-lock-unlock')
        assert.ok(report.coldReload.consoleMessages.some((text: string) => /dropWalletContext \(WALLET_LOCKED\): gone immediately/.test(text)))
      } else assert.equal(report.coldReload.mechanism, 'reference-wallet-recreation')
    },
    'portability.cold-task-recovery': async () => {
      const row = returned('listOutputs', report.recovered); assert.ok(row)
      assert.equal(row.args.basket, 'todo tokens'); assert.equal(row.args.include, 'entire transactions')
      const outputs = report.recovered.outputs.filter((output: any) => output.outpoint === report.outpoint)
      assert.equal(outputs.length, 1); assert.equal(outputs[0].spendable, true)
      const original = report.created.outputs.find((output: any) => output.outpoint === report.outpoint)
      for (const field of ['satoshis', 'lockingScript', 'tags', 'customInstructions', 'outputDescription']) assert.deepEqual(outputs[0][field], original[field])
      const tx = Transaction.fromAtomicBEEF(Beef.fromBinary(report.recovered.BEEF).toBinaryAtomic(report.task.txid))
      assert.equal(tx.toHex(), report.task.rawHex); assert.ok(await tx.verify(tracker))
      for (const value of [report.beforeDecryption, report.afterDecryption]) {
        const row = returned('decrypt', value); assert.ok(row)
        assert.deepEqual(row.args, { ciphertext: report.task.ciphertext, protocolID: [0, 'todo list'], keyID: '1', counterparty: 'self' })
        assert.equal(Utils.toUTF8(value.plaintext), portableTask)
      }
      const recoveryTime = Date.parse(row.startedAt)
      assert.ok(recoveryTime >= Date.parse(report.coldReload.at) && recoveryTime <= Date.parse(report.outage.endedAt))
      const decryption = returned('decrypt', report.afterDecryption)
      assert.ok(Date.parse(decryption.startedAt) >= Date.parse(report.coldReload.at) && Date.parse(decryption.endedAt) <= Date.parse(report.outage.endedAt))
      if (report.mode === 'native-ui') assert.ok(report.replacementRpc.some((rpc: any) => rpc.host === 'replacement-wallet.itcve.test' && rpc.method === 'listOutputs' && rpc.completed && rpc.status === 200), 'Cold public reads must reach the replacement counterpart')
    },
    'portability.replacement-redemption': async () => {
      assert.deepEqual(report.destinationAfter, snapshots('destination-observer')[1], 'Post-replacement dataset differs from authenticated RPC responses')
      assert.ok(returned('listOutputs', report.redeemed)); assert.ok(!report.redeemed.outputs.some((output: any) => output.outpoint === report.outpoint))
      const spent = report.destinationAfter.outputs.find((output: any) => output.txid === report.task.txid && output.vout === report.task.vout)
      assert.equal(spent.spendable, false)
      const row = report.destinationAfter.transactions.find((transaction: any) => transaction.transactionId === spent.spentBy)
      assert.equal(row.txid, report.redemption.txid)
      const beef = datasetBeef(report.destinationAfter, [...Buffer.from(report.task.beefHex, 'hex')])
      const tx = Transaction.fromAtomicBEEF(beef.toBinaryAtomic(report.redemption.txid))
      assert.equal(tx.toHex(), report.redemption.rawHex); assert.ok(await tx.verify(tracker))
      assert.ok(tx.inputs.some(input => input.sourceTXID === report.task.txid && input.sourceOutputIndex === report.task.vout))
      if (report.mode === 'native-ui') assert.ok(report.replacementRpc.some((rpc: any) => rpc.host === 'replacement-wallet.itcve.test' && rpc.method === 'processAction' && rpc.status === 200))
      else assert.ok(report.referenceMediatorAfter.some((rpc: any) => rpc.provider === 'replacement-active' && rpc.method === 'processAction' && rpc.response && !rpc.error))
    },
    'portability.cleanup': () => { assert.equal(report.cleanup.sourceRestored, true); if (requireNative) assert.equal(report.cleanup.replacementOwnedByServiceGraph, true) }
  }
  const assertions = []
  for (const item of report.assertions) {
    let result = 'PASS', detail: string | undefined
    try { await predicates[item.id]!() } catch (error) { result = 'FAIL'; detail = String(error) }
    assert.equal(item.result, result, `Independent portability predicate differs: ${item.id}: ${detail ?? ''}`)
    assertions.push({ id: item.id, result })
  }
  assert.equal(report.result, assertions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL')
  return { verified: true, result: report.result, mode: report.mode, assertions }
}

if (process.argv[1] === import.meta.filename) {
  const report = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]!), 'utf8'))
  console.log(JSON.stringify(await verifyNativePortability(report, { requireNative: !process.argv.includes('--reference') })))
}
