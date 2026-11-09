// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { KeyDeriver, PrivateKey, PublicKey } from '@bsv/sdk'
import { permissionArgs, permissionAssertionIds, permissionProtocol, permissionSteps, type PermissionConformanceReport, type PermissionStepObservation } from './conformance-permissions-model.js'

export type PermissionEvidenceReader = (name: string) => Uint8Array
const explicitPermissionError = (value: PermissionStepObservation) => value.outcome.status === 'rejected'
  && /permission.*(?:denied|not found|expired|not granted)|no (?:protocol )?permission (?:token )?found|user.*(?:denied|rejected)|not authori[sz]ed/i.test(value.outcome.error.message)
  && !/timed? ?out|timeout|exceeded|unsupported|not implemented|network|fetch failed|50[0-9]|message channel|wallet not available|no wallet exists/i.test(value.outcome.error.message)
const time = (value: string) => { const parsed = Date.parse(value); assert.ok(Number.isFinite(parsed)); return parsed }

/** Recompute permission findings from public responses, visible controls and request ordering. */
export function evaluateNativePermissionConformance(report: PermissionConformanceReport, readEvidence: PermissionEvidenceReader) {
  assert.equal(report.schema, 'tpnil-native-permission-conformance@1')
  assert.equal(report.claim, 'ENGINEERING_OBSERVATION_ONLY')
  assert.equal(report.vector, 'ISI-4-V005')
  assert.equal(report.interface, 'unchanged native wallet public CWI and visible permission UI')
  assert.match(report.extensionId, /^[a-p]{32}$/)
  assert.deepEqual(report.steps.map(row => row.id), permissionSteps.map(row => row.id))
  for (const [index, row] of report.steps.entries()) {
    const expected = permissionSteps[index]!
    assert.equal(row.origin, expected.origin); assert.equal(new URL(row.pageUrl).origin, expected.origin)
    assert.equal(row.method, 'getPublicKey'); assert.deepEqual(row.args, permissionArgs(expected.seekPermission))
    assert.ok(time(row.startedAt) <= time(row.endedAt))
    if (index) assert.ok(time(report.steps[index - 1]!.endedAt) <= time(row.startedAt), 'Permission requests must be sequential')
    if (row.outcome.status === 'fulfilled' || row.outcome.status === 'rejected') assert.ok(time(row.startedAt) <= time(row.outcome.settledAt) && time(row.outcome.settledAt) <= time(row.endedAt))
  }
  const step = (id: string) => { const row = report.steps.find(row => row.id === id); assert.ok(row); return row }
  const deniedWithoutPrompt = (id: string) => { const row = step(id); assert.equal(row.prompts.length, 0); assert.ok(explicitPermissionError(row), 'Expected explicit permission rejection, never an observer/transport error') }
  const key = (id: string) => { const row = step(id); assert.equal(row.outcome.status, 'fulfilled'); if (row.outcome.status !== 'fulfilled') throw new Error('No public key'); const value = row.outcome.value.publicKey; assert.equal(PublicKey.fromString(value).toString(), value); return value }
  const cached = (id: string, expected: string) => { assert.equal(step(id).prompts.length, 0); assert.equal(key(id), expected) }
  const prompt = (id: string, decision: 'allow' | 'deny') => {
    const row = step(id); assert.equal(row.prompts.length, 1)
    const observed = row.prompts[0]!, url = new URL(observed.url)
    assert.equal(url.protocol, 'chrome-extension:'); assert.equal(url.hostname, report.extensionId); assert.equal(url.pathname, '/prompt.html')
    const lines = observed.body.split('\n').map(line => line.trim()).filter(Boolean)
    assert.equal(lines[0], 'Protocol Permission')
    const after = (label: string) => { const index = lines.indexOf(label); assert.ok(index >= 0); return lines[index + 1] }
    assert.equal(after('Origin'), new URL(row.origin).host); assert.equal(after('Protocol'), permissionProtocol[1]); assert.match(after('Security')!, /^Level 2\b/); assert.equal(after('Counterparty'), 'anyone')
    assert.equal(observed.pendingBeforeDecision, true); assert.equal(observed.decision, decision); assert.equal(observed.button, decision === 'allow' ? 'Allow' : 'Deny')
    assert.ok(time(row.startedAt) <= time(observed.observedAt) && time(observed.observedAt) <= time(observed.clickedAt) && time(observed.clickedAt) <= time(observed.clickCompletedAt) && time(observed.clickCompletedAt) <= time(row.endedAt))
    assert.ok(row.outcome.status === 'fulfilled' || row.outcome.status === 'rejected')
    if (row.outcome.status === 'fulfilled' || row.outcome.status === 'rejected') assert.ok(time(row.outcome.settledAt) >= time(observed.clickedAt), 'Request settled before the UI decision')
    assert.equal(observed.screenshot.name, `conformance/permissions-${id}.png`)
    const bytes = readEvidence(observed.screenshot.name)
    assert.equal(bytes.length, observed.screenshot.size); assert.ok(bytes.length > 8)
    assert.equal(Buffer.from(bytes.subarray(0, 8)).toString('hex'), '89504e470d0a1a0a')
    assert.equal(createHash('sha256').update(bytes).digest('hex'), observed.screenshot.sha256)
  }
  const predicates: Array<() => void> = [
    () => deniedWithoutPrompt('primary-unapproved'),
    () => { prompt('primary-approve', 'allow'); key('primary-approve'); cached('primary-cached', key('primary-approve')) },
    () => { deniedWithoutPrompt('alternate-unapproved'); prompt('alternate-deny', 'deny'); assert.notEqual(step('primary-approve').origin, step('alternate-deny').origin); assert.deepEqual(step('primary-approve').args, step('alternate-deny').args) },
    () => { prompt('alternate-deny', 'deny'); assert.ok(explicitPermissionError(step('alternate-deny'))) },
    () => deniedWithoutPrompt('alternate-after-denial'),
    () => cached('primary-after-denial', key('primary-approve')),
    () => { prompt('alternate-approve', 'allow'); assert.equal(key('alternate-approve'), key('primary-approve')); cached('alternate-cached', key('primary-approve')) },
    () => { assert.equal(report.cleanup.applicationPagesClosed, true); assert.equal(report.cleanup.ownedPromptsClosed, true) }
  ]
  return predicates.map((predicate, index) => {
    try { predicate(); return { id: permissionAssertionIds[index]!, result: 'PASS' as const, detail: 'Independent permission predicate verified.' } }
    catch (error) { return { id: permissionAssertionIds[index]!, result: 'FAIL' as const, detail: error instanceof Error ? error.message : String(error) } }
  })
}

