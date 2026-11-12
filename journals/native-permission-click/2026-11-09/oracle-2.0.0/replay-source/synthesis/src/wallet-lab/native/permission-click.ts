import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Page } from 'playwright'

export interface PermissionClickReceipt {
  schema: 'tpnil-native-permission-click@2'; nonce: string; callNonce: string; popupUrl: string; button: string
  armedAt: string; attemptStartedAt: string; completedAt: string
  automation: { status: 'fulfilled' | 'rejected'; endedAt: string; error?: string }
  dispatch: null | {
    nonce: string; url: string; button: string; body: string; type: string; isTrusted: boolean
    visible: boolean; disabled: boolean; mouseButton: number; eventPhase: number
    dispatchedAt: string; receivedAt: string; expectedPage: boolean; expectedMainFrame: boolean
  }
}
const now = () => new Date().toISOString()
/** Passive DOM capture only: it neither triggers a click nor changes wallet
 * handlers. The host receipt survives the popup closing during its bubble handler. */
export async function observePermissionClick(popup: Page, button: string, callNonce: string): Promise<PermissionClickReceipt> {
  const nonce = randomUUID(), binding = `__tpnilClick_${nonce.replaceAll('-', '')}`
  const receipt: PermissionClickReceipt = { schema: 'tpnil-native-permission-click@2', nonce, callNonce, popupUrl: popup.url(), button, armedAt: '', attemptStartedAt: '', completedAt: '', automation: { status: 'rejected', endedAt: '', error: 'Click not attempted' }, dispatch: null }
  let receive!: () => void
  const received = new Promise<void>(resolve => { receive = resolve })
  await popup.exposeBinding(binding, (source, event) => {
    if (receipt.dispatch !== null) return
    receipt.dispatch = { ...event, receivedAt: now(), expectedPage: source.page === popup, expectedMainFrame: source.frame === popup.mainFrame() }
    receive()
  })
  await popup.evaluate(({ binding, nonce, button }) => {
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null
      if (!(target instanceof HTMLButtonElement) || target.innerText.trim() !== button) return
      const box = target.getBoundingClientRect()
      // Capture phase runs before the wallet's React/bubble handler closes the
      // popup. Do not await, cancel, stop propagation or invoke any wallet API.
      void (window as any)[binding]({ nonce, url: location.href, button: target.innerText.trim(), body: document.body.innerText,
        type: event.type, isTrusted: event.isTrusted, visible: box.width > 0 && box.height > 0,
        disabled: target.disabled, mouseButton: event.button, eventPhase: event.eventPhase, dispatchedAt: new Date().toISOString() })
    }, { capture: true, passive: true, once: true })
  }, { binding, nonce, button })
  receipt.armedAt = now(); receipt.attemptStartedAt = now()
  try {
    await popup.getByRole('button', { name: button, exact: true }).click({ timeout: 5000 })
    receipt.automation = { status: 'fulfilled', endedAt: now() }
  } catch (error) { receipt.automation = { status: 'rejected', endedAt: now(), error: error instanceof Error ? error.message : String(error) } }
  if (receipt.dispatch === null) {
    let timer: ReturnType<typeof setTimeout> | undefined
    await Promise.race([received, new Promise<void>(resolve => { timer = setTimeout(resolve, 1000) })])
    if (timer) clearTimeout(timer)
  }
  receipt.completedAt = now()
  return receipt
}
const instant = (value: string) => { const result = Date.parse(value); assert.ok(Number.isFinite(result), `Invalid recorded timestamp: ${value}`); return result }
export function verifyPermissionClick(receipt: PermissionClickReceipt | undefined, observed: { url: string; button: string; body: string; observedAt: string; clickedAt: string; clickCompletedAt: string }, step: { startedAt: string; endedAt: string; requestNonce?: string; outcome: { status: string; settledAt?: string; requestNonce?: string } }): void {
  assert.ok(receipt, 'Missing trusted click receipt'); assert.equal(receipt.schema, 'tpnil-native-permission-click@2'); assert.match(receipt.nonce, /^[a-f0-9-]{36}$/)
  assert.match(receipt.callNonce, /^[a-f0-9-]{36}$/); assert.equal(receipt.callNonce, step.requestNonce); assert.equal(step.outcome.requestNonce, step.requestNonce)
  assert.equal(receipt.popupUrl, observed.url); assert.equal(receipt.button, observed.button)
  assert.equal(receipt.attemptStartedAt, observed.clickedAt); assert.equal(receipt.completedAt, observed.clickCompletedAt)
  const event = receipt.dispatch; assert.ok(event, 'Popup closure alone does not prove a UI decision')
  assert.equal(event.nonce, receipt.nonce); assert.equal(event.url, observed.url); assert.equal(event.button, observed.button); assert.equal(event.body, observed.body)
  assert.equal(event.type, 'click'); assert.equal(event.isTrusted, true); assert.equal(event.visible, true); assert.equal(event.disabled, false)
  assert.equal(event.mouseButton, 0); assert.equal(event.eventPhase, 1); assert.equal(event.expectedPage, true); assert.equal(event.expectedMainFrame, true)
  assert.ok(instant(step.startedAt) <= instant(observed.observedAt) && instant(observed.observedAt) <= instant(receipt.armedAt) && instant(receipt.armedAt) <= instant(receipt.attemptStartedAt))
  assert.ok(instant(receipt.attemptStartedAt) <= instant(event.dispatchedAt) && instant(event.dispatchedAt) <= instant(event.receivedAt) && instant(event.receivedAt) <= instant(receipt.completedAt))
  assert.ok(instant(receipt.attemptStartedAt) <= instant(receipt.automation.endedAt) && instant(receipt.automation.endedAt) <= instant(receipt.completedAt) && instant(receipt.completedAt) <= instant(step.endedAt))
  assert.ok(['fulfilled', 'rejected'].includes(step.outcome.status), 'A real terminal native CWI result is required after the UI decision')
  assert.ok(step.outcome.settledAt && instant(event.dispatchedAt) <= instant(step.outcome.settledAt) && instant(step.outcome.settledAt) <= instant(step.endedAt), 'Native result must follow the actual trusted UI event')
  if (receipt.automation.status === 'rejected') assert.match(receipt.automation.error ?? '', /Target page, context or browser has been closed|Target closed/i)
  else { assert.equal(receipt.automation.status, 'fulfilled'); assert.equal(receipt.automation.error, undefined) }
}

export function verifyPermissionCallNonces(steps: Array<{ requestNonce?: string; outcome: { status: string; requestNonce?: string }; prompts: Array<{ trustedClick?: PermissionClickReceipt }> }>): void {
  const requests = new Set<string>(), clicks = new Set<string>()
  for (const step of steps) {
    assert.match(step.requestNonce ?? '', /^[a-f0-9-]{36}$/); assert.ok(!requests.has(step.requestNonce!), 'Each public request needs a distinct observation nonce'); requests.add(step.requestNonce!)
    if (['fulfilled', 'rejected'].includes(step.outcome.status)) assert.equal(step.outcome.requestNonce, step.requestNonce, 'Every native terminal result, including cached calls, must match its original request')
    for (const prompt of step.prompts) if (prompt.trustedClick) {
      assert.equal(prompt.trustedClick.callNonce, step.requestNonce)
      assert.ok(!clicks.has(prompt.trustedClick.nonce), 'A trusted UI event cannot be replayed for another decision'); clicks.add(prompt.trustedClick.nonce)
    }
  }
}
