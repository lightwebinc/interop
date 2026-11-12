import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { verifyConformanceLifecycle } from '../src/wallet-lab/native/verify-conformance-lifecycle.js'
import { lifecycleOracleId, runConformanceLifecycle } from '../src/wallet-lab/native/conformance-lifecycle.js'
import { EvidenceBundle } from '../src/wallet-lab/evidence.js'

const directory = path.resolve(import.meta.dirname, '../../journals/native-lifecycle-reference/2026-11-09')
const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
const bytes = fs.readFileSync(path.join(directory, summary.archive.path))
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
expect(bytes.length).toBe(summary.archive.size); expect(sha(bytes)).toBe(summary.archive.sha256)
const archive = JSON.parse(gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }).toString())
const files = new Map<string, string>()
for (const row of archive.files) {
  expect(files.has(row.path)).toBe(false)
  expect(Buffer.byteLength(row.content)).toBe(row.size); expect(sha(Buffer.from(row.content))).toBe(row.sha256)
  files.set(row.path, row.content)
}
const report = (name = 'go-corrected') => JSON.parse(files.get(`${name}/lifecycle.json`)!)

it('independently verifies actual TS and Go storage rejection/recovery evidence and the original Go failures', async () => {
  for (const name of ['typescript-corrected', 'go-corrected']) expect((await verifyConformanceLifecycle(report(name))).result).toBe('PASS')
  const original = await verifyConformanceLifecycle(report('go-original-host'))
  expect(original.assertions.map((row: any) => row.result)).toEqual(['PASS', 'FAIL', 'FAIL'])
})

it('survives the actual outer canonical evidence writer without changing requests or outcomes', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-lifecycle-evidence-'))
  try {
    for (const [index, input] of [report(), policyReport()].entries()) {
      const evidence = new EvidenceBundle(temporary)
      const name = `lifecycle-${index}.json`
      evidence.addJson(name, input); evidence.flush()
      const observed = JSON.parse(fs.readFileSync(path.join(temporary, 'evidence', name), 'utf8'))
      expect((await verifyConformanceLifecycle(observed)).result).toBe('PASS')
      expect(observed.cases[0].args.options).toEqual({ acceptDelayedBroadcast: false, randomizeOutputs: false })
    }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
})

it('rejects forged PASS on original retryable service-error behavior', async () => {
  const changed = report('go-original-host')
  changed.result = 'PASS'; for (const row of changed.assertions) row.result = 'PASS'
  await expect(verifyConformanceLifecycle(changed)).rejects.toThrow(/verdicts differ/)
})

it('rejects same-count substitutions and metadata loss after the rejection', async () => {
  for (const mutate of [(row: any) => { row.outpoint = `${'ab'.repeat(32)}.0` }, (row: any) => { row.tags = [] }]) {
    const changed = report(); mutate(changed.cases[1].outputs.outputs[0]); changed.trace[9].result = structuredClone(changed.cases[1].outputs)
    await expect(verifyConformanceLifecycle(changed)).rejects.toThrow(/verdicts differ/)
  }
})

it('rejects terminal-failure claims backed only by a retryable or unrelated error', async () => {
  for (const mutate of [(error: any) => { error.reviewActionResults[0].status = 'serviceError' }, (error: any) => { error.txid = 'ab'.repeat(32) }, (error: any) => { error.message = 'Network error: timeout' }]) {
    const changed = report(); mutate(changed.cases[1].error); changed.trace[8].error = structuredClone(changed.cases[1].error)
    await expect(verifyConformanceLifecycle(changed)).rejects.toThrow(/verdicts differ/)
  }
})