export function verifyNativePermissionConformance(report: PermissionConformanceReport, readEvidence: PermissionEvidenceReader, joinedWalletIdentity?: string) {
  const assertions = evaluateNativePermissionConformance(report, readEvidence)
  assert.deepEqual(report.assertions.map(({ id, result }) => ({ id, result })), assertions.map(({ id, result }) => ({ id, result })))
  const result = assertions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL'
  assert.equal(report.result, result)
  if (joinedWalletIdentity !== undefined) {
    assert.equal(PublicKey.fromString(joinedWalletIdentity).toString(), joinedWalletIdentity, 'Joined native wallet identity must be a canonical public key')
    // The public "anyone" private key is 1. Derive the subject's child from that
    // counterparty, so this join needs no native-wallet secret or extra call.
    const expectedKey = new KeyDeriver(PrivateKey.fromHex('01')).derivePublicKey([...permissionProtocol], 'origin-isolation', joinedWalletIdentity, false).toString()
    for (const row of report.steps) if (row.outcome.status === 'fulfilled') {
      assert.equal(row.outcome.value.publicKey, expectedKey, `Permission result ${row.id} must belong to the joined native wallet`)
    }
  }
  return { verified: true, vector: report.vector, result, assertions, nativeArtifactQualification: 'Requires unchanged-wallet artifact and native-environment admission from the enclosing profile.' }
}
