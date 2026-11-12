import { describe, expect, it } from 'vitest'
import { verifyPermissionClick, verifyPermissionCallNonces, type PermissionClickReceipt } from '../src/wallet-lab/native/permission-click.js'
const at = (offset: number) => new Date(1800000000000 + offset).toISOString()
// LAB_SELF_TEST_ONLY: adversarial observer records, never native execution evidence.
function fixture() {
  const nonce = '11111111-1111-4111-8111-111111111111', callNonce = '22222222-2222-4222-8222-222222222222'
  const url = `chrome-extension://${'a'.repeat(32)}/prompt.html?kind=permission`, body = 'Protocol Permission\nOrigin\ndeny.itcve.test\nDeny'
  const receipt: PermissionClickReceipt = { schema: 'tpnil-native-permission-click@2', nonce, callNonce, popupUrl: url, button: 'Deny', armedAt: at(20), attemptStartedAt: at(30), completedAt: at(70), automation: { status: 'fulfilled', endedAt: at(60) }, dispatch: { nonce, url, button: 'Deny', body, type: 'click', isTrusted: true, visible: true, disabled: false, mouseButton: 0, eventPhase: 1, dispatchedAt: at(40), receivedAt: at(50), expectedPage: true, expectedMainFrame: true } }
  const observed = { url, button: 'Deny', body, observedAt: at(10), clickedAt: at(30), clickCompletedAt: at(70) }
  // The native promise may settle before automation completion or even before
  // the host receives its already-dispatched passive DOM event.
  const step = { requestNonce: callNonce, startedAt: at(0), endedAt: at(80), outcome: { status: 'rejected', requestNonce: callNonce, settledAt: at(45) } }
  return { receipt, observed, step }
}
describe('trusted permission-click causal observer', () => {
  it('accepts real-event-before-result ordering without requiring click-promise completion first', () => {
    const {receipt,observed,step}=fixture();expect(()=>verifyPermissionClick(receipt,observed,step)).not.toThrow()
  })
  it('retains a target-closed automation failure only with actual event and subsequent native result', () => {
    const {receipt,observed,step}=fixture();receipt.automation={status:'rejected',endedAt:at(60),error:'locator.click: Target page, context or browser has been closed'}
    expect(()=>verifyPermissionClick(receipt,observed,step)).not.toThrow()
  })
  it.each([
    ['popup closed without event',(r:any)=>{r.receipt.dispatch=null}],
    ['synthetic event',(r:any)=>{r.receipt.dispatch.isTrusted=false}],
    ['wrong button',(r:any)=>{r.receipt.dispatch.button='Allow'}],
    ['wrong prompt body',(r:any)=>{r.receipt.dispatch.body='Unrelated request'}],
    ['wrong popup',(r:any)=>{r.receipt.dispatch.url='about:blank'}],
    ['wrong page',(r:any)=>{r.receipt.dispatch.expectedPage=false}],
    ['wrong frame',(r:any)=>{r.receipt.dispatch.expectedMainFrame=false}],
    ['disabled control',(r:any)=>{r.receipt.dispatch.disabled=true}],
    ['hidden control',(r:any)=>{r.receipt.dispatch.visible=false}],
    ['right click',(r:any)=>{r.receipt.dispatch.mouseButton=2}],
    ['bubble-phase observation',(r:any)=>{r.receipt.dispatch.eventPhase=3}],
    ['another request',(r:any)=>{r.receipt.callNonce='33333333-3333-4333-8333-333333333333'}],
    ['another terminal result',(r:any)=>{r.step.outcome.requestNonce='33333333-3333-4333-8333-333333333333'}],
    ['another click',(r:any)=>{r.receipt.dispatch.nonce='33333333-3333-4333-8333-333333333333'}],
    ['result before actual dispatch',(r:any)=>{r.step.outcome.settledAt=at(35)}],
    ['no terminal native result',(r:any)=>{r.step.outcome.status='timeout'}],
    ['missing host receipt',(r:any)=>{r.receipt.dispatch.receivedAt=''}],
    ['host receipt before event',(r:any)=>{r.receipt.dispatch.receivedAt=at(35)}],
    ['automation error unrelated to close',(r:any)=>{r.receipt.automation={status:'rejected',endedAt:at(60),error:'locator.click timeout waiting for invisible button'}}]
  ])('rejects false approval evidence: %s',(_name,mutate)=>{const r=fixture();mutate(r);expect(()=>verifyPermissionClick(r.receipt,r.observed,r.step)).toThrow()})
  it('requires distinct request nonces and binds cached terminal results too',()=>{
    const r=fixture(),first={...r.step,prompts:[{trustedClick:r.receipt}]},second={requestNonce:'33333333-3333-4333-8333-333333333333',outcome:{status:'fulfilled',requestNonce:'33333333-3333-4333-8333-333333333333'},prompts:[]}
    expect(()=>verifyPermissionCallNonces([first,second])).not.toThrow()
    second.outcome.requestNonce=first.requestNonce;expect(()=>verifyPermissionCallNonces([first,second])).toThrow()
    second.requestNonce=first.requestNonce;expect(()=>verifyPermissionCallNonces([first,second])).toThrow()
  })
  it('rejects reuse of one captured click for a second decision',()=>{
    const r=fixture(),first={...r.step,prompts:[{trustedClick:r.receipt}]},second=structuredClone(first)
    second.requestNonce='33333333-3333-4333-8333-333333333333';second.outcome.requestNonce=second.requestNonce;second.prompts[0]!.trustedClick.callNonce=second.requestNonce
    expect(()=>verifyPermissionCallNonces([first,second])).toThrow('cannot be replayed')
  })
})
