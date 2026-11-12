import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { LockingScript, Transaction } from '@bsv/sdk'
import { permissionLifecycleAssertionIds, type NativePermissionLifecycleReport } from '../src/wallet-lab/native/conformance-permission-lifecycle-model.js'
import { assertNoDeniedPermissionPayment, evaluateNativePermissionLifecycle, verifyNativePermissionLifecycle } from '../src/wallet-lab/native/verify-conformance-permission-lifecycle.js'

// Real released-wallet macOS engineering observations. These verifier regressions
// neither simulate a native execution nor qualify Linux/native conformance.
const directory = path.resolve(import.meta.dirname, '../../journals/native-permission-lifecycle/2026-11-09/go-reference/evidence')
const original = JSON.parse(fs.readFileSync(path.join(directory, 'conformance/permission-lifecycle.json'), 'utf8')) as NativePermissionLifecycleReport
const read = (name: string) => fs.readFileSync(path.join(directory, name))
const copy = () => structuredClone(original)
const step = (r: NativePermissionLifecycleReport, id: string) => r.steps.find(row => row.id === id)!
const synchronizeWindow = (r: NativePermissionLifecycleReport) => {
  r.submissionWindow.endIndex = r.submissions.length
  r.submissionWindow.entries = r.submissions.slice(r.submissionWindow.startIndex).map((row, index) => ({ index: r.submissionWindow.startIndex + index, txid: row.txid, verdict: row.verdict, serializedHex: row.beefHex }))
}
const receipt = (script: string, satoshis: number) => {
  const tx = new Transaction(); tx.addOutput({ satoshis, lockingScript: LockingScript.fromHex(script) })
  return { txid: tx.id('hex'), beefHex: tx.toHex(), verdict: 'ACCEPTED_BY_NETWORK' }
}
function insertReceipt(r: NativePermissionLifecycleReport, id: string, row: ReturnType<typeof receipt>) {
  const target = step(r, id), index = target.submissionStart
  r.submissions.splice(index, 0, row)
  let seen = false
  for (const current of r.steps) {
    if (current === target) { seen = true; current.submissionEnd++ }
    else if (seen) { current.submissionStart++; current.submissionEnd++ }
  }
  synchronizeWindow(r)
}

