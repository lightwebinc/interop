import { createHash } from 'node:crypto'
import { P2PKH, PrivateKey, ProtoWallet } from '@bsv/sdk'
import type { Page } from 'playwright'
import type { NativeScenarioContext } from '../yours-driver.js'
import { issueFixtureCertificateForSubject } from '../certificate-fixture.js'
import { permissionArgs } from './conformance-permissions-model.js'
import { lifecyclePermissionConfig as config, permissionLifecycleOracle, type LifecyclePermissionDecision, type LifecyclePermissionStep, type NativePermissionLifecycleReport } from './conformance-permission-lifecycle-model.js'
import { evaluateNativePermissionLifecycle } from './verify-conformance-permission-lifecycle.js'

const now = () => new Date().toISOString()
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds))
const clean = (value: any): any => JSON.parse(JSON.stringify(value))

/** Caller suspends its automatic prompt handler. This controller operates only
 * matching visible prompts and Settings controls; no extension messaging or
 * private permission-store access is used. */
export async function runNativePermissionLifecycle(context: NativeScenarioContext): Promise<NativePermissionLifecycleReport> {
  const { application, services, evidence, extensionId } = context
  const pages = new Map<string, Page>(), ownedPrompts = new Set<Page>(), screenshots = new Map<string, Uint8Array>()
  let settings: Page | undefined
  const report: NativePermissionLifecycleReport = {
    schema: 'tpnil-native-permission-lifecycle@1.0.0', oracle: permissionLifecycleOracle, claim: 'ENGINEERING_OBSERVATION_ONLY',
    interface: 'unchanged native CWI and visible Settings Permissions UI', extensionId, identity: '', startedAt: now(), endedAt: '',
    configuration: config, steps: [], ui: [], submissions: [], transactions: [], submissionWindow: { startIndex: services.submissions.length, endIndex: services.submissions.length, entries: [] }, errors: [], assertions: [], result: 'FAIL',
    cleanup: { applicationPagesClosed: false, ownedPromptsClosed: false, settingsPageClosed: false }
  }
  const screenshot = async (page: Page, name: string) => {
    const bytes = await page.screenshot({ type: 'png', timeout: 5000 })
    evidence.addBytes(name, bytes); screenshots.set(name, bytes)
    return { name, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length }
  }
  const originPage = async (origin: string) => {
    if (origin === config.application) return application
    let page = pages.get(origin)
    if (!page) {
      page = await context.context.newPage(); pages.set(origin, page)
      await page.goto(`${origin}/`, { timeout: 30_000 })
      await page.getByText('TPNIL boundary fixture', { exact: true }).waitFor({ timeout: 30_000 })
      await page.waitForFunction(() => typeof (window as any).CWI?.getPublicKey === 'function', undefined, { timeout: 30_000 })
    }
    return page
  }
  const request = async (id: string, origin: string, method: string, args: any, decision?: LifecyclePermissionDecision, setup = false) => {
    const page = await originPage(origin)
    const row: LifecyclePermissionStep = { id, origin, pageUrl: page.url(), method, args: clean(args), startedAt: now(), endedAt: '', prompts: [], outcome: { status: 'observer-error', message: 'Request did not start' }, submissionStart: services.submissions.length, submissionEnd: services.submissions.length }
    report.steps.push(row)
    try {
      await page.evaluate(({ id, method, args }) => {
        const state = ((window as any).__tpnilPermissionLifecycle ??= {})
        state[id] = { status: 'pending' }
        void Promise.resolve().then(() => (window as any).CWI[method](args)).then(value => {
          state[id] = { status: 'fulfilled', value, settledAt: new Date().toISOString() }
        }, error => { state[id] = { status: 'rejected', error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) }, settledAt: new Date().toISOString() } })
      }, { id, method, args: row.args })
      const handled = new Set<string>(), deadline = Date.now() + config.requestTimeoutMs
      for (;;) {
        const state = await page.evaluate(id => (window as any).__tpnilPermissionLifecycle[id], id)
        if (state.status !== 'pending') { row.outcome = state; break }
        if (Date.now() >= deadline) { row.outcome = { status: 'timeout', message: 'Native request exceeded the frozen observation interval' }; break }
        for (const popup of context.context.pages()) {
          if (popup.isClosed() || !popup.url().startsWith(`chrome-extension://${extensionId}/prompt.html`)) continue
          let body: string
          try { body = await popup.locator('body').innerText({ timeout: 500 }) } catch { continue }
          const promptKey = `${popup.url()}\0${body}`
          if (handled.has(promptKey)) continue
          const lines = body.split('\n').map(line => line.trim()).filter(Boolean), after = (label: string) => lines[lines.indexOf(label) + 1]
          const title = lines[0]
          const groupedSetup = setup && origin === config.application && title === 'Permission Request' && body.replace(/\s+/g, ' ').includes(`${new URL(origin).host} is requesting the following permissions`)
          if (after('Origin') !== new URL(origin).host && !groupedSetup) continue
          const matches = groupedSetup || title === 'Basket Access' && after('Basket') === config.basket
            || title === 'Certificate Access' && after('Cert Type') === config.certificateType && after('Fields') === 'name'
            || title === 'Spending Authorization' && (method === 'createAction')
            || setup && title === 'Protocol Permission' && (after('Protocol') === `certificate acquisition ${config.certificateType}`)
          if (!matches) continue
          ownedPrompts.add(popup); handled.add(promptKey)
          if (!decision) throw new Error(`Unexpected fresh permission prompt during ${id}`)
          const observedAt = now(), pendingBeforeDecision = await page.evaluate(id => (window as any).__tpnilPermissionLifecycle[id].status === 'pending', id)
          const observation = { url: popup.url(), body, observedAt, pendingBeforeDecision, decision, button: groupedSetup ? (decision === 'allow' ? 'Allow Selected' : 'Deny All') : decision === 'allow' ? 'Allow' : 'Deny', clickedAt: now(), clickCompletedAt: '', screenshot: await screenshot(popup, `conformance/permission-lifecycle-${id}-${row.prompts.length}.png`) }
          observation.clickedAt = now(); row.prompts.push(observation)
          await popup.getByRole('button', { name: observation.button, exact: true }).click({ timeout: 5000 })
          observation.clickCompletedAt = now()
        }
        await pause(25)
      }
    } catch (error) { row.outcome = { status: 'observer-error', message: error instanceof Error ? error.message : String(error) } }
    finally { row.endedAt = now(); row.submissionEnd = services.submissions.length }
    return row
  }
  const value = (row: LifecyclePermissionStep) => { if (row.outcome.status !== 'fulfilled') throw new Error(`${row.id}: ${row.outcome.error?.message ?? row.outcome.message ?? row.outcome.status}`); return row.outcome.value }
  const basketArgs = () => ({ basket: config.basket, include: 'entire transactions', includeTags: true, includeCustomInstructions: true })
  const certificateArgs = () => ({ certificate: { type: report.certificate.type, serialNumber: report.certificate.serialNumber, certifier: report.certificate.certifier, subject: report.certificate.subject, revocationOutpoint: report.certificate.revocationOutpoint, signature: report.certificate.signature, fields: report.certificate.fields }, fieldsToReveal: ['name'], verifier: PrivateKey.fromHex(config.verifierKeyHex).toPublicKey().toString() })
  const paymentArgs = (second = false) => ({ description: second ? 'TPNIL one-shot permission second payment' : 'TPNIL one-shot permission payment', outputs: [{ satoshis: second ? config.secondPaymentSatoshis : config.paymentSatoshis, lockingScript: report.paymentScript, outputDescription: 'Public permission fixture recipient' }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
  const originHeader = (page: Page) => page.getByRole('button').filter({ has: page.getByText(new URL(config.primary).host, { exact: true }) })
  const originCard = (page: Page) => originHeader(page).locator('..')
  const settingsScreen = async () => {
    settings ??= await context.context.newPage()
    await settings.goto(`chrome-extension://${extensionId}/index.html`)
    await settings.getByText('Settings', { exact: true }).last().click({ timeout: 10_000 })
    await settings.getByText('Permissions', { exact: true }).first().click({ timeout: 10_000 })
    await originHeader(settings).click({ timeout: 10_000 })
    await settings.getByRole('button', { name: 'Revoke All Access', exact: true }).waitFor({ timeout: 10_000 })
    return settings
  }
  try {
    report.identity = value(await request('identity', config.application, 'getPublicKey', { identityKey: true })).publicKey
    report.paymentScript = new P2PKH().lock(PrivateKey.fromHex(config.paymentRecipientKeyHex).toPublicKey().toAddress()).toHex()
    const created = value(await request('setup-basket', config.application, 'createAction', { description: 'TPNIL permission lifecycle basket fixture', outputs: [{ satoshis: config.basketAmount, lockingScript: '51', basket: config.basket, outputDescription: 'Permission lifecycle public fixture', customInstructions: 'tpnil:permission-lifecycle:1' }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } }, 'allow', true))
    if (!created.txid) throw new Error('Native fixture creation omitted its txid')
    report.setupOutpoint = `${created.txid}.0`
    if (Array.isArray(created.tx)) report.transactions.push({ role: 'setup-basket', txid: created.txid, atomicBeef: created.tx })
    const certificate = await issueFixtureCertificateForSubject(new ProtoWallet(PrivateKey.fromHex(config.issuerKeyHex)), report.identity, { ...config.fields }, config.certificateType, async () => `${'00'.repeat(32)}.0`, config.certificateSerial)
    report.certificate = clean({ ...certificate, signature: certificate.signature })
    value(await request('setup-certificate', config.application, 'acquireCertificate', { ...report.certificate, acquisitionProtocol: 'direct', keyringRevealer: 'certifier', keyringForSubject: certificate.masterKeyring }, 'allow', true))
    value(await request('primary-protocol-before', config.primary, 'getPublicKey', permissionArgs(false)))
    value(await request('alternate-protocol-before', config.alternate, 'getPublicKey', permissionArgs(false)))
    await request('basket-deny', config.primary, 'listOutputs', basketArgs(), 'deny')
    await request('basket-allow', config.primary, 'listOutputs', basketArgs(), 'allow')
    await request('basket-cached', config.primary, 'listOutputs', basketArgs())
    await request('certificate-deny', config.primary, 'proveCertificate', certificateArgs(), 'deny')
    await request('certificate-allow', config.primary, 'proveCertificate', certificateArgs(), 'allow')
    await request('certificate-cached', config.primary, 'proveCertificate', certificateArgs())
    await request('spending-deny', config.primary, 'createAction', paymentArgs(), 'deny')
    const payment = await request('spending-allow', config.primary, 'createAction', paymentArgs(), 'allow')
    if (payment.outcome.status === 'fulfilled' && payment.outcome.value?.txid && Array.isArray(payment.outcome.value.tx)) report.transactions.push({ role: 'spending-allow', txid: payment.outcome.value.txid, atomicBeef: payment.outcome.value.tx })
    await request('spending-second-deny', config.primary, 'createAction', paymentArgs(true), 'deny')
    await request('alternate-basket-allow', config.alternate, 'listOutputs', basketArgs(), 'allow')
    {
      const page = await settingsScreen(), row: any = { id: 'single-revoke', origin: config.primary, pageUrl: page.url(), startedAt: now(), cardHeading: new URL(config.primary).host, beforeBody: await originCard(page).innerText(), before: await screenshot(page, 'conformance/permission-lifecycle-single-before.png') }
      report.ui.push(row)
      const detail = originCard(page).getByText(`Can access: ${config.basket}`, { exact: true })
      const control = detail.locator('..').getByRole('button')
      row.control = { detail: `Can access: ${config.basket}`, role: 'button', count: await control.count() }
      row.clickedAt = now(); await control.click({ timeout: 5000 })
      await detail.waitFor({ state: 'hidden', timeout: 10_000 })
      row.afterDetailCount = await detail.count(); row.afterBody = await originCard(page).innerText(); row.after = await screenshot(page, 'conformance/permission-lifecycle-single-after.png'); row.endedAt = now()
    }
    await request('basket-after-single-deny', config.primary, 'listOutputs', basketArgs(), 'deny')
    await request('certificate-after-single-cached', config.primary, 'proveCertificate', certificateArgs())
    await request('basket-recovery-allow', config.primary, 'listOutputs', basketArgs(), 'allow')
    await request('basket-recovery-cached', config.primary, 'listOutputs', basketArgs())
    {
      const page = await settingsScreen(), row: any = { id: 'origin-revoke', origin: config.primary, pageUrl: page.url(), startedAt: now(), cardHeading: new URL(config.primary).host, beforeBody: await originCard(page).innerText(), before: await screenshot(page, 'conformance/permission-lifecycle-origin-before.png') }
      report.ui.push(row)
      row.button = 'Revoke All Access'; row.clickedAt = now(); await originCard(page).getByRole('button', { name: row.button, exact: true }).click({ timeout: 5000 })
      row.confirmationBody = await page.locator('body').innerText(); row.confirmation = await screenshot(page, 'conformance/permission-lifecycle-origin-confirm.png')
      row.confirmButton = 'Confirm'; row.confirmedAt = now(); await page.getByRole('button', { name: row.confirmButton, exact: true }).click({ timeout: 5000 })
      await originHeader(page).waitFor({ state: 'hidden', timeout: 10_000 })
      row.afterOriginCardCount = await originHeader(page).count(); row.afterBody = await page.locator('body').innerText(); row.after = await screenshot(page, 'conformance/permission-lifecycle-origin-after.png'); row.endedAt = now()
    }
    await request('basket-after-all-deny', config.primary, 'listOutputs', basketArgs(), 'deny')
    await request('certificate-after-all-deny', config.primary, 'proveCertificate', certificateArgs(), 'deny')
    await request('protocol-after-all', config.primary, 'getPublicKey', permissionArgs(false))
    await request('alternate-basket-after-all', config.alternate, 'listOutputs', basketArgs())
    await request('alternate-protocol-after-all', config.alternate, 'getPublicKey', permissionArgs(false))
  } catch (error) { report.errors.push(error instanceof Error ? error.message : String(error)) }
  finally {
    const closed = await Promise.allSettled([...pages.values()].map(page => page.close()))
    report.cleanup.applicationPagesClosed = closed.every(row => row.status === 'fulfilled') && [...pages.values()].every(page => page.isClosed())
    const prompts = await Promise.allSettled([...ownedPrompts].map(page => page.isClosed() ? Promise.resolve() : page.close()))
    report.cleanup.ownedPromptsClosed = prompts.every(row => row.status === 'fulfilled') && [...ownedPrompts].every(page => page.isClosed())
    try { await settings?.close(); report.cleanup.settingsPageClosed = !settings || settings.isClosed() } catch (error) { report.errors.push(String(error)) }
    report.submissions = services.submissions.map(row => ({ txid: row.txid, verdict: row.verdict, beefHex: Buffer.from(row.bytes).toString('hex') }))
    report.submissionWindow.endIndex = report.submissions.length
    report.submissionWindow.entries = report.submissions.slice(report.submissionWindow.startIndex).map((row, index) => ({ index: report.submissionWindow.startIndex + index, txid: row.txid, verdict: row.verdict, serializedHex: row.beefHex }))
    report.endedAt = now()
  }
  report.assertions = await evaluateNativePermissionLifecycle(report, name => { const bytes = screenshots.get(name); if (!bytes) throw new Error(`Missing permission screenshot ${name}`); return Buffer.from(bytes) }, report.identity)
  report.result = report.assertions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL'
  evidence.addJson('conformance/permission-lifecycle.json', report)
  return report
}
