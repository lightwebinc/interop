import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { verifyConformanceLifecycle } from '../src/wallet-lab/native/verify-conformance-lifecycle.js'
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
