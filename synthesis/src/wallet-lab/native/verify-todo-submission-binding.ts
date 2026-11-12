import assert from 'node:assert/strict'
import { PushDrop, Transaction, Utils } from '@bsv/sdk'
import { sha256Hex } from '../../determinism.js'
import { todoProtocol, todoSubmissionBinding } from './todo-submission-binding.js'

/** Recompute selection from the complete global receipt slice, independently
 * of the producer's chosen transaction and expected service verdict. */
export function verifyTodoSubmissionBinding(report: any, submissions: any[], task: string): string[] {
  assert.equal(report.submissionBinding, todoSubmissionBinding)
  const selected: string[] = []
  let endIndex: number | undefined, endedAt: number | undefined
  for (const phase of ['accepted', 'rejected', 'recovered']) {
    const observed = report[phase], window = observed.submissionWindow
    assert.equal(window.policy, todoSubmissionBinding); assert.equal(window.task, `${task} ${phase}`); assert.equal(window.amount, 2)
    assert.ok(Number.isSafeInteger(window.startIndex) && window.startIndex >= 0)
    assert.ok(Number.isSafeInteger(window.endIndex) && window.endIndex >= window.startIndex && window.endIndex <= submissions.length)
    assert.deepEqual(window.faultTarget, { kind: 'todo-output', protocol: todoProtocol, amount: 2, excludedTxids: [...new Set(submissions.slice(0, window.startIndex).map(row => row.txid))] })
    if (endIndex !== undefined) assert.equal(window.startIndex, endIndex, 'Lifecycle receipt windows must be contiguous')
    const start = Date.parse(window.startedAt), end = Date.parse(window.endedAt)
    assert.ok(Number.isFinite(start) && Number.isFinite(end) && end >= start)
    if (endedAt !== undefined) assert.ok(start >= endedAt)
    endIndex = window.endIndex; endedAt = end
    const receipts = submissions.slice(window.startIndex, window.endIndex)
    assert.equal(window.receipts.length, receipts.length, 'Phase omitted a controlled submission')
    const candidates: { index: number; output: number; txid: string; verdict: string; sha256: string }[] = []
    for (const [offset, receipt] of receipts.entries()) {
      assert.match(receipt.beefHex, /^(?:[0-9a-f]{2})+$/)
      assert.ok(['ACCEPTED_BY_NETWORK', 'REJECTED'].includes(receipt.verdict))
      const bytes = Buffer.from(receipt.beefHex, 'hex'), digest = sha256Hex(bytes), index = window.startIndex + offset
      assert.deepEqual(window.receipts[offset], { index, txid: receipt.txid, verdict: receipt.verdict, sha256: digest, serializedHex: receipt.beefHex })
      let tx: Transaction
      try { tx = Transaction.fromAtomicBEEF([...bytes]) } catch { tx = Transaction.fromBinary([...bytes]) }
      assert.equal(tx.id('hex'), receipt.txid, 'Global submission txid does not match its bytes')
      if (window.faultTarget.excludedTxids.includes(receipt.txid)) continue
      for (const [output, value] of tx.outputs.entries()) {
        let fields: number[][]
        try { fields = PushDrop.decode(value.lockingScript).fields } catch { continue }
        if (value.satoshis === 2 && fields.length >= 2 && Utils.toUTF8(fields[0]!) === todoProtocol && fields[1]!.length > 0)
          candidates.push({ index, output, txid: receipt.txid, verdict: receipt.verdict, sha256: digest })
      }
    }
    const selection = candidates.length === 1 ? 'unique' : candidates.length === 0 ? 'none' : 'ambiguous'
    assert.equal(window.selection, selection)
    if (candidates.length === 1) {
      const candidate = candidates[0]!
      assert.equal(window.selectedIndex, candidate.index); assert.equal(window.selectedOutputIndex, candidate.output)
      assert.deepEqual(observed.submission, { txid: candidate.txid, verdict: candidate.verdict, sha256: candidate.sha256 })
      selected.push(candidate.txid)
    } else {
      assert.equal(window.selectedIndex, undefined); assert.equal(window.selectedOutputIndex, undefined); assert.equal(observed.submission, undefined, 'Missing or ambiguous ToDo receipt cannot select a transaction')
    }
  }
  return selected
}
