// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto'
import type { BrowserContext, Page } from 'playwright'
import type { EvidenceBundle } from '../evidence.js'
import { permissionArgs, permissionProtocol, permissionSteps, type PermissionConformanceReport, type PermissionStepObservation } from './conformance-permissions-model.js'
import { evaluateNativePermissionConformance } from './verify-conformance-permissions.js'

const now = () => new Date().toISOString()
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const callTimeoutMs = 30_000

/** The caller suspends its usual prompt automation for this entire scenario.
 * Every request uses the unchanged application's public CWI; only matching,
 * visible protocol prompts are operated by this controller. */
export async function runNativePermissionConformance({ context, evidence, extensionId }: {
  context: BrowserContext; evidence: EvidenceBundle; extensionId: string
}): Promise<PermissionConformanceReport> {
  const pages = new Map<string, Page>(), ownedPrompts = new Set<Page>(), screenshots = new Map<string, Uint8Array>()
  const report: PermissionConformanceReport = { schema: 'tpnil-native-permission-conformance@1', claim: 'ENGINEERING_OBSERVATION_ONLY', vector: 'ISI-4-V005', interface: 'unchanged native wallet public CWI and visible permission UI', extensionId, steps: [], assertions: [], result: 'FAIL', cleanup: { applicationPagesClosed: false, ownedPromptsClosed: false } }
  try {
    for (const expected of permissionSteps) {
      const row = { id: expected.id, origin: expected.origin, pageUrl: `${expected.origin}/`, method: 'getPublicKey', args: permissionArgs(expected.seekPermission), startedAt: now(), endedAt: '', prompts: [], outcome: { status: 'observer-error', message: 'Request did not start' } } as PermissionStepObservation
      report.steps.push(row)
      try {
        const handledForStep = new Set<Page>()
        let page = pages.get(expected.origin)
        if (!page) {
          page = await context.newPage(); pages.set(expected.origin, page)
          await page.goto(`${expected.origin}/`, { timeout: callTimeoutMs })
          await page.getByText('TPNIL boundary fixture', { exact: true }).waitFor({ state: 'visible', timeout: callTimeoutMs })
          await page.waitForFunction(() => typeof (window as any).CWI?.getPublicKey === 'function', undefined, { timeout: callTimeoutMs })
        }
        row.pageUrl = page.url()
        await page.evaluate(({ id, args }) => {
          const state = ((window as any).__tpnilPermissionProbe ??= {})
          state[id] = { status: 'pending' }
          void Promise.resolve().then(() => (window as any).CWI.getPublicKey(args)).then(value => {
            state[id] = { status: 'fulfilled', value, settledAt: new Date().toISOString() }
          }, error => { state[id] = { status: 'rejected', error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) }, settledAt: new Date().toISOString() } })
        }, { id: expected.id, args: row.args })
        const deadline = Date.now() + callTimeoutMs
        for (;;) {
          const state = await page.evaluate(id => (window as any).__tpnilPermissionProbe[id], expected.id)
          if (state.status !== 'pending') { row.outcome = state; break }
          if (Date.now() >= deadline) { row.outcome = { status: 'timeout', message: 'Native permission request did not settle within the frozen observation interval' }; break }
          for (const popup of context.pages()) {
            if (popup.isClosed() || !popup.url().startsWith(`chrome-extension://${extensionId}/prompt.html`) || handledForStep.has(popup)) continue
            let body: string
            try { body = await popup.locator('body').innerText({ timeout: 1000 }) } catch { continue }
            const lines = body.split('\n').map(line => line.trim()).filter(Boolean)
            if (lines[0] !== 'Protocol Permission' || lines[lines.indexOf('Origin') + 1] !== new URL(expected.origin).host || lines[lines.indexOf('Protocol') + 1] !== permissionProtocol[1]) continue
            ownedPrompts.add(popup)
            handledForStep.add(popup)
            if (!('decision' in expected)) throw new Error('Wallet displayed a permission prompt despite seekPermission=false')
            const observedAt = now(), pending = await page.evaluate(id => (window as any).__tpnilPermissionProbe[id].status === 'pending', expected.id)
            const bytes = await popup.screenshot({ type: 'png', timeout: 5000 }), name = `conformance/permissions-${expected.id}.png`
            evidence.addBytes(name, bytes); screenshots.set(name, bytes)
            const button = expected.decision === 'allow' ? 'Allow' : 'Deny'
            const observation = { url: popup.url(), body, observedAt, pendingBeforeDecision: pending, decision: expected.decision, button, clickedAt: now(), clickCompletedAt: '', screenshot: { name, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length } }
            row.prompts.push(observation)
            await popup.getByRole('button', { name: button, exact: true }).click({ timeout: 5000 })
            observation.clickCompletedAt = now()
          }
          await pause(25)
        }
      } catch (error) { row.outcome = { status: 'observer-error', message: error instanceof Error ? error.message : String(error) } }
      finally { row.endedAt = now() }
    }
  } finally {
    const closed = await Promise.allSettled([...pages.values()].map(page => page.close()))
    report.cleanup.applicationPagesClosed = closed.every(result => result.status === 'fulfilled') && [...pages.values()].every(page => page.isClosed())
    const promptsClosed = await Promise.allSettled([...ownedPrompts].map(page => page.isClosed() ? Promise.resolve() : page.close()))
    report.cleanup.ownedPromptsClosed = promptsClosed.every(result => result.status === 'fulfilled') && [...ownedPrompts].every(page => page.isClosed())
  }
  report.assertions = evaluateNativePermissionConformance(report, name => { const bytes = screenshots.get(name); if (!bytes) throw new Error(`Missing screenshot: ${name}`); return bytes })
  report.result = report.assertions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL'
  evidence.addJson('conformance/permissions.json', report)
  return report
}
