import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { Beef, MerklePath, Transaction } from '@bsv/sdk'
import type { Dataset } from '../../storage-sync/projection.js'

const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../../fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const tracker = { currentHeight: async () => fixture.fundingHeight + fixture.maturityDepth, isValidRootForHeight: async (root: string, height: number) => root === fixture.merkleRoot && height === fixture.fundingHeight }

/** Independent v2 oracle: never seed the graph from an observed wallet BEEF. */
export async function verifyPortableProofClosure(dataset: Dataset): Promise<{ beef: Beef; verifiedTxids: string[] }> {
  const graph = new Beef()
  const raw = new Map<string, string>()
  const records = [...(dataset.transactions ?? []), ...(dataset.provenTxReqs ?? []), ...(dataset.provenTxs ?? [])]
  for (const row of records) {
    if (Array.isArray(row.inputBEEF) && row.inputBEEF.length) graph.mergeBeef(row.inputBEEF as number[])
    if (Array.isArray(row.rawTx) && row.rawTx.length) {
      const tx = Transaction.fromBinary(row.rawTx as number[])
      assert.equal(tx.id('hex'), row.txid, 'Dataset raw transaction identity differs')
      assert.ok(!raw.has(String(row.txid)) || raw.get(String(row.txid)) === tx.toHex(), 'Conflicting dataset raw transactions')
      raw.set(String(row.txid), tx.toHex())
    }
  }
  for (const row of dataset.provenTxs ?? []) {
    assert.equal(row.height, fixture.fundingHeight); assert.equal(row.merkleRoot, fixture.merkleRoot); assert.equal(row.blockHash, fixture.fundingBlockHash)
    const proof = MerklePath.fromBinary(row.merklePath as number[])
    assert.equal(proof.computeRoot(String(row.txid)), fixture.merkleRoot)
    graph.mergeRawTx(row.rawTx as number[], graph.mergeBump(proof))
  }
  for (const bytes of raw.values()) graph.mergeRawTx([...Buffer.from(bytes, 'hex')])
  const root = graph.findTxid(fixture.txid)
  assert.ok(root?.tx && root.bumpIndex !== undefined, 'Dataset lacks the mined raw transaction and proof')
  assert.equal(root.tx.toHex(), fixture.rawHex)
  assert.equal(graph.bumps[root.bumpIndex]!.blockHeight, fixture.fundingHeight)
  assert.equal(graph.bumps[root.bumpIndex]!.computeRoot(fixture.txid), fixture.merkleRoot)
  assert.ok(await graph.verify(tracker), 'Dataset contains unresolved or invalid proof ancestry')
  for (const row of dataset.transactions ?? []) if (row.txid) assert.ok(raw.has(String(row.txid)), 'Owned transaction has no retained signed bytes')
  const verifiedTxids = [...raw.keys()].sort()
  assert.ok(verifiedTxids.length >= 2, 'At least two signed transaction records are required')
  for (const txid of verifiedTxids) {
    const tx = Transaction.fromAtomicBEEF(graph.toBinaryAtomic(txid))
    assert.equal(tx.toHex(), raw.get(txid))
    assert.ok(await tx.verify(tracker), `Invalid script or mined ancestry for ${txid}`)
  }
  return { beef: graph, verifiedTxids }
}
