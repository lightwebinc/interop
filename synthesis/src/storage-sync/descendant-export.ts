import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { Beef, Transaction } from '@bsv/sdk'
import type { StorageProvider } from '@bsv/wallet-toolbox'

const root = path.resolve(import.meta.dirname, '../../..')
const manifestPath = 'infra/adapters/storage-portability/typescript-descendant-export.json'
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

export function exportBroadcastBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  throw new Error('Invalid TypeScript provenTxReq.wasBroadcast value')
}

/** Explicit laboratory export adapter. Enrichment happens inside the original
 * owner-scoped paged query, before getSyncChunk applies item/rough-size limits.
 * It changes no database records and cannot fetch transactions from a network. */
export function applyTypeScriptDescendantExport(storage: StorageProvider): Record<string, unknown> {
  const manifestBytes = fs.readFileSync(path.join(root, manifestPath)), manifest = JSON.parse(manifestBytes.toString())
  assert.equal(manifest.id, 'tpnil-typescript-descendant-export@1.0.0')
  assert.equal(manifest.adapter.sha256, sha(fs.readFileSync(path.join(root, manifest.adapter.path))))
  const packageRoot = path.join(root, 'synthesis/node_modules/@bsv/wallet-toolbox')
  assert.equal(JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version, manifest.upstream.version)
  for (const [file, digest] of Object.entries(manifest.upstream.files)) assert.equal(sha(fs.readFileSync(path.join(packageRoot, file))), digest, `Unadmitted TypeScript storage source: ${file}`)
  const original = storage.getProvenTxReqsForUser.bind(storage)
  storage.getProvenTxReqsForUser = async args => {
    const rows = await original(args)
    const result = []
    for (const row of rows) {
      if (!row.rawTx?.length) { result.push(row); continue }
      assert.equal(Transaction.fromBinary(row.rawTx).id('hex'), row.txid, 'Export request hash differs from its signed transaction')
      const notification = JSON.parse(row.notify)
      assert.ok(notification && typeof notification === 'object' && !Array.isArray(notification))
      let notify = row.notify
      if (notification.transactionIds !== undefined) {
        assert.ok(Array.isArray(notification.transactionIds))
        assert.ok(notification.transactionIds.every((id: unknown) => Number.isSafeInteger(id)))
        assert.equal(new Set(notification.transactionIds).size, notification.transactionIds.length, 'Duplicate notification transaction IDs')
        const ids: number[] = []
        for (const id of notification.transactionIds as number[]) {
          const transactions = await storage.findTransactions({ partial: { transactionId: id } })
          assert.equal(transactions.length, 1, 'Notification references an unknown transaction')
          if (transactions[0]!.userId === args.userId) ids.push(id)
        }
        notify = JSON.stringify({ ...notification, transactionIds: ids })
      }
      const beef = await storage.getBeefForTransaction(row.txid, { ignoreServices: true, ignoreNewProven: true, knownTxids: [] })
      assert.ok(beef.findTxid(row.txid), 'Storage-only proof omitted the subject transaction')
      const subject = beef.findAtomicTransaction(row.txid)
      assert.ok(subject, 'Source proof cannot hydrate the subject transaction')
      const closure = new Beef()
      closure.mergeTransaction(Transaction.fromAtomicBEEF(subject.toAtomicBEEF()))
      closure.removeExistingTxid(row.txid)
      result.push({ ...row, wasBroadcast: exportBroadcastBoolean(row.wasBroadcast), notify, inputBEEF: closure.toBinary() })
    }
    return result
  }
  return { id: manifest.id, manifest: manifestPath, manifestSha256: sha(manifestBytes), adapter: manifest.adapter, upstream: manifest.upstream,
    boundary: 'source export compatibility adapter; upstream production TypeScript storage is unchanged' }
}
