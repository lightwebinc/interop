import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { P2PKH, PrivateKey, Transaction } from '@bsv/sdk'
import { canonicalJson } from '../../determinism.js'
import { lifecyclePermissionConfig } from './conformance-permission-lifecycle-model.js'
import { evaluateNativePermissionLifecycle } from './verify-conformance-permission-lifecycle.js'
import { shutdownSubmissionPolicy, type ShutdownSubmission } from './shutdown-submissions.js'

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const equal = (a: unknown, b: unknown) => assert.equal(canonicalJson(a), canonicalJson(b))
const time = (value: unknown) => { assert.equal(typeof value, 'string'); const result = Date.parse(value as string); assert.ok(Number.isFinite(result)); return result }
function transaction(row: ShutdownSubmission): Transaction {
  assert.match(row.txid, /^[0-9a-f]{64}$/); assert.match(row.beefHex, /^(?:[0-9a-f]{2})+$/)
  assert.equal(typeof row.verdict, 'string'); assert.ok(row.verdict.length > 0)
  const bytes = [...Buffer.from(row.beefHex, 'hex')]
  let tx: Transaction
  try { tx = Transaction.fromAtomicBEEF(bytes) } catch { tx = Transaction.fromBinary(bytes) }
  assert.equal(tx.id('hex'), row.txid, 'Final submission identity differs from its body')
  return tx
}

/** The parent first verifies native transaction ownership/funding and child
 * outcomes. This independent closure binds their immutable reports to every
 * provider's post-close ledger and checks the otherwise-unobserved suffix. */
