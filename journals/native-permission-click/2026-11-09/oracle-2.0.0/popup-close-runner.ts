import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium } from '../synthesis/node_modules/playwright/index.mjs'
import { observePermissionClick, verifyPermissionClick } from '../synthesis/src/wallet-lab/native/permission-click.ts'
const directory=fs.mkdtempSync(path.resolve('out/permission-click-close-'))
const report:any={claim:'LAB_SELF_TEST_ONLY',purpose:'Actual trusted mouse click immediately closes popup while the public caller receives its terminal response',runs:[],cleanup:{}}
const browser=await chromium.launch({headless:true});const context=await browser.newContext();const app=await context.newPage()
try{
 await app.goto('about:blank');await app.evaluate(()=>{window.addEventListener('message',event=>{if(event.data?.kind==='terminal')(window as any).result={status:'rejected',settledAt:new Date().toISOString(),requestNonce:event.data.nonce}})})
 for(let i=0;i<20;i++){
  const requestNonce=randomUUID(),startedAt=new Date().toISOString();await app.evaluate(()=>{(window as any).result={status:'pending'}})
  const opened=context.waitForEvent('page');await app.evaluate(()=>window.open('about:blank'));const popup=await opened
  await popup.setContent('<button>Deny</button>');await popup.evaluate(nonce=>{document.querySelector('button')!.addEventListener('click',()=>{window.opener.postMessage({kind:'terminal',nonce},'*');window.close()})},requestNonce)
  const body=await popup.locator('body').innerText(),observedAt=new Date().toISOString();const click=await observePermissionClick(popup,'Deny',requestNonce)
  await app.waitForFunction(()=>(window as any).result.status!=='pending',undefined,{timeout:5000})
  const outcome=await app.evaluate(()=>(window as any).result),endedAt=new Date().toISOString()
  const observed={url:click.popupUrl,button:'Deny',body,observedAt,clickedAt:click.attemptStartedAt,clickCompletedAt:click.completedAt}
  verifyPermissionClick(click,observed,{requestNonce,startedAt,endedAt,outcome})
  report.runs.push({index:i,observed,click,startedAt,endedAt,outcome,popupClosed:popup.isClosed()})
 }
 report.result='PASS'
}catch(error){report.result='FAIL';report.error=String(error)}finally{await browser.close();report.cleanup.browser=true;fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({directory,result:report.result,runs:report.runs.length,closedTransportErrors:report.runs.filter((x:any)=>x.click.automation.status==='rejected').length,error:report.error}));if(report.result!=='PASS')process.exitCode=1}
