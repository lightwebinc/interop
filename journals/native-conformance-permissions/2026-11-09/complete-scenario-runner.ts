import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '../synthesis/node_modules/playwright/index.mjs'
import { EvidenceBundle } from '../synthesis/src/wallet-lab/evidence.ts'
import { runNativePermissionConformance } from '../synthesis/src/wallet-lab/native/conformance-permissions.ts'
import { verifyNativePermissionConformance } from '../synthesis/src/wallet-lab/native/verify-conformance-permissions.ts'
import { ControlledWalletServices } from '../synthesis/src/wallet-lab/services.ts'
const root = path.resolve(import.meta.dirname, '..')
const out = fs.mkdtempSync(path.join(root, 'out/permission-preflight-'))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-permission-profile-'))
const services = new ControlledWalletServices({ webroot: path.join(root, 'out/sut-artifacts/todo-ts-236733c/webroot') })
let context: any
const report: any = { claim: 'ENGINEERING_OBSERVATION_ONLY', platform: process.platform, architecture: process.arch, calls: [], prompts: [], logs: [], cleanup: {} }
try {
 await services.start()
 const ext = path.join(root, 'out/sut-artifacts/yours-wallet-v5.1.0/unpacked/build')
 context = await chromium.launchPersistentContext(profile, {headless:false,ignoreHTTPSErrors:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,`--proxy-server=${services.proxyUrl}`,'--proxy-bypass-list=<-loopback>','--ignore-certificate-errors','--disable-background-networking']})
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker')
 worker.on('console',(m:any)=>{const t=m.text();if(/permission|processCWIGetPublicKey|originator/i.test(t))report.logs.push(t)})
 context.on('console',(m:any)=>{const t=m.text();if(/permission|processCWIGetPublicKey|originator/i.test(t))report.logs.push(t)})
 const walletPage=await context.newPage();await walletPage.goto(`chrome-extension://${new URL(worker.url()).host}/index.html`)
 await walletPage.getByText('Create New Wallet',{exact:true}).click();await walletPage.getByPlaceholder('Account Name').fill('TPNIL Permission Fixture');await walletPage.getByPlaceholder('Password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await walletPage.getByPlaceholder('Confirm password',{exact:true}).fill('TPNIL-Fixture-Only-2026!');await walletPage.getByRole('button',{name:/Generate Seed/i}).click();await walletPage.getByRole('button',{name:/Copy to Clipboard/i}).click();await walletPage.getByRole('button',{name:/Next/i}).click();await walletPage.getByText('Wallet Ready!',{exact:false}).waitFor({timeout:45000});await walletPage.getByRole('button',{name:'Enter',exact:true}).click()
 const evidence=new EvidenceBundle(out);report.permissionConformance=await runNativePermissionConformance({context,evidence,extensionId:new URL(worker.url()).host});evidence.flush();report.verified=verifyNativePermissionConformance(report.permissionConformance,name=>fs.readFileSync(path.join(out,'evidence',name)));console.log('CONFORMANCE',JSON.stringify(report.verified));
}catch(e){report.error=String(e);console.log('ERROR',String(e))}finally{await context?.close();report.cleanup.browser=true;await services.close();report.cleanup.services=true;fs.rmSync(profile,{recursive:true,force:true});report.cleanup.profile=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log('OUTPUT',out)}