it('rejects missing ancestry, altered submission bytes and delayed broadcast substitutions', async () => {
  const missing = report(); missing.transactions[1].beef = []
  await expect(verifyConformanceLifecycle(missing)).rejects.toThrow()
  const bytes = report(); bytes.cases[0].submissions[0].bytes[0] ^= 1; bytes.cases[0].submissions[0].sha256 = sha(Uint8Array.from(bytes.cases[0].submissions[0].bytes))
  await expect(verifyConformanceLifecycle(bytes)).rejects.toThrow()
  const delayed = report(); delayed.cases[0].args.options.acceptDelayedBroadcast = true; delayed.trace[4].args = structuredClone(delayed.cases[0].args)
  await expect(verifyConformanceLifecycle(delayed)).rejects.toThrow()
})

it('requires one correlated service verdict per operation and the complete public trace', async () => {
  const duplicate = report(); duplicate.cases[1].submissions.push(structuredClone(duplicate.cases[1].submissions[0]))
  await expect(verifyConformanceLifecycle(duplicate)).rejects.toThrow(/Exactly one/)
  const missing = report(); missing.trace.splice(8, 1)
  await expect(verifyConformanceLifecycle(missing)).rejects.toThrow()
})

const policySummary = JSON.parse(fs.readFileSync(path.join(directory, 'terminal-policy/summary.json'), 'utf8'))
const policyBytes = fs.readFileSync(path.join(directory, 'terminal-policy', policySummary.archive.path))
expect(policyBytes.length).toBe(policySummary.archive.size); expect(sha(policyBytes)).toBe(policySummary.archive.sha256)
const policyFiles = new Map<string, string>()
for (const row of JSON.parse(gunzipSync(policyBytes, { maxOutputLength: 16 * 1024 * 1024 }).toString()).files) {
  expect(policyFiles.has(row.path)).toBe(false); expect(Buffer.byteLength(row.content)).toBe(row.size); expect(sha(Buffer.from(row.content))).toBe(row.sha256)
  policyFiles.set(row.path, row.content)
}
const policyReport = (name = 'storage-receipts-message-only') => JSON.parse(policyFiles.get(`${name}/lifecycle.json`)!)

it('retains historical default failure while the same binary with explicit terminal policy passes', async () => {
  expect(new Set(policySummary.runs.map((run: any) => run.binarySha256)).size).toBe(1)
  expect((await verifyConformanceLifecycle(policyReport('legacy-policy'))).assertions.map((row: any) => row.result)).toEqual(['PASS', 'FAIL', 'FAIL'])
  expect((await verifyConformanceLifecycle(policyReport('terminal-policy'))).result).toBe('PASS')
})

it('uses the separate real storage receipt without inventing missing native-style error fields', async () => {
  const report = policyReport()
  expect(Object.keys(report.cases[1].error).sort()).toEqual(['message', 'name'])
  expect((await verifyConformanceLifecycle(report)).result).toBe('PASS')
  const historical = policyReport('terminal-policy')
  historical.cases[1].error = report.cases[1].error; historical.trace[8].error = report.cases[1].error
  await expect(verifyConformanceLifecycle(historical)).rejects.toThrow(/verdicts differ/)
})

it('rejects rebound storage receipts for another identity, request, transaction or retryable outcome', async () => {
  for (const mutation of ['identity', 'request', 'transaction', 'retryable', 'application-timeout']) {
    const report = policyReport(), receipt = report.cases[1].storageReceipts[0]
    if (mutation === 'identity') receipt.requestIdentityKey = '02' + 'ab'.repeat(32)
    else if (mutation === 'application-timeout') { report.cases[1].error.message = 'Network error: timeout'; report.trace[8].error = structuredClone(report.cases[1].error) }
    else {
      const side = mutation === 'transaction' ? 'request' : 'response'
      const body = JSON.parse(Buffer.from(receipt[`${side}Hex`], 'hex').toString())
      if (mutation === 'request') body.id = 'unrelated-rpc'
      else if (mutation === 'transaction') body.params[1].txid = 'ab'.repeat(32)
      else body.result.notDelayedResults[0].status = 'serviceError'
      const bytes = Buffer.from(JSON.stringify(body)); receipt[`${side}Hex`] = bytes.toString('hex'); receipt[`${side}Sha256`] = sha(bytes)
    }
    await expect(verifyConformanceLifecycle(report)).rejects.toThrow()
  }
})

