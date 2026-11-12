import assert from 'node:assert/strict'
import { Beef, Transaction, Utils } from '@bsv/sdk'
import { spendsOnlyDeclaredNativePayments } from './verify-conformance-reserves.js'

/** Parent supplies independently admitted native payments and raw storage
 * observations. Child coverage failures may legitimately contribute no tx. */
export async function verifyCoverageNativeTransactions(rows: Array<{ role: string; txid: string; atomicBeef: number[] }>, binding: {
  storageTransactions: Map<string, Transaction>; declaredNativePayments: string[]; fixture: any
}): Promise<{ verified: true; transactions: Array<{ role: string; txid: string }> }> {
  assert.ok(Array.isArray(rows)); assert.ok(binding.storageTransactions instanceof Map)
  assert.ok(Array.isArray(binding.declaredNativePayments))
  const roots = new Set<string>()
  for (const outpoint of binding.declaredNativePayments) {
    assert.match(outpoint, /^[a-f0-9]{64}\.(0|[1-9][0-9]*)$/)
    assert.ok(Number(outpoint.slice(65)) <= 0xffffffff)
    assert.ok(!roots.has(outpoint), 'Duplicate declared native funding outpoint'); roots.add(outpoint)
    assert.notEqual(outpoint.slice(0, 64), binding.fixture.txid, 'The mined faucet is not a declared native payment')
  }
  const roles = new Set<string>(), txids = new Set<string>(), transactions: Array<{ role: string; txid: string }> = []
  const tracker = { currentHeight: async () => binding.fixture.fundingHeight + binding.fixture.maturityDepth,
    isValidRootForHeight: async (root: string, height: number) => root === binding.fixture.merkleRoot && height === binding.fixture.fundingHeight }
  for (const row of rows) {
    assert.ok(row && typeof row === 'object' && !Array.isArray(row))
    assert.equal(typeof row.role, 'string'); assert.ok(row.role.length <= 128)
    assert.match(row.role, /^[a-z][a-z0-9]*(?:[-_./][a-z0-9]+)*$/)
    assert.ok(!roles.has(row.role), 'Duplicate coverage transaction role'); roles.add(row.role)
    assert.match(row.txid, /^[a-f0-9]{64}$/)
    assert.ok(!txids.has(row.txid), 'Duplicate coverage transaction identity'); txids.add(row.txid)
    assert.ok(Array.isArray(row.atomicBeef) && row.atomicBeef.length > 0)
    for (let index = 0; index < row.atomicBeef.length; index++) assert.ok(Object.hasOwn(row.atomicBeef, index) && Number.isInteger(row.atomicBeef[index]) && row.atomicBeef[index]! >= 0 && row.atomicBeef[index]! <= 255, 'Atomic BEEF must contain dense byte values')
    const reader = new Utils.Reader(row.atomicBeef), graph = Beef.fromReader(reader)
    assert.equal(reader.eof(), true, 'Unparsed trailing Atomic BEEF bytes')
    assert.equal(graph.atomicTxid, row.txid)
    const tx = Transaction.fromAtomicBEEF(row.atomicBeef)
    assert.equal(tx.id('hex'), row.txid)
    const stored = binding.storageTransactions.get(row.txid)
    assert.ok(stored, 'Independent native storage transaction bytes are absent')
    assert.equal(stored.id('hex'), row.txid); assert.equal(stored.toHex(), tx.toHex(), 'Native storage bytes differ from coverage transaction')
    const mined = graph.findTxid(binding.fixture.txid)
    assert.ok(mined?.tx && mined.bumpIndex !== undefined, 'Atomic BEEF lacks the admitted mined root proof')
    assert.equal(mined.tx.toHex(), binding.fixture.rawHex)
    assert.ok(await graph.verify(tracker), 'Atomic BEEF has invalid or unresolved proof ancestry')
    assert.ok(await tx.verify(tracker), 'Coverage transaction signature or ancestry is invalid')
    assert.ok(spendsOnlyDeclaredNativePayments(tx, [...roots]), 'Coverage transaction spends outside independently declared native payments')
    transactions.push({ role: row.role, txid: row.txid })
  }
  return { verified: true, transactions }
}
