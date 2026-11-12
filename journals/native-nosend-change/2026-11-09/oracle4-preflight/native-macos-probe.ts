import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chromium } from '../synthesis/node_modules/playwright/index.mjs'
import { PrivateKey } from '../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js'
import { ControlledWalletServices } from '../synthesis/src/wallet-lab/services.ts'
import { prepareNoSendChangeFixture, noSendChangeInputId, noSendChangeOutputId, clauseOracle4Id } from '../synthesis/src/wallet-lab/native/conformance-nosend-change.ts'
import { deriveClauseOutcomes } from '../synthesis/src/wallet-lab/native/verify-conformance-clauses.ts'
import { verifyNoSendChangeFixture } from '../synthesis/src/wallet-lab/native/verify-conformance-nosend-change.ts'
import { captureClauseError } from '../synthesis/src/wallet-lab/native/conformance-clauses.ts'
const root=path.resolve(import.meta.dirname,'..'), out=fs.mkdtempSync(path.join(root,'out/nosend-native-engineering-')), profile=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-nosend-native-'))
const plan=JSON.parse(fs.readFileSync(path.join(root,'infra/native/conformance/plan.json'),'utf8'))
const archive=fs.readFileSync(path.join(root,'out/sut-artifacts/yours-wallet-v5.1.0/pw-v5.1.0.zip'))
assert.equal(createHash('sha256').update(archive).digest('hex'),plan.wallet.sha256)
const services=new ControlledWalletServices({webroot:path.join(root,'out/sut-artifacts/todo-ts-236733c/webroot'),components:{storage:'go'},go:{binary:path.join(root,'out/itcve-go-storage-portability'),storagePortabilityPatch:true}})
const report:any={schema:'tpnil-nosend-native-engineering@1',claim:'ENGINEERING_OBSERVATION_ONLY',qualification:false,platform:process.platform,architecture:process.arch,wallet:plan.wallet,oracle:clauseOracle4Id,positives:[],trace:[],prompts:[],cleanup:{},startedAt:new Date().toISOString()}
let context:any,poll:any
const active=new Set<any>()
try{
 await services.start();await services.fundRemoteWalletFromTeranode('77'.repeat(32),JSON.parse(fs.readFileSync(path.join(root,'fixtures/teranode/wab-funding-v1.json'),'utf8')))
 const ext=path.join(root,'out/sut-artifacts/yours-wallet-v5.1.0/unpacked/build')
 context=await chromium.launchPersistentContext(profile,{headless:false,ignoreHTTPSErrors:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,`--proxy-server=${services.proxyUrl}`,'--proxy-bypass-list=<-loopback>','--ignore-certificate-errors','--disable-background-networking']})
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker'), extensionId=new URL(worker.url()).host
 poll=setInterval(()=>{for(const page of context.pages())if(!page.isClosed()&&page.url().startsWith(`chrome-extension://${extensionId}/prompt.html`)&&!active.has(page)){active.add(page);void(async()=>{try{const button=page.getByRole('button',{name:/^Allow(?: Selected)?$/,exact:true}).first();if(await button.isVisible()){const body=await page.locator('body').innerText();report.prompts.push({at:new Date().toISOString(),body});await button.click({timeout:3000})}}catch(e){report.promptError=String(e)}finally{active.delete(page)}})()}},100)
 const ui=await context.newPage();await ui.goto(`chrome-extension://${extensionId}/index.html`)
 await ui.getByText('Create New Wallet',{exact:true}).click();await ui.getByPlaceholder('Account Name').fill('TPNIL noSend Fixture');await ui.getByPlaceholder('Password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await ui.getByPlaceholder('Confirm password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await ui.getByRole('button',{name:/Generate Seed/i}).click();await ui.getByRole('button',{name:/Copy to Clipboard/i}).click();await ui.getByRole('button',{name:/Next/i}).click();await ui.getByText('Wallet Ready!',{exact:false}).waitFor({timeout:45000});await ui.getByRole('button',{name:'Enter',exact:true}).click()
 const app=await context.newPage();await app.goto('https://deny.itcve.test/');await app.waitForFunction(()=>typeof(window as any).CWI?.createAction==='function',undefined,{timeout:30000})
 const call=async(id:string,method:string,args:any)=>{const row:any={id,method,args:structuredClone(args),startedAt:new Date().toISOString()};report.trace.push(row);try{row.result=await Promise.race([app.evaluate(async({method,args}:any)=>(window as any).CWI[method](args),{method,args}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Engineering public call timeout')),45000))])}catch(e){row.error=captureClauseError(e)}row.endedAt=new Date().toISOString();return row}
 const identity=await call('funding.identity','getPublicKey',{identityKey:true});report.identity=identity.result.publicKey
 const senderIdentityKey=PrivateKey.fromHex('22'.repeat(32)).toPublicKey().toString(), derivationPrefix=Buffer.from('tpnil-nosend-preflight').toString('base64'),derivationSuffix=Buffer.from('payment-1').toString('base64')
 const key=await call('funding.key','getPublicKey',{protocolID:[2,'3241645161d8'],keyID:`${derivationPrefix} ${derivationSuffix}`,counterparty:senderIdentityKey,forSelf:true})
 const payment=await services.payNativeWallet(key.result.publicKey,10000);report.funding=payment
 const internalized=await call('funding.internalize','internalizeAction',{tx:payment.tx,outputs:[{outputIndex:0,protocol:'wallet payment',paymentRemittance:{senderIdentityKey,derivationPrefix,derivationSuffix}}],description:'TPNIL noSend native preflight funding'})
 assert.equal(internalized.result?.accepted,true)
 const prepared=await prepareNoSendChangeFixture(call);report.preparedOutpoints=prepared.outpoints;assert.ok(prepared.outpoints?.length)
 const base={description:'TPNIL parameter validation fixture',outputs:[{satoshis:1,lockingScript:'51',outputDescription:'TPNIL validation output',basket:'tpnil clause parameters',tags:['clause'],customInstructions:'fixture'}],labels:['tpnil-clauses'],options:{signAndProcess:false,noSend:true,randomizeOutputs:false,noSendChange:prepared.outpoints}}
 const control=await call(`control.${noSendChangeInputId}`,'createAction',base);if(control.result?.signableTransaction?.reference)await call('cleanup.control','abortAction',{reference:control.result.signableTransaction.reference})
 const invalid=[...prepared.outpoints];invalid[0]='!invalid!'
 const negative=await call(noSendChangeInputId,'createAction',{...base,options:{...base.options,noSendChange:invalid}});Object.assign(negative,{base,controlId:control.id,controlUsesFreshReference:false})
 if(negative.result?.signableTransaction?.reference)await call('cleanup.negative','abortAction',{reference:negative.result.signableTransaction.reference})
 await call('cleanup.batch','createAction',{description:'TPNIL release noSend preflight',options:{sendWith:[prepared.pendingBatch.result.txid],acceptDelayedBroadcast:false}})
 report.anchorVerified=await verifyNoSendChangeFixture(report)
 report.assertions=(await deriveClauseOutcomes(report)).filter(r=>[noSendChangeInputId,noSendChangeOutputId].includes(r.id));await app.screenshot({path:path.join(out,'application.png')})
}catch(e){report.error=String(e)}finally{clearInterval(poll);try{await context?.close();report.cleanup.browser=true}catch(e){report.cleanup.browser=String(e)}try{await services.close();report.cleanup.services=true}catch(e){report.cleanup.services=String(e)}fs.rmSync(profile,{recursive:true,force:true});report.cleanup.profile=!fs.existsSync(profile);report.endedAt=new Date().toISOString();report.components=services.componentIdentity;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,error:report.error,assertions:report.assertions,cleanup:report.cleanup}))}