function failedRecoveryReport() {
  const observed = policyReport(), recovered = observed.cases[2]
  delete recovered.result; delete observed.trace[12].result
  recovered.error = { name: 'Error', message: 'failed to process createAction: failed to create transaction: funding failed: not enough funds' }
  observed.trace[12].error = structuredClone(recovered.error)
  recovered.submissions = []; recovered.storageReceipts = []; recovered.unconsumedVerdictRemoved = true
  recovered.outputs = structuredClone(observed.cases[1].outputs); recovered.actions = structuredClone(observed.cases[1].actions)
  observed.trace[13].result = structuredClone(recovered.outputs); observed.trace[14].result = structuredClone(recovered.actions)
  observed.transactions = observed.transactions.filter((row: any) => row.phase !== 'recovered')
  observed.assertions[2].result = 'FAIL'; observed.result = 'FAIL'
  return observed
}

it('retains a complete pre-broadcast recovery failure without inventing a submission or relaxing PASS', async () => {
  const observed = failedRecoveryReport(), verified = await verifyConformanceLifecycle(observed)
  expect(verified.result).toBe('FAIL')
  expect(verified.assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'FAIL'])
  expect(verified.transactions).toHaveLength(2)
  observed.assertions[2].result = 'PASS'; observed.result = 'PASS'
  await expect(verifyConformanceLifecycle(observed)).rejects.toThrow(/verdicts differ/)
})

it('requires the failed public call, unused verdict cleanup and absence of fake proof for an unsubmitted operation', async () => {
  for (const mutate of [
    (report: any) => { delete report.cases[2].error; delete report.trace[12].error },
    (report: any) => { report.cases[2].unconsumedVerdictRemoved = false },
    (report: any) => { report.transactions.push({ phase: 'recovered', txid: 'ab'.repeat(32), beef: [] }) },
    (report: any) => { report.cases[2].storageReceipts = [report.cases[0].storageReceipts[0]] }
  ]) {
    const observed = failedRecoveryReport(); mutate(observed)
    await expect(verifyConformanceLifecycle(observed)).rejects.toThrow()
  }
})

it('independently retains both exact native run42667035861 recovery failures', async () => {
  const directory = path.resolve(import.meta.dirname, '../../journals/native-funding-reserve-reference/2026-11-09')
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
  const bytes = fs.readFileSync(path.join(directory, summary.archive.path))
  expect(bytes.length).toBe(summary.archive.size); expect(sha(bytes)).toBe(summary.archive.sha256)
  const archived = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString())
  for (const repetition of [1, 2]) {
    const row = archived.files.find((row: any) => row.path === `native-42667035861/repetition-${repetition}-lifecycle.json`)
    expect(Buffer.byteLength(row.content)).toBe(row.size); expect(sha(Buffer.from(row.content))).toBe(row.sha256)
    const report = JSON.parse(row.content), verified = await verifyConformanceLifecycle(report)
    expect(report.cases[2].submissions).toEqual([])
    expect(report.cases[2].error.message).toContain('funding failed: not enough funds')
    expect(verified.assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'FAIL'])
  }
})

const setDirectory = path.join(directory, 'metadata-sets')
const setSummary = JSON.parse(fs.readFileSync(path.join(setDirectory, 'summary.json'), 'utf8'))
const setBytes = fs.readFileSync(path.join(setDirectory, setSummary.archive.path))
expect(setBytes.length).toBe(setSummary.archive.size); expect(sha(setBytes)).toBe(setSummary.archive.sha256)
const setFiles = new Map<string, string>()
for (const row of JSON.parse(gunzipSync(setBytes, { maxOutputLength: 16 * 1024 * 1024 }).toString()).files) {
  expect(setFiles.has(row.path)).toBe(false); expect(Buffer.byteLength(row.content)).toBe(row.size); expect(sha(Buffer.from(row.content))).toBe(row.sha256)
  setFiles.set(row.path, row.content)
}
const nativeMetadataReport = (repetition = 1) => JSON.parse(setFiles.get(`native-42674638927/repetition-${repetition}-lifecycle.json`)!)

