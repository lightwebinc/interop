import { PushDrop, Transaction, Utils } from '@bsv/sdk'

export type SubmissionVerdict = 'ACCEPTED_BY_NETWORK' | 'REJECTED'
export type SubmissionTarget = { amount: number } & ({ kind: 'todo-output'; protocol: string } | { kind: 'exact-output'; lockingScript: string })

/** A scoped fault remains queued across unrelated traffic. Existing unscoped
 * callers retain their original next-submission behavior. */
export class SubmissionVerdicts {
  private readonly entries: { verdict: SubmissionVerdict; target?: SubmissionTarget; excluded: Set<string> }[]
  constructor(initial: SubmissionVerdict[]) { this.entries = initial.map(verdict => ({ verdict, excluded: new Set() })) }
  enqueue(verdict: SubmissionVerdict, target?: SubmissionTarget, previouslyObserved: string[] = []): void {
    this.entries.push({ verdict, ...(target ? { target: structuredClone(target) } : {}), excluded: new Set(previouslyObserved) })
  }
  discard(verdict: SubmissionVerdict): boolean {
    const index = this.entries.findIndex(row => row.verdict === verdict)
    if (index < 0) return false
    this.entries.splice(index, 1); return true
  }
  consume(txid: string, bytes: Uint8Array): SubmissionVerdict {
    const next = this.entries[0]
    if (!next) return 'ACCEPTED_BY_NETWORK'
    if (next.target) {
      if (next.excluded.has(txid)) return 'ACCEPTED_BY_NETWORK'
      let tx: Transaction
      try { tx = Transaction.fromAtomicBEEF([...bytes]) } catch { tx = Transaction.fromBinary([...bytes]) }
      if (tx.id('hex') !== txid) throw new Error('Scheduled submission target has inconsistent transaction bytes')
      const target = next.target
      const matches = tx.outputs.filter(output => {
        if (output.satoshis !== target.amount) return false
        if (target.kind === 'exact-output') return output.lockingScript.toHex() === target.lockingScript
        try { const fields = PushDrop.decode(output.lockingScript).fields; return Utils.toUTF8(fields[0]!) === target.protocol && fields[1]!.length > 0 } catch { return false }
      })
      if (matches.length !== 1) return 'ACCEPTED_BY_NETWORK'
    }
    this.entries.shift(); return next.verdict
  }
}
