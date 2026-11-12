import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { LockingScript, Transaction } from '@bsv/sdk'
import { expect, it } from 'vitest'
import { closeWithSubmissionReceipt } from '../src/wallet-lab/native/shutdown-submissions.js'
import { verifyNativeShutdownSubmissions } from '../src/wallet-lab/native/verify-shutdown-submissions.js'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'

const archive = path.resolve(import.meta.dirname, '../../journals/integrated-native-attempts/2026-11-09/42697283161/native-integrated.zip')
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
expect(sha(fs.readFileSync(archive))).toBe('20f854ee8fa3f32eaa3122bf20f8200204d7b04ae31df7f4542cd31138021176')
const read = (name: string) => execFileSync('unzip', ['-p', archive, `repetition-2/${name}`], { maxBuffer: 16 * 1024 * 1024 })
// Unit fixtures reuse immutable native7 bytes. The in-memory record version is
// deliberately prospective; this does not rewrite or qualify the original run.
const globalBytes = read('evidence/native-submissions.json'), permissionBytes = read('evidence/conformance/permission-lifecycle.json'), recordBytes = Buffer.from(JSON.stringify({ ...JSON.parse(read('record.json').toString()), itcve: 'ITCVE-1@2.0.0', program: 'ISI-4@4.0.0' }))
const counterpartsBytes = read('evidence/conformance/service-counterparts.json')
const global = JSON.parse(globalBytes.toString()), permission = JSON.parse(permissionBytes.toString()), record = JSON.parse(recordBytes.toString())
const storageTransactions = new Map<string, Transaction>(JSON.parse(read('evidence/native-transactions.json').toString()).map((row: any) => [row.txid, Transaction.fromHex(row.rawTxHex)]))
const readEvidence = (name: string) => read(`evidence/${name}`)
const receipt = (script = '51', satoshis = 17, verdict = 'ACCEPTED_BY_NETWORK') => {
  const tx = new Transaction(1, [], [{ lockingScript: LockingScript.fromHex(script), satoshis }], 0)
  return { txid: tx.id('hex'), verdict, beefHex: tx.toHex() }
}
async function capture(options: { tail?: any[]; failure?: boolean } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-shutdown-test-'))
  fs.mkdirSync(path.join(directory, 'evidence/conformance'), { recursive: true })
  fs.writeFileSync(path.join(directory, 'record.json'), recordBytes)
  fs.writeFileSync(path.join(directory, 'evidence/conformance/service-counterparts.json'), counterpartsBytes)
  fs.writeFileSync(path.join(directory, 'evidence/native-submissions.json'), globalBytes)
  fs.writeFileSync(path.join(directory, 'evidence/conformance/permission-lifecycle.json'), permissionBytes)
  const initialProviders = [{ id: 'source', submissions: structuredClone(global.slice(0, 10)) }, { id: 'source/replacement-wallet.itcve.test', submissions: structuredClone(global.slice(10)) }]
  const providers = structuredClone(initialProviders), calls: string[] = []
  try {
    const result = await closeWithSubmissionReceipt({ directory, initialCapturedAt: record.endedAt,
      observer: { initialProviders, initialSubmissions: structuredClone(global), readFinalProviders: () => { calls.push('capture'); return providers } },
      closeBrowser: async () => { calls.push('browser'); await Promise.resolve(); providers[0]!.submissions.push(...(options.tail ?? [receipt()])); if (options.failure) throw Error('browser failed to close') },
      closeServices: async () => { calls.push('services'); await Promise.resolve(); providers[1]!.submissions.push(receipt('52', 19)) },
      removeProfile: () => { calls.push('profile') }
    })
    expect(calls).toEqual(['browser', 'services', 'profile', 'capture'])
    const bytes = fs.readFileSync(path.join(directory, 'shutdown-submissions.json'))
    expect(result.report.submissions.slice(0, global.length)).toEqual(global)
    const worker = { ...JSON.parse(read('worker.json').toString()), endedAt: new Date().toISOString(), recordSha256: sha(recordBytes), shutdownSubmissionsSha256: sha(bytes) }
    const binding = { worker, recordBytes, globalSubmissionsBytes: globalBytes, permissionReportBytes: permissionBytes, counterpartsBytes, expectedIdentity: permission.identity, readEvidence, storageTransactions }
    return { report: result.report, bytes, binding }
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}

it('awaits each cleanup stage and retains late provider-local suffixes without changing immutable global/module prefixes', async () => {
  const fixture = await capture()
  expect(await verifyNativeShutdownSubmissions(fixture.bytes, fixture.binding)).toMatchObject({ verified: true, initialCount: global.length, finalCount: global.length + 2, tailCount: 2, providers: 2 })
  expect(fixture.report.provenance.at(-2)).toEqual({ provider: 'source', providerIndex: 10 })
})

it.each(['ACCEPTED_BY_NETWORK', 'REJECTED', 'REJECTED_INVALID_TX', 'UNKNOWN'])('rejects delayed denied payments under every verdict: %s', async verdict => {
  for (const amount of [5, 7]) {
    const fixture = await capture({ tail: [receipt(permission.paymentScript, amount, verdict)] })
    await expect(verifyNativeShutdownSubmissions(fixture.bytes, fixture.binding)).rejects.toThrow('Unapproved denied payment')
  }
}, 15_000)

it('rejects a delayed repeat of the approved payment outside the exact original grant window', async () => {
  const approved = permission.steps.find((row: any) => row.id === 'spending-allow')
  const fixture = await capture({ tail: [global[approved.submissionStart]] })
  await expect(verifyNativeShutdownSubmissions(fixture.bytes, fixture.binding)).rejects.toThrow('Unapproved denied payment')
})

it('retains cleanup failure and rejects completion despite captured final rows', async () => {
  const fixture = await capture({ failure: true })
  expect(fixture.report.cleanup.browser.closed).toBe(false); expect(fixture.report.cleanup.services.closed).toBe(true)
  await expect(verifyNativeShutdownSubmissions(fixture.bytes, fixture.binding)).rejects.toThrow()
})

it('rejects rebound metadata, clipped prefixes, incomplete provenance and premature capture', async () => {
  const original = await capture()
  const mutations: Array<(r: any) => void> = [
    r => { r.initialProviders[0].submissions.pop() },
    r => { r.providers[0].submissions.shift() },
    r => { r.submissions.shift() },
    r => { r.provenance.pop() },
    r => { r.provenance.at(-1).providerIndex = 0 },
    r => { r.providers.pop() },
    r => { r.initialProviders = [{ id: 'source', submissions: global }]; r.providers = [{ id: 'source', submissions: global }]; r.submissions = global; r.provenance = global.map((_row: unknown, providerIndex: number) => ({ provider: 'source', providerIndex })) },
    r => { r.providers.push(r.providers[0]) },
    r => { r.providers[0].submissions[0].verdict = 'forged' },
    r => { r.initialCount-- },
    r => { r.bindings.global.sha256 = '00'.repeat(32) },
    r => { r.capturedAt = new Date(Date.parse(r.closureStartedAt) - 1).toISOString() },
    r => { r.cleanup.services.endedAt = new Date(Date.parse(r.capturedAt) + 1).toISOString() },
    r => { r.cleanup.services.closed = false },
    r => { r.errors.push('unreported shutdown failure') },
    r => { r.submissions.at(-1).txid = '00'.repeat(32); r.providers.at(-1).submissions.at(-1).txid = '00'.repeat(32) }
  ]
  for (const [index, mutate] of mutations.entries()) {
    const report = structuredClone(original.report); mutate(report); const bytes = Buffer.from(JSON.stringify(report))
    let rejected = false
    try { await verifyNativeShutdownSubmissions(bytes, { ...original.binding, worker: { ...original.binding.worker, shutdownSubmissionsSha256: sha(bytes) } }) } catch { rejected = true }
    expect(rejected, `mutation ${index}`).toBe(true)
  }
})

for (const implementation of ['typescript', 'go'] as const) it.skipIf(implementation === 'go' && !fs.existsSync(path.resolve(import.meta.dirname, '../../out/itcve-go-storage-portability')))(`retains actual ${implementation} counterpart arrays after service ownership maps are retired`, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-shutdown-provider-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>shutdown observer fixture</title>')
  const source = new ControlledWalletServices({ webroot: directory, components: { storage: implementation }, ...(implementation === 'go' ? { go: { binary: path.resolve(import.meta.dirname, '../../out/itcve-go-storage-portability'), storagePortabilityPatch: true, terminalRejectionReceipts: true } } : {}) }), destination = source.createStorageCounterpart(directory, '12'.repeat(32))
  let adopted = false, closed = false
  try {
    await source.start(); await destination.start(); source.registerStorageCounterpart('replacement-wallet.itcve.test', destination.storageUrl, destination); adopted = true
    const row = receipt(), serialized = { txid: row.txid, bytes: Uint8Array.from(Buffer.from(row.beefHex, 'hex')), verdict: 'ACCEPTED_BY_NETWORK' as const }
    source.recordSubmission(serialized); destination.recordSubmission(serialized)
    const observer = source.observeSubmissionClosure()
    await source.close(); closed = true
    expect(source.submissions).toHaveLength(1)
    const final = observer.readFinalProviders()
    expect(final.map(row => row.id)).toEqual(['source', 'source/replacement-wallet.itcve.test'])
    expect(final.map(row => row.submissions.length)).toEqual([1, 1]); expect(final).toEqual(observer.initialProviders)
  } finally { if (!closed) await source.close(); if (!adopted) await destination.close(); fs.rmSync(directory, { recursive: true, force: true }) }
}, 30_000)

