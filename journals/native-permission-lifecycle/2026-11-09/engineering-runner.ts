import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '../synthesis/node_modules/playwright/index.mjs'
import { PrivateKey } from '../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js'
import { EvidenceBundle } from '../synthesis/src/wallet-lab/evidence.ts'
import { runNativePermissionConformance } from '../synthesis/src/wallet-lab/native/conformance-permissions.ts'
import { runNativePermissionLifecycle } from '../synthesis/src/wallet-lab/native/conformance-permission-lifecycle.ts'
import { verifyNativePermissionLifecycle } from '../synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts'
import { ControlledWalletServices } from '../synthesis/src/wallet-lab/services.ts'
const root=path.resolve(import.meta.dirname,'..'), implementation=process.argv[2]??'typescript'
const output=fs.mkdtempSync(path.join(root,'out/native-permission-lifecycle-'))
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-permission-lifecycle-'))
const services=new ControlledWalletServices({webroot:path.join(root,'out/sut-artifacts/todo-ts-236733c/webroot'),components:{storage:implementation as any},...(implementation==='go'?{go:{binary:path.join(root,'out/itcve-go-storage-portability'),storagePortabilityPatch:true,terminalRejectionReceipts:true}}:{typescriptDescendantExport:true})})
for(const file of ['conformance-permission-lifecycle.ts','conformance-permission-lifecycle-model.ts','verify-conformance-permission-lifecycle.ts']){fs.mkdirSync(path.join(output,'source'),{recursive:true});fs.copyFileSync(path.join(root,'synthesis/src/wallet-lab/native',file),path.join(output,'source',file))}
const evidence=new EvidenceBundle(output),report:any={claim:'ENGINEERING_OBSERVATION_ONLY',platform:process.platform,architecture:process.arch,implementation,startedAt:new Date().toISOString(),logs:[],bootstrap:[],cleanup:{}}
let context:any,automatic=true,timer:any
try{
 await services.start()
 const extension=path.join(root,'out/sut-artifacts/yours-wallet-v5.1.0/unpacked/build')
 context=await chromium.launchPersistentContext(profile,{headless:false,ignoreHTTPSErrors:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,`--proxy-server=${services.proxyUrl}`,'--proxy-bypass-list=<-loopback>','--ignore-certificate-errors','--disable-background-networking']})
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).host
 worker.on('console',(m:any)=>{const text=m.text();if(/permission|createAction|ERROR|failed|revoke/i.test(text))report.logs.push(text)})
 context.on('console',(m:any)=>{const text=m.text();if(/permission|createAction|ERROR|failed|revoke/i.test(text))report.logs.push(text)})
 let polling=false
 timer=setInterval(async()=>{if(!automatic||polling)return;polling=true;try{for(const page of context.pages()){if(page.isClosed()||!page.url().startsWith(`chrome-extension://${extensionId}/prompt.html`))continue;const body=await page.locator('body').innerText({timeout:500}).catch(()=>'');if(!body.includes('todo.itcve.test'))continue;const button=page.getByRole('button',{name:/^Allow(?: Selected)?$/,exact:true});if(await button.count()){report.bootstrap.push({at:new Date().toISOString(),body});await button.click({timeout:1000}).catch(()=>{})}}}finally{polling=false}},50)
 const walletPage=await context.newPage();await walletPage.goto(`chrome-extension://${extensionId}/index.html`)
 await walletPage.getByText('Create New Wallet',{exact:true}).click();await walletPage.getByPlaceholder('Account Name').fill('TPNIL Permission Lifecycle');await walletPage.getByPlaceholder('Password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await walletPage.getByPlaceholder('Confirm password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await walletPage.getByRole('button',{name:/Generate Seed/i}).click();await walletPage.getByRole('button',{name:/Copy to Clipboard/i}).click();await walletPage.getByRole('button',{name:/Next/i}).click();await walletPage.getByText('Wallet Ready!',{exact:false}).waitFor({timeout:45000});await walletPage.getByRole('button',{name:'Enter',exact:true}).click()
 const application=await context.newPage();await application.goto('https://todo.itcve.test/');await application.waitForFunction(()=>typeof(window as any).CWI?.getPublicKey==='function')
 const call=async(method:string,args:any)=>{console.log('BOOTSTRAP CALL',method);return await Promise.race([application.evaluate(async({method,args})=>(window as any).CWI[method](args),{method,args}),new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Bootstrap ${method} timed out`)),45000))]) as any}
 const identity=await call('getPublicKey',{identityKey:true});report.identity=identity.publicKey
 const senderIdentityKey=PrivateKey.fromHex('22'.repeat(32)).toPublicKey().toString(),derivationPrefix=Buffer.from('tpnil-permission-lifecycle').toString('base64'),derivationSuffix=Buffer.from('initial-funding').toString('base64')
 const pub=await call('getPublicKey',{protocolID:[2,'3241645161d8'],keyID:`${derivationPrefix} ${derivationSuffix}`,counterparty:senderIdentityKey,forSelf:true})
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixtures/teranode/wab-funding-v1.json'),'utf8'));report.faucet=await services.fundRemoteWalletFromTeranode('77'.repeat(32),fixture);report.payment=await services.payNativeWallet(pub.publicKey,10000)
 report.internalized=await call('internalizeAction',{tx:report.payment.tx,outputs:[{outputIndex:0,protocol:'wallet payment',paymentRemittance:{senderIdentityKey,derivationPrefix,derivationSuffix}}],description:'TPNIL permission lifecycle preflight funding'})
 automatic=false;while(polling)await new Promise(resolve=>setTimeout(resolve,25));clearInterval(timer)
 report.originalPermissions=await runNativePermissionConformance({context,evidence,extensionId});evidence.flush();console.log('ORIGINAL',report.originalPermissions.result)
 report.lifecycle=await runNativePermissionLifecycle({application,context,extensionId,password:'TPNIL-Fixture-Only-2026!',services,evidence,baselineVectors:[],manualPrompt:async op=>await op()})
 evidence.flush();report.verified=await verifyNativePermissionLifecycle(JSON.parse(fs.readFileSync(path.join(output,'evidence/conformance/permission-lifecycle.json'),'utf8')),name=>fs.readFileSync(path.join(output,'evidence',name)),report.identity)
 console.log('LIFECYCLE',JSON.stringify(report.verified))
}catch(error){report.pages=await Promise.all((context?.pages()??[]).map(async(page:any)=>({url:page.url(),body:page.url().includes('prompt.html')?await page.locator('body').innerText().catch(()=>''):''})));report.error=error instanceof Error?error.stack:String(error);console.log('ERROR',report.error)}finally{automatic=false;clearInterval(timer);try{await context?.close();report.cleanup.browser=true}catch(error){report.cleanup.browser=String(error)}try{await services.close();report.cleanup.services=true}catch(error){report.cleanup.services=String(error)}fs.rmSync(profile,{recursive:true,force:true});report.cleanup.profile=true;evidence.flush();report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log('OUTPUT',output)}
