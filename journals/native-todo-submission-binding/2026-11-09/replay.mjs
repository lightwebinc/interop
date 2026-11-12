// This reconstructs diagnostic windows; it does not manufacture runtime evidence.
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { register } from '../../../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { bindTodoSubmissionWindow, todoSubmissionBinding } = await import('../../../synthesis/src/wallet-lab/native/todo-submission-binding.ts')
const { verifyTodoSubmissionBinding } = await import('../../../synthesis/src/wallet-lab/native/verify-todo-submission-binding.ts')
const summary = JSON.parse(fs.readFileSync(new URL('summary.json', import.meta.url)))
const bytes = fs.readFileSync(new URL(summary.fixture.path, import.meta.url))
assert.equal(bytes.length, summary.fixture.size)
assert.equal(createHash('sha256').update(bytes).digest('hex'), summary.fixture.sha256)
const fixture = JSON.parse(gunzipSync(bytes)), results = []
for (const captured of fixture.repetitions) {
  const report = { submissionBinding: todoSubmissionBinding }
  for (const [index, phase] of ['accepted', 'rejected', 'recovered'].entries()) {
    const [start, end] = captured.diagnosticWindows[index]
    const rows = captured.globalReceipts.slice(0, end).map(row => ({ ...row, bytes: [...Buffer.from(row.beefHex, 'hex')] }))
    const window = bindTodoSubmissionWindow(rows, start, `${captured.task} ${phase}`, new Date(index * 2000).toISOString(), new Date(index * 2000 + 1000).toISOString())
    const selected = window.receipts.find(row => row.index === window.selectedIndex)
    report[phase] = { submissionWindow: window, submission: { txid: selected.txid, verdict: selected.verdict, sha256: selected.sha256 } }
  }
  verifyTodoSubmissionBinding(report, captured.globalReceipts, captured.task)
  const projected = captured.observedProjection
  const predicates = {
    accepted: report.accepted.submission.verdict === 'ACCEPTED_BY_NETWORK' && projected.accepted.body.includes('Task successfully created!'),
    rejected: report.rejected.submission.verdict === 'REJECTED' && projected.rejected.totalOutputs === projected.accepted.totalOutputs,
    recovered: report.recovered.submission.verdict === 'ACCEPTED_BY_NETWORK' && projected.recovered.totalOutputs === projected.accepted.totalOutputs + 1
  }
  assert.ok(Object.values(predicates).every(Boolean))
  results.push({ repetition: captured.repetition, originalReportedRejectedSelection: captured.originalSubmissions.rejected,
    independentlySelected: Object.fromEntries(['accepted', 'rejected', 'recovered'].map(phase => [phase, report[phase].submission])),
    reconstructedWindowPredicates: predicates,
    warning: 'Phase boundaries and diagnostic timestamps were reconstructed for this engineering replay. They were not captured by the native run, which remains unchanged and unqualified.' })
}
console.log(JSON.stringify({ schema: 'tpnil-todo-binding-diagnostic@1', claim: 'ENGINEERING_RECONSTRUCTION_NOT_NATIVE_QUALIFICATION', sourceRun: summary.sourceRun, originalArchive: summary.originalArchive, results }, null, 2))
