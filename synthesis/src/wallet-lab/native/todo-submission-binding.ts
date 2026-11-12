import { PushDrop, Transaction, Utils } from '@bsv/sdk'
import { sha256Hex } from '../../determinism.js'

export const todoSubmissionBinding = 'tpnil-native-todo-submission-binding@1.0.0'
export const todoProtocol = '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG'
export interface TodoSubmissionReceipt { index: number; txid: string; verdict: 'ACCEPTED_BY_NETWORK' | 'REJECTED'; sha256: string; serializedHex: string }
export interface TodoSubmissionWindow {
  policy: typeof todoSubmissionBinding; task: string; amount: 2; startedAt: string; endedAt: string
  startIndex: number; endIndex: number; receipts: TodoSubmissionReceipt[]
  faultTarget: { kind: 'todo-output'; protocol: string; amount: 2; excludedTxids: string[] }
  selection: 'unique' | 'none' | 'ambiguous'; selectedIndex?: number; selectedOutputIndex?: number
}

/** Observe every receipt in the phase. The expected service verdict never
 * participates in identifying the application's transaction. */
export function bindTodoSubmissionWindow(submissions: readonly { txid: string; verdict: 'ACCEPTED_BY_NETWORK' | 'REJECTED'; bytes: Uint8Array | number[] }[], startIndex: number, task: string, startedAt: string, endedAt: string): TodoSubmissionWindow {
  const receipts = submissions.slice(startIndex).map((row, offset) => ({ index: startIndex + offset, txid: row.txid, verdict: row.verdict, sha256: sha256Hex(Uint8Array.from(row.bytes)), serializedHex: Buffer.from(row.bytes).toString('hex') }))
  const candidates: { index: number; output: number }[] = []
  const previous = new Set(submissions.slice(0, startIndex).map(row => row.txid))
  for (const row of receipts) {
    const bytes = [...Buffer.from(row.serializedHex, 'hex')]
    let transaction: Transaction
    try { transaction = Transaction.fromAtomicBEEF(bytes) } catch { transaction = Transaction.fromBinary(bytes) }
    if (transaction.id('hex') !== row.txid) throw new Error('Controlled submission transaction ID differs from serialized bytes')
    if (previous.has(row.txid)) continue
    transaction.outputs.forEach((output, index) => {
      if (output.satoshis !== 2) return
      try {
        const fields = PushDrop.decode(output.lockingScript).fields
        if (Utils.toUTF8(fields[0]!) === todoProtocol && fields[1]!.length > 0) candidates.push({ index: row.index, output: index })
      } catch { /* An unrelated output is not a ToDo candidate. */ }
    })
  }
  return { policy: todoSubmissionBinding, task, amount: 2, startedAt, endedAt, startIndex, endIndex: submissions.length, receipts,
    faultTarget: { kind: 'todo-output', protocol: todoProtocol, amount: 2, excludedTxids: [...new Set(submissions.slice(0, startIndex).map(row => row.txid))] },
    selection: candidates.length === 1 ? 'unique' : candidates.length === 0 ? 'none' : 'ambiguous',
    ...(candidates.length === 1 ? { selectedIndex: candidates[0]!.index, selectedOutputIndex: candidates[0]!.output } : {}) }
}