describe('native permission lifecycle independent oracle', () => {
  it('replays all16 public UI/cryptographic predicates with joined native identity', async () => {
    const result = await verifyNativePermissionLifecycle(copy(), read, original.identity)
    expect(result.result).toBe('PASS'); expect(result.assertions.map(row => row.id)).toEqual(permissionLifecycleAssertionIds)
  })
  it.each([
    ['wrong wallet identity', (r: any) => { r.identity = '02' + '11'.repeat(32) }],
    ['wrong-origin basket prompt', (r: any) => { step(r, 'basket-deny').prompts[0]!.body = step(r, 'basket-deny').prompts[0]!.body.replace('deny.itcve.test', 'alternate.itcve.test') }],
    ['wrong denied basket method', (r: any) => { step(r, 'basket-deny').method = 'getNetwork' }],
    ['wrong denied basket target', (r: any) => { step(r, 'basket-deny').args.basket = 'other basket' }],
    ['transport failure as denial', (r: any) => { step(r, 'spending-deny').outcome.error!.message = 'Permission denied because network timeout' }],
    ['timeout as denial', (r: any) => { step(r, 'basket-after-all-deny').outcome = { status: 'timeout' } }],
    ['response before actual click', (r: any) => { step(r, 'basket-deny').outcome.settledAt = step(r, 'basket-deny').startedAt }],
    ['cached call still prompts', (r: any) => { step(r, 'basket-cached').prompts = step(r, 'basket-allow').prompts }],
    ['certificate denied target substitution', (r: any) => { step(r, 'certificate-deny').args.verifier = original.identity }],
    ['certificate never acquired', (r: any) => { step(r, 'setup-certificate').outcome.status = 'rejected' }],
    ['certificate extra revealed field', (r: any) => { step(r, 'certificate-allow').outcome.value.keyringForVerifier.private = 'AAAA' }],
    ['certificate corrupted revelation', (r: any) => { step(r, 'certificate-allow').outcome.value.keyringForVerifier.name = 'AAAA' }],
    ['changed spend amount', (r: any) => { step(r, 'spending-allow').args.outputs[0].satoshis++ }],
    ['changed spending UI fee', (r: any) => { step(r, 'spending-allow').prompts[0]!.body = step(r, 'spending-allow').prompts[0]!.body.replace(/Network fee \([0-9]+ satoshis\)/, 'Network fee (999 satoshis)') }],
    ['missing one-shot prompt', (r: any) => { step(r, 'spending-second-deny').prompts = [] }],
    ['single revocation wrong card', (r: any) => { r.ui[0].cardHeading = 'alternate.itcve.test' }],
    ['single revocation wrong row', (r: any) => { r.ui[0].control.detail = 'Certificate access (name)' }],
    ['revoked grant stays cached', (r: any) => { step(r, 'basket-after-single-deny').prompts = [] }],
    ['missing reapproval recovery', (r: any) => { step(r, 'basket-recovery-allow').outcome.status = 'rejected' }],
    ['revocation affects unrelated certificate', (r: any) => { step(r, 'certificate-after-single-cached').prompts = step(r, 'certificate-allow').prompts }],
    ['origin revocation no confirmation', (r: any) => { r.ui[1].confirmButton = 'Cancel' }],
    ['origin revocation wrong subject', (r: any) => { r.ui[1].confirmationBody = r.ui[1].confirmationBody.replaceAll('deny.itcve.test', 'alternate.itcve.test') }],
    ['origin protocol grant survives', (r: any) => { step(r, 'protocol-after-all').outcome.status = 'fulfilled' }],
    ['other origin no longer cached', (r: any) => { step(r, 'alternate-basket-after-all').prompts = step(r, 'alternate-basket-allow').prompts }],
    ['cross-wallet cached key', (r: any) => { step(r, 'alternate-protocol-after-all').outcome.value.publicKey = original.identity }],
    ['changed transaction bytes', (r: any) => { r.transactions[1].atomicBeef[20] ^= 1 }],
    ['missing successful transaction', (r: any) => { r.transactions.pop() }],
    ['truncated global receipt window', (r: any) => { r.submissionWindow.entries.pop() }],
    ['missing screenshot integrity', (r: any) => { step(r, 'basket-deny').prompts[0]!.screenshot.sha256 = '00'.repeat(32) }],
    ['cleanup omitted', (r: any) => { r.cleanup.settingsPageClosed = false }]
  ])('rejects false PASS: %s', async (_name, mutate) => {
    const report = copy(); mutate(report)
    await expect(verifyNativePermissionLifecycle(report, read, original.identity)).rejects.toThrow()
  })
  it('retains unrelated background receipts during denied spending', async () => {
    const report = copy(); insertReceipt(report, 'spending-deny', receipt('51', 17))
    expect((await verifyNativePermissionLifecycle(report, read, original.identity)).result).toBe('PASS')
  })
  it.each(['ACCEPTED_BY_NETWORK', 'REJECTED_INVALID_TX'])('rejects a denied customer submission regardless of verdict %s', async verdict => {
    const report = copy(), submitted = receipt(report.paymentScript!, report.configuration.paymentSatoshis)
    submitted.verdict = verdict; insertReceipt(report, 'spending-deny', submitted)
    await expect(verifyNativePermissionLifecycle(report, read, original.identity)).rejects.toThrow()
  })
  it('rejects the exact clipped-denial-window attack with an otherwise complete global window', async () => {
    const report = copy(), approved = report.submissions[step(report, 'spending-allow').submissionStart]!
    insertReceipt(report, 'spending-deny', structuredClone(approved))
    step(report, 'spending-deny').submissionStart = step(report, 'spending-deny').submissionEnd
    await expect(verifyNativePermissionLifecycle(report, read, original.identity)).rejects.toThrow()
  })
  it('rejects a matching payment delayed until after a later unrelated call', async () => {
    const report = copy(); insertReceipt(report, 'alternate-basket-after-all', receipt(report.paymentScript!, report.configuration.paymentSatoshis))
    await expect(verifyNativePermissionLifecycle(report, read, original.identity)).rejects.toThrow()
  })
  it('rejects a clipped end that moves the denied receipt into the inter-call gap', async () => {
    const report = copy(); insertReceipt(report, 'spending-deny', receipt(report.paymentScript!, report.configuration.paymentSatoshis))
    step(report, 'spending-deny').submissionEnd = step(report, 'spending-deny').submissionStart
    await expect(verifyNativePermissionLifecycle(report, read, original.identity)).rejects.toThrow()
  })
  it('binds even unrelated retained receipt bodies to their txids', () => {
    const submitted = receipt('51', 17); submitted.txid = '00'.repeat(32)
    expect(() => assertNoDeniedPermissionPayment([submitted], original.paymentScript!, 5)).toThrow()
  })
  it('keeps a real failure with missing signed action evidence as FAIL rather than observer rejection', async () => {
    const report = copy(); step(report, 'spending-allow').outcome = { status: 'rejected', error: { name: 'Error', message: 'funding failed: not enough funds' } }
    report.transactions = report.transactions.filter(row => row.role !== 'spending-allow')
    report.assertions = await evaluateNativePermissionLifecycle(report, read, original.identity); report.result = 'FAIL'
    expect((await verifyNativePermissionLifecycle(report, read, original.identity)).result).toBe('FAIL')
  })
})
