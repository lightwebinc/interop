// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { PrivateKey } from '@bsv/sdk'
import { permissionArgs, permissionSteps, type PermissionConformanceReport } from '../src/wallet-lab/native/conformance-permissions-model.js'
import { evaluateNativePermissionConformance, verifyNativePermissionConformance } from '../src/wallet-lab/native/verify-conformance-permissions.js'

// LAB_SELF_TEST_ONLY: synthetic observations exercise verifier failure detection.
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
const read = () => png
function fixture(): PermissionConformanceReport {
  const identity = PrivateKey.fromHex('33'.repeat(32)).toPublicKey().toString()
  const report: PermissionConformanceReport = { schema: 'tpnil-native-permission-conformance@1', claim: 'ENGINEERING_OBSERVATION_ONLY', vector: 'ISI-4-V005', interface: 'unchanged native wallet public CWI and visible permission UI', extensionId: 'a'.repeat(32), steps: [], assertions: [], result: 'PASS', cleanup: { applicationPagesClosed: true, ownedPromptsClosed: true } }
  for (const [index, step] of permissionSteps.entries()) {
    const time = (offset: number) => new Date(1_800_000_000_000 + index * 1000 + offset).toISOString()
    const rejected = ['primary-unapproved', 'alternate-unapproved', 'alternate-deny', 'alternate-after-denial'].includes(step.id)
    report.steps.push({ id: step.id, origin: step.origin, pageUrl: `${step.origin}/`, method: 'getPublicKey', args: permissionArgs(step.seekPermission), startedAt: time(0), endedAt: time(900), outcome: rejected ? { status: 'rejected', error: { name: 'Error', message: step.id === 'alternate-deny' ? 'Permission denied.' : 'No protocol permission token found (seekPermission=false).' }, settledAt: time(800) } : { status: 'fulfilled', value: { publicKey: identity }, settledAt: time(800) }, prompts: 'decision' in step ? [{ url: `chrome-extension://${report.extensionId}/prompt.html?requestID=${step.id}`, body: `Protocol Permission\nOrigin\n${new URL(step.origin).host}\nProtocol\ntpnil native permission v1\nSecurity\nLevel 2 · this app and this recipient only\nCounterparty\nanyone\nAllow\nDeny`, observedAt: time(100), pendingBeforeDecision: true, decision: step.decision, button: step.decision === 'allow' ? 'Allow' : 'Deny', clickedAt: time(200), clickCompletedAt: time(300), screenshot: { name: `conformance/permissions-${step.id}.png`, size: png.length, sha256: createHash('sha256').update(png).digest('hex') } }] : [] })
  }
  report.assertions = evaluateNativePermissionConformance(report, read)
  return report
}
describe('independent native permission predicates', () => {
  it('accepts the complete ordered same-protocol approval, denial and recovery observations', () => {
    const verified = verifyNativePermissionConformance(fixture(), read)
    expect(verified.result).toBe('PASS'); expect(verified.assertions).toHaveLength(8)
  })
  it.each([
    ['timeout reported as denial', (r: any) => { r.steps[4].outcome = { status: 'timeout', message: 'Permission request timeout' } }],
    ['transport error reported as denial', (r: any) => { r.steps[4].outcome.error.message = 'Permission request network error 502' }],
    ['successful denied request', (r: any) => { r.steps[4].outcome = structuredClone(r.steps[1].outcome); r.steps[4].outcome.settledAt = r.steps[4].endedAt }],
    ['missing actual deny click', (r: any) => { r.steps[4].prompts = [] }],
    ['allow mislabeled as denial', (r: any) => { r.steps[4].prompts[0].button = 'Allow' }],
    ['settled before UI choice', (r: any) => { r.steps[4].prompts[0].pendingBeforeDecision = false }],
    ['returned before click', (r: any) => { r.steps[4].outcome.settledAt = r.steps[4].startedAt }],
    ['unrelated protocol popup', (r: any) => { r.steps[4].prompts[0].body = r.steps[4].prompts[0].body.replace('tpnil native permission v1', 'unrelated protocol') }],
    ['wrong-origin popup', (r: any) => { r.steps[4].prompts[0].body = r.steps[4].prompts[0].body.replace('alternate.itcve.test', 'deny.itcve.test') }],
    ['grant leaks before consent', (r: any) => { r.steps[3].outcome = structuredClone(r.steps[2].outcome); r.steps[3].outcome.settledAt = r.steps[3].endedAt }],
    ['denial accidentally grants', (r: any) => { r.steps[5].outcome = structuredClone(r.steps[2].outcome); r.steps[5].outcome.settledAt = r.steps[5].endedAt }],
    ['approval corrupts returned key', (r: any) => { r.steps[7].outcome.value.publicKey = PrivateKey.fromHex('34'.repeat(32)).toPublicKey().toString() }],
    ['missing cleanup', (r: any) => { r.cleanup.applicationPagesClosed = false }]
  ])('rejects false PASS: %s', (_name, mutate) => {
    const report = fixture(); mutate(report)
    expect(() => verifyNativePermissionConformance(report, read)).toThrow()
  })
  it('rejects changed request targets and screenshot bytes', () => {
    const report: any = fixture(); report.steps[4]!.args.protocolID[1] = 'unrelated protocol'
    expect(() => verifyNativePermissionConformance(report, read)).toThrow()
    expect(() => verifyNativePermissionConformance(fixture(), () => Buffer.from([...png, 0]))).toThrow()
  })
  it('retains an honestly failed observation instead of turning it into an observer failure', () => {
    const report = fixture(); report.steps[4]!.outcome = { status: 'timeout', message: 'No response within observation interval' }
    report.assertions = evaluateNativePermissionConformance(report, read); report.result = 'FAIL'
    const verified = verifyNativePermissionConformance(report, read)
    assert.equal(verified.result, 'FAIL'); assert.ok(verified.assertions.some(row => row.result === 'FAIL'))
  })
})
