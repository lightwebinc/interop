import assert from 'node:assert/strict'
import { Transaction } from '@bsv/sdk'
import { sha256Hex } from '../../determinism.js'
import { todoSubmissionBinding } from './todo-submission-binding.js'

export function captureLifecycleWindow(submissions: any[], startIndex: number, receipts: any[], receiptStartIndex: number, lockingScript: string, startedAt: string, endedAt: string) {
  const rows = submissions.slice(startIndex).map((row, offset) => ({ index: startIndex + offset, txid: row.txid, verdict: row.verdict, bytes: [...row.bytes], sha256: sha256Hex(Uint8Array.from(row.bytes)) }))
  const excludedTxids = [...new Set(submissions.slice(0, startIndex).map(row => row.txid))]
  const matching = rows.filter(row => {
    if (excludedTxids.includes(row.txid)) return false
    let tx: Transaction
    try { tx = Transaction.fromAtomicBEEF(row.bytes) } catch { tx = Transaction.fromBinary(row.bytes) }
    assert.equal(tx.id('hex'), row.txid)
    return tx.outputs.filter(output => output.satoshis === 2 && output.lockingScript.toHex() === lockingScript).length === 1
  })
  const storageReceipts = structuredClone(receipts.slice(receiptStartIndex))
  const selectedReceipts = matching.length === 1 ? storageReceipts.filter(row => {
    const request = JSON.parse(Buffer.from(row.requestHex, 'hex').toString('utf8'))
    return request.method === 'processAction' && request.params?.[1]?.txid === matching[0]!.txid
  }) : []
  return { window: { policy: todoSubmissionBinding, startIndex, endIndex: submissions.length, receiptStartIndex, receiptEndIndex: receipts.length, startedAt, endedAt,
    faultTarget: { kind: 'exact-output', lockingScript, amount: 2, excludedTxids }, submissions: rows, storageReceipts,
    selection: matching.length === 1 ? 'unique' : matching.length === 0 ? 'none' : 'ambiguous', selectedIndices: matching.map(row => row.index) },
    submissions: matching.map(({ index: _index, ...row }) => row), storageReceipts: selectedReceipts }
}

/** Independent selection from captured complete windows. With the global
 * transcript supplied by native admission, every index and byte is joined too. */
export function verifyLifecycleSubmissionBinding(report: any, globalSubmissions?: any[]): void {
  assert.equal(report.submissionBinding, todoSubmissionBinding)
  let previousEnd: number | undefined, previousReceiptEnd: number | undefined, previousTime: number | undefined
  for (const entry of report.cases) {
    const window = entry.submissionWindow, script = entry.args.outputs[0].lockingScript
    assert.equal(window.policy, todoSubmissionBinding)
    for (const name of ['startIndex', 'endIndex', 'receiptStartIndex', 'receiptEndIndex']) assert.ok(Number.isSafeInteger(window[name]) && window[name] >= 0)
    assert.equal(window.endIndex - window.startIndex, window.submissions.length)
    assert.equal(window.receiptEndIndex - window.receiptStartIndex, window.storageReceipts.length)
    if (previousEnd !== undefined) { assert.equal(window.startIndex, previousEnd); assert.equal(window.receiptStartIndex, previousReceiptEnd) }
    const start = Date.parse(window.startedAt), end = Date.parse(window.endedAt)
    assert.ok(Number.isFinite(start) && Number.isFinite(end) && end >= start && (previousTime === undefined || start >= previousTime))
    previousEnd = window.endIndex; previousReceiptEnd = window.receiptEndIndex; previousTime = end
    const target = window.faultTarget
    assert.equal(target.kind, 'exact-output'); assert.equal(target.lockingScript, script); assert.equal(target.amount, 2)
    assert.ok(Array.isArray(target.excludedTxids) && target.excludedTxids.every((id: any) => typeof id === 'string' && /^[0-9a-f]{64}$/.test(id)))
    assert.equal(new Set(target.excludedTxids).size, target.excludedTxids.length)
    if (globalSubmissions) {
      assert.ok(window.endIndex <= globalSubmissions.length)
      assert.deepEqual(target.excludedTxids, [...new Set(globalSubmissions.slice(0, window.startIndex).map(row => row.txid))])
    }
    const matched: any[] = []
    for (const [offset, row] of window.submissions.entries()) {
      assert.equal(row.index, window.startIndex + offset); assert.ok(['ACCEPTED_BY_NETWORK', 'REJECTED'].includes(row.verdict))
      assert.ok(Array.isArray(row.bytes) && row.bytes.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 255))
      assert.equal(row.sha256, sha256Hex(Uint8Array.from(row.bytes)))
      if (globalSubmissions) assert.deepEqual(globalSubmissions[row.index], { txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') })
      let tx: Transaction
      try { tx = Transaction.fromAtomicBEEF(row.bytes) } catch { tx = Transaction.fromBinary(row.bytes) }
      assert.equal(tx.id('hex'), row.txid)
      if (target.excludedTxids.includes(row.txid)) continue
      let matchingOutputs = 0
      for (const output of tx.outputs) if (output.lockingScript.toHex() === script && output.satoshis === 2) matchingOutputs++
      if (matchingOutputs === 1) matched.push(row)
      else assert.equal(matchingOutputs, 0, 'Ambiguous exact-output transaction cannot be selected')
    }
    assert.equal(window.selection, matched.length === 1 ? 'unique' : matched.length === 0 ? 'none' : 'ambiguous')
    assert.deepEqual(window.selectedIndices, matched.map(row => row.index))
    assert.deepEqual(entry.submissions, matched.map(({ index: _index, ...row }) => row))
    const correlated = []
    for (const [offset, row] of window.storageReceipts.entries()) {
      assert.equal(row.sequence, window.receiptStartIndex + offset)
      for (const part of ['request', 'response']) { assert.match(row[`${part}Hex`], /^(?:[0-9a-f]{2})+$/); assert.equal(row[`${part}Sha256`], sha256Hex(Buffer.from(row[`${part}Hex`], 'hex'))) }
      const request = JSON.parse(Buffer.from(row.requestHex, 'hex').toString('utf8'))
      if (matched.length === 1 && request.method === 'processAction' && request.params?.[1]?.txid === matched[0].txid) correlated.push(row)
    }
    assert.deepEqual(entry.storageReceipts, correlated)
  }
}
