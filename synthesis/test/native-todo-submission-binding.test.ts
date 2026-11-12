import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import os from 'node:os'
import { expect, it } from 'vitest'
import { Transaction } from '@bsv/sdk'
import { bindTodoSubmissionWindow, todoSubmissionBinding } from '../src/wallet-lab/native/todo-submission-binding.js'
import { verifyTodoSubmissionBinding } from '../src/wallet-lab/native/verify-todo-submission-binding.js'
import { SubmissionVerdicts } from '../src/wallet-lab/submission-verdicts.js'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'

const directory = path.resolve(import.meta.dirname, '../../journals/native-todo-submission-binding/2026-11-09')
const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
const bytes = fs.readFileSync(path.join(directory, summary.fixture.path))
expect(bytes.length).toBe(summary.fixture.size)
expect(createHash('sha256').update(bytes).digest('hex')).toBe(summary.fixture.sha256)
const fixture = JSON.parse(gunzipSync(bytes).toString())
const phases = ['accepted', 'rejected', 'recovered']
function reconstructed(repetition = 0) {
  const captured = structuredClone(fixture.repetitions[repetition]), submissions = captured.globalReceipts
  const report: any = { submissionBinding: todoSubmissionBinding }
  for (const [index, phase] of phases.entries()) {
    const [start, end] = captured.diagnosticWindows[index]
    const rows = submissions.slice(0, end).map((row: any) => ({ ...row, bytes: [...Buffer.from(row.beefHex, 'hex')] }))
    const window = bindTodoSubmissionWindow(rows, start, `${captured.task} ${phase}`, new Date(index * 2000).toISOString(), new Date(index * 2000 + 1000).toISOString())
    const selected = window.receipts.find(row => row.index === window.selectedIndex)
    report[phase] = { submissionWindow: window, ...(selected ? { submission: { txid: selected.txid, verdict: selected.verdict, sha256: selected.sha256 } } : {}) }
  }
  return { report, submissions, captured }
}

it('replays both actual receipt sequences without treating the reconstruction as native qualification', () => {
  expect(fixture.claim).toBe('ENGINEERING_RECONSTRUCTION_NOT_NATIVE_QUALIFICATION')
  for (const repetition of [0, 1]) {
    const { report, submissions, captured } = reconstructed(repetition)
    expect(verifyTodoSubmissionBinding(report, submissions, captured.task)).toEqual([submissions[4].txid, submissions[5].txid, submissions[7].txid])
    expect(report.rejected.submission.verdict).toBe('REJECTED')
    expect(captured.originalSubmissions.rejected.txid).toBe(submissions[6].txid)
    expect(captured.originalSubmissions.rejected.verdict).toBe('ACCEPTED_BY_NETWORK')
    expect(report.rejected.submissionWindow.receipts).toHaveLength(2)
  }
})

it('selects the application output before or after unrelated background submissions, never by verdict', () => {
  const { submissions } = reconstructed()
  for (const rows of [[submissions[5], submissions[6]], [submissions[6], submissions[5]]]) {
    const window = bindTodoSubmissionWindow(rows.map(row => ({ ...row, bytes: [...Buffer.from(row.beefHex, 'hex')] })), 0, 'fixture', new Date(0).toISOString(), new Date(1).toISOString())
    expect(window.selection).toBe('unique')
    expect(window.receipts.find(row => row.index === window.selectedIndex)?.txid).toBe(submissions[5].txid)
  }
})

it('retains no-candidate and ambiguous windows as unselected observations; forged unique choices fail', () => {
  const { report, submissions, captured } = reconstructed()
  const ambiguous = structuredClone(submissions)
  ambiguous[6] = structuredClone(ambiguous[5])
  const window = bindTodoSubmissionWindow(ambiguous.slice(0, 7).map((row: any) => ({ ...row, bytes: [...Buffer.from(row.beefHex, 'hex')] })), 5, `${captured.task} rejected`, report.rejected.submissionWindow.startedAt, report.rejected.submissionWindow.endedAt)
  expect(window.selection).toBe('ambiguous'); expect(window.selectedIndex).toBeUndefined()
  report.rejected = { submissionWindow: window }
  report.recovered.submissionWindow.faultTarget.excludedTxids = [...new Set(ambiguous.slice(0, 7).map((row: any) => row.txid))]
  expect(verifyTodoSubmissionBinding(report, ambiguous, captured.task)).toHaveLength(2)
  report.rejected.submissionWindow.selection = 'unique'; report.rejected.submissionWindow.selectedIndex = 5
  expect(() => verifyTodoSubmissionBinding(report, ambiguous, captured.task)).toThrow()
  const empty = bindTodoSubmissionWindow([{ ...submissions[6], bytes: [...Buffer.from(submissions[6].beefHex, 'hex')] }], 0, 'fixture', new Date(0).toISOString(), new Date(1).toISOString())
  expect(empty.selection).toBe('none'); expect(empty.selectedIndex).toBeUndefined()
})

