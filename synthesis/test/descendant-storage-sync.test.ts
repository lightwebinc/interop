import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Beef, LockingScript, Transaction, UnlockingScript } from '@bsv/sdk'
import { applyTypeScriptDescendantExport, exportBroadcastBoolean } from '../src/storage-sync/descendant-export.js'
import { runDescendantFundingSync, verifyDescendantDataset } from '../src/storage-sync/descendant-funding.js'
import { verifyDescendantFundingReport } from '../src/storage-sync/verify-descendant.js'

const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const clone = <T>(value: T): T => structuredClone(value)

describe('explicit TypeScript descendant export boundary', () => {
  function setup(notify = JSON.stringify({ transactionIds: [1, 2, 3], opaque: { keep: 'exact value' } }), wasBroadcast: any = 1) {
    const root = Transaction.fromAtomicBEEF([...Buffer.from(fixture.atomicBeefHex, 'hex')])
    const tx = new Transaction(1, [{ sourceTransaction: root, sourceTXID: root.id('hex'), sourceOutputIndex: 0, unlockingScript: UnlockingScript.fromASM(''), sequence: 0xffffffff }], [{ satoshis: 1, lockingScript: LockingScript.fromASM('OP_TRUE') }], 0)
    const unrelated = new Transaction(1, [], [{ satoshis: 2, lockingScript: LockingScript.fromASM('OP_FALSE') }], 0)
    const bytes = new Beef(); bytes.mergeTransaction(tx); bytes.mergeTransaction(unrelated)
    const row = { txid: tx.id('hex'), rawTx: tx.toBinary(), inputBEEF: [2, 0, 0, 0, 0, 0], notify, wasBroadcast, untouched: ['a', 'b'] }
    const before = clone(row), seen: any[] = []
    const storage: any = {
      getProvenTxReqsForUser: async (args: any) => { seen.push(clone(args)); return [row] },
      findTransactions: async (args: any) => {
        const id = args.partial.transactionId
        return id >= 1 && id <= 3 ? [{ transactionId: id, userId: id === 2 ? 22 : 11, txid: id === 3 ? 'another-owned-transaction' : row.txid }] : []
      },
      getBeefForTransaction: async (id: string, options: any) => { assert.equal(id, tx.id('hex')); assert.deepEqual(options, { ignoreServices: true, ignoreNewProven: true, knownTxids: [] }); return Beef.fromBinary(bytes.toBinary()) }
    }
    applyTypeScriptDescendantExport(storage)
    return { storage, row, before, seen, tx, root, unrelated }
  }
  it('keeps the owner query, same-owner subscriptions, exact fields and only reachable public ancestry', async () => {
    const state = setup(), args = { userId: 11, since: new Date('2026-01-01'), paged: { offset: 7, limit: 1 } }
    const [row] = await state.storage.getProvenTxReqsForUser(args)
    expect(state.seen).toEqual([args]); expect(state.row).toEqual(state.before)
    expect(JSON.parse(row.notify)).toEqual({ transactionIds: [1, 3], opaque: { keep: 'exact value' } })
    expect(row.wasBroadcast).toBe(true); expect(row.untouched).toEqual(['a', 'b'])
    const beef = Beef.fromBinary(row.inputBEEF)
    expect(beef.findTxid(state.root.id('hex'))).toBeDefined()
    expect(beef.findTxid(state.tx.id('hex'))).toBeUndefined(); expect(beef.findTxid(state.unrelated.id('hex'))).toBeUndefined()
  })
  it('preserves a valid absent notification transactionIds property', async () => {
    const state = setup('{"opaque":"keep spacing"}')
    expect((await state.storage.getProvenTxReqsForUser({ userId: 11 }))[0].notify).toBe('{"opaque":"keep spacing"}')
  })
  it.each(['bad-json', 'null', '[]', '{"transactionIds":5}', '{"transactionIds":[1,1]}', '{"transactionIds":["1"]}', '{"transactionIds":[999]}'])('rejects malformed/unknown notification %s', async notify => {
    const state = setup(notify)
    await expect(state.storage.getProvenTxReqsForUser({ userId: 11 })).rejects.toThrow()
    expect(state.row).toEqual(state.before)
  })
  it('accepts only exact SQL and wire boolean representations', () => {
    expect([false, 0, true, 1].map(exportBroadcastBoolean)).toEqual([false, false, true, true])
    for (const value of [2, -1, null, undefined, '1', [], {}]) expect(() => exportBroadcastBoolean(value)).toThrow()
  })
})

describe('real descendant-funded source-off replacement and independent oracle', () => {
  let directory: string, report: any, original: any
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-descendant-test-'))
    original = await runDescendantFundingSync({ source: 'typescript', destination: 'typescript', output: path.join(directory, 'original') })
    report = await runDescendantFundingSync({ source: 'typescript', destination: 'typescript', output: path.join(directory, 'adapted'), typescriptDescendantExport: true, ownerKeyHex: '7a'.repeat(32) })
  }, 60_000)
  afterAll(() => { if (directory) fs.rmSync(directory, { recursive: true, force: true }) })
  it('retains unchanged upstream missing ancestry and actual cold-read failure', () => {
    expect(original.result).toBe('FAIL')
    expect(original.assertions.find((row: any) => row.id === 'source-export-proof-closure').result).toBe('FAIL')
    expect(original.assertions.find((row: any) => row.id === 'destination-export-proof-closure').result).toBe('FAIL')
    expect(original.error.message).toMatch(/f81c06b9c0e158d9ae92c02c4feb94e783fb0f010f184c6df83b1fc9a4042cf9/)
    expect(original.assertions.find((row: any) => row.id === 'cleanup').result).toBe('PASS')
  })
  it('verifies the actual public migrated dataset and cold task spend', async () => {
    expect(report.error).toBeUndefined(); expect(report.result).toBe('PASS')
    expect((await verifyDescendantFundingReport(report)).assertions).toHaveLength(10)
  })
  it('does not seed a missing exported ancestor from captured task BEEF', async () => {
    const dataset = clone(report.sourceDataset)
    for (const row of [...dataset.transactions, ...dataset.provenTxReqs]) row.inputBEEF = new Beef().toBinary()
    dataset.provenTxs = []
    await expect(verifyDescendantDataset(dataset, report.taskTxid)).rejects.toThrow()
    expect(report.walletCalls.find((row: any) => row.method === 'createAction').result.tx.length).toBeGreaterThan(100)
  })
  it.each([
    ['fixture root', (r: any) => { r.fixture.txid = '00'.repeat(32) }],
    ['decrypt domain', (r: any) => { r.walletCalls.find((row: any) => row.method === 'decrypt').args.keyID = 'wrong domain' }],
    ['RPC dataset substitution', (r: any) => { r.sourceDataset.outputs[0].satoshis++ }],
    ['false authorization result', (r: any) => { r.foreignError = 'network error 500' }],
    ['cold timing', (r: any) => { r.freshClientCreatedAt = r.startedAt }],
    ['source reachability', (r: any) => { r.sourceReachable = true }],
    ['retained spend removal', (r: any) => { r.submissions.destination = [] }],
    ['cleanup failure', (r: any) => { r.cleanup.errors.push('unretired service') }],
    ['proof pagination omission', (r: any) => { r.proofPages.splice(0, 1) }]
  ] as const)('rejects %s tampering', async (_name, mutate) => {
    const changed = clone(report); mutate(changed)
    await expect(verifyDescendantFundingReport(changed)).rejects.toThrow()
  })
})