// Replay the actual captured public calls through the producer. This is an
// observer regression; it is deliberately not represented as new native proof.
async function replayCapturedLifecycle(observed: any, oracle?: typeof lifecycleOracleId) {
  let position = 0, currentCase = 0
  const services: any = { submissions: [], storageProcessActionReceipts: [], componentIdentity: observed.serviceIdentity,
    enqueueVerdict: (verdict: string) => { expect(verdict).toBe(observed.cases[currentCase].scheduledVerdict) },
    discardQueuedVerdict: () => { throw new Error('Captured native recovery did submit') } }
  const wallet = new Proxy({}, { get: (_target, method) => async (args: any) => {
    const row = observed.trace[position++]
    expect(method).toBe(row.method); expect(args).toEqual(row.args)
    if (method === 'createAction') {
      const entry = observed.cases[currentCase++]
      services.submissions.push(...structuredClone(entry.submissions).map((item: any) => ({ ...item, bytes: Uint8Array.from(item.bytes) })))
      services.storageProcessActionReceipts.push(...structuredClone(entry.storageReceipts))
    }
    if (row.error) throw Object.assign(new Error(row.error.message), row.error)
    return structuredClone(row.result)
  } })
  const result = await runConformanceLifecycle(wallet, services, { receiptMode: 'storage-rpc', ...(oracle ? { oracle } : {}) })
  expect(position).toBe(observed.trace.length); expect(currentCase).toBe(3)
  return result
}

it('preserves both native4 historical FAILs while explicit v3 producer and independent oracle correct only metadata set order', async () => {
  for (const repetition of [1, 2]) {
    const original = nativeMetadataReport(repetition), before = JSON.stringify(original)
    expect((await verifyConformanceLifecycle(original)).assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'FAIL'])
    const legacy = await replayCapturedLifecycle(original)
    expect(legacy.schema).toBe('tpnil-native-conformance-lifecycle@2'); expect(legacy.oracle).toBeUndefined()
    expect((await verifyConformanceLifecycle(legacy)).result).toBe('FAIL')
    const current = await replayCapturedLifecycle(original, lifecycleOracleId)
    expect(current.schema).toBe('tpnil-native-conformance-lifecycle@3'); expect(current.oracle).toBe(lifecycleOracleId)
    expect((await verifyConformanceLifecycle(current)).assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'PASS'])
    expect(current.trace).toEqual(original.trace); expect(current.cases).toEqual(original.cases)
    expect(JSON.stringify(original)).toBe(before)
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-lifecycle-v3-'))
    try {
      const bundle = new EvidenceBundle(temporary); bundle.addJson('lifecycle.json', current); bundle.flush()
      expect((await verifyConformanceLifecycle(JSON.parse(fs.readFileSync(path.join(temporary, 'evidence/lifecycle.json'), 'utf8')))).result).toBe('PASS')
    } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
    const archivedDiagnostic = JSON.parse(setFiles.get(`captured-native-v3-diagnostic/repetition-${repetition}-diagnostic.json`)!)
    expect(archivedDiagnostic.trace).toEqual(original.trace); expect(archivedDiagnostic.cases).toEqual(original.cases)
    expect((await verifyConformanceLifecycle(archivedDiagnostic)).result).toBe('PASS')
  }
  const freshReference = JSON.parse(setFiles.get('go-reference-v3/lifecycle.json')!)
  expect(freshReference.schema).toBe('tpnil-native-conformance-lifecycle@3')
  expect((await verifyConformanceLifecycle(freshReference)).assertions.map((row: any) => row.result)).toEqual(['PASS', 'PASS', 'PASS'])
})

