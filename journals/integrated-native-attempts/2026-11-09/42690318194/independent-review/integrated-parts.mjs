import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..'),input=path.join(root,'out/native-ci-42690318194'),output=path.join(root,'out/native-review-42690318194'),hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const reports=[]
for(const repetition of [1,2]){
 const directory=path.join(input,`repetition-${repetition}/evidence/integrated`),read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8')),identity=read('result.json').walletIdentity
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-native6-independent-'))
 const jobs=[]
 try{
  for(const name of ['relay.json','paid-http.json'])fs.copyFileSync(path.join(directory,name),path.join(temp,name))
  fs.writeFileSync(path.join(temp,'result.json'),JSON.stringify({schema:'tpnil-component-result@1',assertions:[...read('relay.json').assertions,...read('paid-http.json').assertions],evidence:['relay.json','paid-http.json'].map(name=>({path:name,sha256:hash(fs.readFileSync(path.join(temp,name)))})),cleanup:{nativeEnvelopeVerified:true}}))
  for(const [name,args] of [['verify-transport.mjs',[temp]],['verify-native-messaging.mjs',[directory]],['verify-native-synthesis.mjs',[directory,'--integrated',identity]],['verify-wallet-boundary.mjs',[directory,'--integrated']],['verify-native-trust.mjs',[directory]]]){
   const result=spawnSync(process.execPath,[path.join(root,'scripts',name),...args],{encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024}),log=`integrated-${repetition}-${name}.log`
   fs.writeFileSync(path.join(output,log),result.stdout+'\n'+result.stderr,{flag:'wx'})
   jobs.push({name,status:result.status,signal:result.signal,log,sha256:hash(fs.readFileSync(path.join(output,log)))})
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
 reports.push({repetition,assertions:read('result.json').assertions.map(({id,result})=>({id,result})),jobs,temporaryRemoved:!fs.existsSync(temp)})
}
const verified=reports.every(report=>report.jobs.every(job=>job.status===0)&&report.temporaryRemoved)
fs.writeFileSync(path.join(output,'integrated-parts.json'),JSON.stringify({schema:'tpnil-native-integrated-partial-review@1',claim:'FAILED_ATTEMPT_CHILD_REPLAY_NOT_NATIVE_QUALIFICATION',run:'42690318194',source:'d02414f58d888e3d11913dedd888a3e5871bf29f',verified,rust:'NOT_EXECUTED_IN_ORIGINAL_ATTEMPT',reports},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({verified,reports:reports.map(({repetition,jobs})=>({repetition,jobs:jobs.map(({name,status})=>({name,status}))}))}));assert.ok(verified)