it('rejects receipt omission, changed windows, selected background rows, bytes, hashes, IDs and verdict tampering', () => {
  const mutations: ((report: any, submissions: any[]) => void)[] = [
    r => { r.rejected.submissionWindow.receipts.pop() },
    r => { r.rejected.submissionWindow.startIndex++ },
    r => { r.rejected.submissionWindow.endIndex-- },
    r => { r.recovered.submissionWindow.startIndex++ },
    r => { r.rejected.submissionWindow.selectedIndex = 6 },
    r => { r.rejected.submissionWindow.selectedOutputIndex++ },
    r => { r.rejected.submissionWindow.receipts[0].serializedHex += '00' },
    r => { r.rejected.submissionWindow.receipts[0].sha256 = '0'.repeat(64) },
    r => { r.rejected.submission.txid = '0'.repeat(64) },
    r => { r.rejected.submission.verdict = 'ACCEPTED_BY_NETWORK' },
    (_, s) => { s[5].verdict = 'ACCEPTED_BY_NETWORK' },
    (_, s) => { s[5].txid = '0'.repeat(64) },
    r => { r.rejected.submissionWindow.startedAt = r.rejected.submissionWindow.endedAt = new Date(0).toISOString() },
    r => { r.submissionBinding = 'unversioned' },
    r => { r.rejected.submissionWindow.faultTarget.excludedTxids = [] }
  ]
  for (const mutate of mutations) {
    const { report, submissions, captured } = reconstructed(); mutate(report, submissions)
    expect(() => verifyTodoSubmissionBinding(report, submissions, captured.task)).toThrow()
  }
})

const transaction = (row: any) => Transaction.fromBinary([...Buffer.from(row.beefHex, 'hex')])
it('targeted verdict ignores background traffic and old ToDo replays before consuming exactly one new matching submission', () => {
  const { submissions } = reconstructed(), queue = new SubmissionVerdicts([])
  queue.enqueue('REJECTED', { kind: 'todo-output', protocol: '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG', amount: 2 }, [submissions[4].txid])
  for (const index of [6, 4]) expect(queue.consume(submissions[index].txid, Buffer.from(submissions[index].beefHex, 'hex'))).toBe('ACCEPTED_BY_NETWORK')
  expect(queue.consume(submissions[5].txid, Buffer.from(submissions[5].beefHex, 'hex'))).toBe('REJECTED')
  expect(queue.consume(submissions[5].txid, Buffer.from(submissions[5].beefHex, 'hex'))).toBe('ACCEPTED_BY_NETWORK')
})

it('exact-script targeting ignores wrong amounts, unrelated scripts and ambiguous matching outputs', () => {
  const { submissions } = reconstructed(), target = transaction(submissions[5]), queue = new SubmissionVerdicts([])
  queue.enqueue('REJECTED', { kind: 'exact-output', lockingScript: target.outputs[0]!.lockingScript.toHex(), amount: 2 })
  const wrongAmount = transaction(submissions[5]); wrongAmount.outputs[0]!.satoshis = 3
  const ambiguous = transaction(submissions[5]); ambiguous.outputs.push({ ...ambiguous.outputs[0]! })
  for (const tx of [transaction(submissions[6]), wrongAmount, ambiguous]) expect(queue.consume(tx.id('hex'), tx.toUint8Array())).toBe('ACCEPTED_BY_NETWORK')
  expect(queue.consume(target.id('hex'), target.toUint8Array())).toBe('REJECTED')
})

it('preserves legacy unscoped ordering and permits scoped fault retirement without changing a submitted verdict', () => {
  const { submissions } = reconstructed(), background = transaction(submissions[6]), queue = new SubmissionVerdicts(['REJECTED', 'ACCEPTED_BY_NETWORK'])
  expect(queue.consume(background.id('hex'), background.toUint8Array())).toBe('REJECTED')
  expect(queue.consume(background.id('hex'), background.toUint8Array())).toBe('ACCEPTED_BY_NETWORK')
  queue.enqueue('REJECTED', { kind: 'todo-output', protocol: 'unmatched', amount: 2 })
  expect(queue.consume(background.id('hex'), background.toUint8Array())).toBe('ACCEPTED_BY_NETWORK')
  expect(queue.discard('REJECTED')).toBe(true); expect(queue.discard('REJECTED')).toBe(false)
})

it('enforces scoped targeting on the real loopback Go submission endpoint and retains every background receipt', async () => {
  const webroot = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-verdict-binding-'))
  fs.writeFileSync(path.join(webroot, 'index.html'), '<title>Fixture</title>')
  const service = new ControlledWalletServices({ webroot }), { submissions } = reconstructed()
  try {
    await service.start()
    service.enqueueVerdict('REJECTED', { kind: 'todo-output', protocol: '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG', amount: 2 })
    for (const [index, status] of [[6, 200], [5, 400], [6, 200]]) {
      const response = await fetch(service.serviceUrl + '/tpnil/submit', { method: 'POST', body: transaction(submissions[index!]).toHex() })
      expect(response.status).toBe(status)
    }
    expect(service.submissions.map(row => row.verdict)).toEqual(['ACCEPTED_BY_NETWORK', 'REJECTED', 'ACCEPTED_BY_NETWORK'])
    expect(service.submissions.map(row => row.txid)).toEqual([submissions[6].txid, submissions[5].txid, submissions[6].txid])
  } finally { await service.close(); fs.rmSync(webroot, { recursive: true, force: true }) }
}, 20_000)

it('rejects coherent receipt hash changes when serialized bytes do not match the transaction ID', () => {
  const { report, submissions, captured } = reconstructed()
  const tx = Transaction.fromBinary([...Buffer.from(submissions[5].beefHex, 'hex')]); tx.outputs[0]!.satoshis = 3
  const changed = tx.toHex(), hash = createHash('sha256').update(Buffer.from(changed, 'hex')).digest('hex')
  submissions[5].beefHex = changed
  Object.assign(report.rejected.submissionWindow.receipts[0], { serializedHex: changed, sha256: hash })
  report.rejected.submission.sha256 = hash
  expect(() => verifyTodoSubmissionBinding(report, submissions, captured.task)).toThrow(/txid does not match/)
})