const changeRecoveredRow = (report: any, mutate: (row: any) => void) => {
  const acceptedOutpoint = report.cases[0].outputs.outputs[0].outpoint
  mutate(report.cases[2].outputs.outputs.find((row: any) => row.outpoint === acceptedOutpoint))
  report.trace[13].result = structuredClone(report.cases[2].outputs)
}

it('v3 rejects lost, changed or duplicated labels/tags and exact non-set metadata changes', async () => {
  const original = nativeMetadataReport(), current = await replayCapturedLifecycle(original, lifecycleOracleId)
  for (const mutate of [
    (row: any) => { row.labels.pop() },
    (row: any) => { row.labels[0] = 'different-label' },
    (row: any) => { row.labels.push(row.labels[0]) },
    (row: any) => { row.tags = [] },
    (row: any) => { row.tags[0] = 'different-tag' },
    (row: any) => { row.tags.push(row.tags[0]) },
    (row: any) => { row.labels[0] = 7 },
    (row: any) => { row.customInstructions = 'changed instructions' },
    (row: any) => { row.spendable = false },
    (row: any) => { row.satoshis = 3 },
    (row: any) => { row.outpoint = `${'ab'.repeat(32)}.0` }
  ]) {
    const changed = structuredClone(current); changeRecoveredRow(changed, mutate)
    await expect(verifyConformanceLifecycle(changed)).rejects.toThrow(/verdicts differ/)
    // A genuine observation of this loss is a retained FAIL, not an invented PASS.
    changed.assertions[2].result = 'FAIL'; changed.result = 'FAIL'
    expect((await verifyConformanceLifecycle(changed)).result).toBe('FAIL')
  }
})

it('v3 supports only the two named set fields and preserves every unrelated array order', async () => {
  const current = await replayCapturedLifecycle(nativeMetadataReport(), lifecycleOracleId)
  // Add a consistent second observed tag to exercise a multi-member set. These
  // mutated diagnostics are not claimed as original native observations.
  for (const [index, phase] of current.cases.entries()) {
    const row = phase.outputs.outputs[0]; row.tags.push('diagnostic extra tag')
    row.extraOrderedMetadata = ['first', 'second']
    if (index > 0) { row.tags.reverse(); row.labels.reverse() }
    current.trace[5 + index * 4].result = structuredClone(phase.outputs)
  }
  expect((await verifyConformanceLifecycle(current)).result).toBe('PASS')
  changeRecoveredRow(current, row => { row.extraOrderedMetadata.reverse() })
  await expect(verifyConformanceLifecycle(current)).rejects.toThrow(/verdicts differ/)
})

it('v3 rejects duplicate or non-string members even when every state returns the same invalid collection', async () => {
  for (const field of ['labels', 'tags']) for (const member of ['duplicate', 'non-string']) {
    const current = await replayCapturedLifecycle(nativeMetadataReport(), lifecycleOracleId)
    for (const [index, phase] of current.cases.entries()) {
      const values = phase.outputs.outputs[0][field]
      values.push(member === 'duplicate' ? values[0] : 7)
      current.trace[5 + index * 4].result = structuredClone(phase.outputs)
    }
    await expect(verifyConformanceLifecycle(current)).rejects.toThrow(/verdicts differ/)
    current.result = 'FAIL'; for (const row of current.assertions) row.result = 'FAIL'
    expect((await verifyConformanceLifecycle(current)).assertions.map((row: any) => row.result)).toEqual(['FAIL', 'FAIL', 'FAIL'])
  }
})

it('v3 never silently selects its comparison for a historical schema or wrong oracle ID', async () => {
  const current = await replayCapturedLifecycle(nativeMetadataReport(), lifecycleOracleId)
  current.oracle = 'tpnil-native-lifecycle-oracle@2.0.0'
  await expect(verifyConformanceLifecycle(current)).rejects.toThrow()
  const historical = nativeMetadataReport(); historical.oracle = lifecycleOracleId
  await expect(verifyConformanceLifecycle(historical)).rejects.toThrow(/Historical/)
})