it('does not reclassify a same-script5sat receipt before the permission module began', async () => {
  const original = await capture({ tail: [] }), prior = receipt(permission.paymentScript, 5)
  const report: any = structuredClone(original.report), module = structuredClone(permission), nextGlobal = [prior, ...global]
  module.submissions.unshift(prior); module.submissionWindow.startIndex++; module.submissionWindow.endIndex++
  for (const step of module.steps) { step.submissionStart++; step.submissionEnd++ }
  module.submissionWindow.entries = module.submissions.slice(module.submissionWindow.startIndex).map((row: any, offset: number) => ({ index: module.submissionWindow.startIndex + offset, txid: row.txid, verdict: row.verdict, serializedHex: row.beefHex }))
  report.initialProviders[0].submissions.unshift(prior); report.providers[0].submissions.unshift(prior)
  report.initialCount++; report.submissions.unshift(prior)
  report.provenance = report.initialProviders.flatMap((provider: any) => provider.submissions.map((_row: unknown, providerIndex: number) => ({ provider: provider.id, providerIndex })))
  for (const [index, provider] of report.providers.entries()) for (let providerIndex = report.initialProviders[index].submissions.length; providerIndex < provider.submissions.length; providerIndex++) report.provenance.push({ provider: provider.id, providerIndex })
  const globalSubmissionsBytes = Buffer.from(JSON.stringify(nextGlobal)), permissionReportBytes = Buffer.from(JSON.stringify(module))
  for (const [name, bytes] of [['global', globalSubmissionsBytes], ['module', permissionReportBytes]] as const) Object.assign(report.bindings[name], { bytes: bytes.length, sha256: sha(bytes) })
  const bytes = Buffer.from(JSON.stringify(report))
  expect((await verifyNativeShutdownSubmissions(bytes, { ...original.binding, globalSubmissionsBytes, permissionReportBytes, worker: { ...original.binding.worker, shutdownSubmissionsSha256: sha(bytes) } })).verified).toBe(true)
})
