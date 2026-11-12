import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { lifecycleOracleId, runConformanceLifecycle } from '../src/wallet-lab/native/conformance-lifecycle.js'
import { verifyConformanceLifecycle } from '../src/wallet-lab/native/verify-conformance-lifecycle.js'
import { verifyLifecycleSubmissionBinding } from '../src/wallet-lab/native/lifecycle-submission-binding.js'
import { todoSubmissionBinding } from '../src/wallet-lab/native/todo-submission-binding.js'

const archive = path.resolve(import.meta.dirname, '../../journals/integrated-native-attempts/2026-11-09/42680240116/native-integrated.zip')
expect(createHash('sha256').update(fs.readFileSync(archive)).digest('hex')).toBe('264ba858b5618574c3aea189425d22c5cbb47c91a1ae361b618609cc17d38e49')
const read = (repetition: number, file: string) => JSON.parse(execFileSync('unzip', ['-p', archive, `repetition-${repetition}/evidence/${file}`], { maxBuffer: 16 * 1024 * 1024 }).toString())

// Captured wallet calls are replayed with deliberately injected background
// receipts. This is an observer test, never a new native execution.
async function replay(repetition = 1, ambiguous = false) {
  const original = read(repetition, 'conformance/lifecycle.json'), global = read(repetition, 'native-submissions.json')
  const background = global[6]
  let position = 0, phase = 0
  const services: any = { submissions: [], storageProcessActionReceipts: [], componentIdentity: original.serviceIdentity,
    enqueueVerdict: (verdict: string, target: any) => {
      expect(verdict).toBe(original.cases[phase].scheduledVerdict)
      expect(target).toEqual({ kind: 'exact-output', lockingScript: original.cases[phase].args.outputs[0].lockingScript, amount: 2 })
    }, discardQueuedVerdict: () => { throw new Error('The exact target was submitted') } }
  const wallet = new Proxy({}, { get: (_object, method) => async (args: any) => {
    const row = original.trace[position++]
    expect(method).toBe(row.method); expect(args).toEqual(row.args)
    if (method === 'createAction') {
      const current = original.cases[phase]
      const unrelatedRpc = structuredClone(original.cases[phase === 0 ? 1 : 0].storageReceipts[0])
      unrelatedRpc.sequence = services.storageProcessActionReceipts.length
      services.storageProcessActionReceipts.push(unrelatedRpc)
      services.submissions.push({ ...background, bytes: Uint8Array.from(Buffer.from(background.beefHex, 'hex')) })
      const target = current.submissions.map((value: any) => ({ ...structuredClone(value), bytes: Uint8Array.from(value.bytes) }))
      services.submissions.push(...target)
      if (ambiguous && phase === 0) services.submissions.push(...target)
      services.submissions.push({ ...background, bytes: Uint8Array.from(Buffer.from(background.beefHex, 'hex')) })
      for (const receipt of current.storageReceipts) services.storageProcessActionReceipts.push({ ...structuredClone(receipt), sequence: services.storageProcessActionReceipts.length })
      phase++
    }
    if (row.error) throw Object.assign(new Error(row.error.message), row.error)
    return structuredClone(row.result)
  } })
  const report = await runConformanceLifecycle(wallet, services, { receiptMode: 'storage-rpc', oracle: lifecycleOracleId, submissionBinding: todoSubmissionBinding })
  expect(position).toBe(original.trace.length)
  const submissions = services.submissions.map((row: any) => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') }))
  return { original, report, submissions }
}

it('retains both original native5 schema3 reports and verifies explicit scoped replay despite background submissions and RPCs', async () => {
  for (const repetition of [1, 2]) {
    const { original, report, submissions } = await replay(repetition), before = JSON.stringify(original)
    expect(original.submissionBinding).toBeUndefined()
    expect((await verifyConformanceLifecycle(original)).result).toBe('PASS')
    expect((await verifyConformanceLifecycle(report)).result).toBe('PASS')
    verifyLifecycleSubmissionBinding(report, submissions)
    for (const entry of report.cases) {
      expect(entry.submissionWindow.submissions).toHaveLength(3)
      expect(entry.submissionWindow.storageReceipts).toHaveLength(2)
      expect(entry.submissions).toHaveLength(1); expect(entry.storageReceipts).toHaveLength(1)
    }
    expect(JSON.stringify(original)).toBe(before)
  }
})

it('rejects corrupted windows, selection, global bytes/verdicts and unversioned or mismatched RPC correlation', async () => {
  const reference = await replay()
  const mutations: ((report: any, submissions: any[]) => void)[] = [
    r => { r.cases[0].submissionWindow.submissions.pop() },
    r => { r.cases[1].submissionWindow.startIndex++ },
    r => { r.cases[1].submissionWindow.receiptStartIndex++ },
    r => { r.cases[0].submissionWindow.selectedIndices = [0] },
    r => { r.cases[0].submissions[0].verdict = 'REJECTED' },
    r => { r.cases[0].submissionWindow.submissions[0].bytes[0] ^= 1 },
    (_, s) => { s[0].verdict = 'REJECTED' },
    (_, s) => { s[0].beefHex += '00' },
    r => { r.cases[0].storageReceipts = [r.cases[0].submissionWindow.storageReceipts[0]] },
    r => { r.cases[0].submissionWindow.storageReceipts[0].requestSha256 = '00'.repeat(32) },
    r => { r.cases[0].submissionWindow.faultTarget.lockingScript = '51' },
    r => { r.cases[1].submissionWindow.faultTarget.excludedTxids = [] },
    r => { r.submissionBinding = undefined },
    r => { r.cases[1].submissionWindow.startedAt = new Date(0).toISOString() }
  ]
  for (const mutate of mutations) {
    const { report, submissions } = structuredClone(reference); mutate(report, submissions)
    expect(() => verifyLifecycleSubmissionBinding(report, submissions)).toThrow()
  }
  const unversioned = structuredClone(reference.report); delete unversioned.submissionBinding
  await expect(verifyConformanceLifecycle(unversioned)).rejects.toThrow('Unversioned lifecycle submission window')
})

it('retains ambiguous exact-script candidates and never upgrades them to a passing observation', async () => {
  const { report, submissions } = await replay(1, true)
  expect(report.cases[0].submissionWindow.selection).toBe('ambiguous')
  expect(report.cases[0].submissions).toHaveLength(2)
  expect(report.result).toBe('FAIL')
  verifyLifecycleSubmissionBinding(report, submissions)
  await expect(verifyConformanceLifecycle(report)).rejects.toThrow('Exactly one causal submission')
})