export async function verifyNativeShutdownSubmissions(receiptBytes: Uint8Array, binding: {
  worker: any; recordBytes: Uint8Array; globalSubmissionsBytes: Uint8Array; permissionReportBytes: Uint8Array; counterpartsBytes: Uint8Array
  expectedIdentity: string; readEvidence(name: string): Buffer; storageTransactions: Map<string, Transaction>
}) {
  const report = JSON.parse(Buffer.from(receiptBytes).toString())
  assert.equal(report.schema, shutdownSubmissionPolicy); assert.equal(report.policy, shutdownSubmissionPolicy)
  assert.equal(report.profile, 'ITCVE-1@2.0.0'); assert.equal(report.claim, 'ENGINEERING_OBSERVATION_ONLY')
  assert.equal(report.ordering, 'Original global prefix, then per-provider suffixes in declared provider order; no cross-provider chronology claim.')
  assert.deepEqual(report.errors, [])
  assert.equal(binding.worker.shutdownSubmissionsSha256, sha(receiptBytes)); assert.equal(binding.worker.cleanWalletAndServiceShutdown, true)
  const record = JSON.parse(Buffer.from(binding.recordBytes).toString())
  assert.equal(binding.worker.recordSha256, sha(binding.recordBytes)); assert.equal(record.itcve, 'ITCVE-1@2.0.0')
  for (const [name, expectedPath, bytes] of [
    ['record', 'record.json', binding.recordBytes], ['global', 'evidence/native-submissions.json', binding.globalSubmissionsBytes],
    ['module', 'evidence/conformance/permission-lifecycle.json', binding.permissionReportBytes], ['counterparts', 'evidence/conformance/service-counterparts.json', binding.counterpartsBytes]
  ] as const) equal(report.bindings[name], { path: expectedPath, bytes: bytes.length, sha256: sha(bytes) })
  let lower = time(binding.worker.startedAt)
  for (const at of [report.initialCapturedAt, record.endedAt, report.closureStartedAt]) { assert.ok(time(at) >= lower); lower = time(at) }
  assert.deepEqual(Object.keys(report.cleanup).sort(), ['browser', 'profile', 'services'])
  for (const name of ['browser', 'services', 'profile']) {
    const stage = report.cleanup[name]
    assert.equal(stage.closed, true); assert.equal(stage.error, undefined)
    assert.ok(time(stage.startedAt) >= lower && time(stage.endedAt) >= time(stage.startedAt)); lower = time(stage.endedAt)
  }
  assert.ok(time(report.capturedAt) >= lower && time(report.capturedAt) <= time(binding.worker.endedAt))

  const global: ShutdownSubmission[] = JSON.parse(Buffer.from(binding.globalSubmissionsBytes).toString())
  const permission = JSON.parse(Buffer.from(binding.permissionReportBytes).toString())
  assert.equal(permission.identity, binding.expectedIdentity)
  assert.ok(time(permission.endedAt) <= time(report.initialCapturedAt))
  assert.ok(Array.isArray(global) && Array.isArray(report.initialProviders) && report.initialProviders.length > 0 && Array.isArray(report.providers))
  const ids = report.initialProviders.map((provider: any) => provider.id)
  const counterparts = JSON.parse(Buffer.from(binding.counterpartsBytes).toString())
  assert.deepEqual(Object.keys(counterparts), ['replacement-wallet.itcve.test'], 'Declared replacement inventory must be exact')
  equal(ids, ['source', ...Object.keys(counterparts).map(host => `source/${host}`)])
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.every((id: unknown) => typeof id === 'string' && /^source(?:\/[a-z0-9.-]+)*$/.test(id)))
  equal(report.providers.map((provider: any) => provider.id), ids)
  equal(report.initialProviders.flatMap((provider: any) => provider.submissions), global)
  assert.equal(report.initialCount, global.length)
  const final = [...global], provenance = report.initialProviders.flatMap((provider: any) => provider.submissions.map((_row: unknown, providerIndex: number) => ({ provider: provider.id, providerIndex })))
  for (const [index, provider] of report.providers.entries()) {
    const before = report.initialProviders[index].submissions
    assert.ok(Array.isArray(provider.submissions) && provider.submissions.length >= before.length)
    equal(provider.submissions.slice(0, before.length), before)
    for (let providerIndex = before.length; providerIndex < provider.submissions.length; providerIndex++) {
      final.push(provider.submissions[providerIndex]); provenance.push({ provider: provider.id, providerIndex })
    }
  }
  equal(report.submissions, final); equal(report.provenance, provenance)
  assert.equal(new Set(provenance.map((row: any) => `${row.provider}:${row.providerIndex}`)).size, final.length)
  const window = permission.submissionWindow
  assert.ok(Number.isSafeInteger(window.startIndex) && window.startIndex >= 0 && Number.isSafeInteger(window.endIndex) && window.endIndex >= window.startIndex && window.endIndex <= global.length)
  assert.equal(window.endIndex, permission.submissions.length)
  equal(permission.submissions, global.slice(0, permission.submissions.length))
  equal(window.entries, global.slice(window.startIndex, window.endIndex).map((row, offset) => ({ index: window.startIndex + offset, txid: row.txid, verdict: row.verdict, serializedHex: row.beefHex })))

  const script = new P2PKH().lock(PrivateKey.fromHex(lifecyclePermissionConfig.paymentRecipientKeyHex).toPublicKey().toAddress()).toHex()
  assert.equal(permission.paymentScript, script)
  const grant = permission.steps.find((step: any) => step.id === 'spending-allow')
  const rows = permission.transactions.filter((row: any) => row.role === 'spending-allow')
  let approved: Transaction | undefined
  if (rows.length === 1 && grant?.outcome.status === 'fulfilled') {
    const assertions = await evaluateNativePermissionLifecycle(permission, binding.readEvidence, binding.expectedIdentity)
    assert.equal(assertions.find(row => row.id === 'permission-lifecycle.spending-grant')?.result, 'PASS', 'Only an independently verified native grant can exempt a payment')
    approved = Transaction.fromAtomicBEEF(rows[0].atomicBeef)
    assert.equal(approved.id('hex'), rows[0].txid); assert.equal(approved.id('hex'), grant.outcome.value.txid)
    assert.equal(binding.storageTransactions.get(approved.id('hex'))?.toHex(), approved.toHex(), 'Approved exception differs from independent native storage bytes')
  }
  for (const [index, row] of final.entries()) {
    const tx = transaction(row)
    if (index < window.startIndex) continue
    if (approved && index >= grant.submissionStart && index < grant.submissionEnd && row.txid === approved.id('hex')) {
      assert.equal(tx.toHex(), approved.toHex()); continue
    }
    assert.ok(!tx.outputs.some(output => [lifecyclePermissionConfig.paymentSatoshis, lifecyclePermissionConfig.secondPaymentSatoshis].includes(output.satoshis as 5 | 7) && output.lockingScript.toHex() === script), 'Unapproved denied payment appears in the final post-shutdown ledger')
  }
  return { verified: true, policy: shutdownSubmissionPolicy, initialCount: global.length, finalCount: final.length, tailCount: final.length - global.length, providers: ids.length, deniedPaymentsCheckedThroughShutdown: true }
}
