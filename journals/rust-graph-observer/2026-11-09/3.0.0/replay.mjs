import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const directory=import.meta.dirname,root=path.resolve(directory,'../../../..'),sha=b=>createHash('sha256').update(b).digest('hex')
const index=JSON.parse(fs.readFileSync(path.join(directory,'index.json')))
assert.equal(index.schema,'tpnil-rust-graph-engineering@3');assert.equal(index.claim,'ENGINEERING_OBSERVATION_ONLY');assert.equal(index.nativeQualification,false);assert.equal(index.sourceDirty,true)
assert.deepEqual(fs.readdirSync(directory).filter(name=>name!=='index.json').sort(),index.files.map(f=>f.name).sort())
for(const item of index.files){assert.match(item.name,/^[a-zA-Z0-9_.-]+$/);const b=fs.readFileSync(path.join(directory,item.name));assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256)}
const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-rust-graph-replay-')))
try{
 const source=path.join(temporary,'source'),evidence=path.join(temporary,'evidence');fs.mkdirSync(source);fs.mkdirSync(evidence)
 const {extractZipSafely}=await import(pathToFileURL(path.join(root,'scripts/verify-published-integrations.mjs')).href)
 extractZipSafely(fs.readFileSync(path.join(directory,'evidence.zip')),evidence)
 assert.match(index.baseCommit,/^[a-f0-9]{40}$/)
 const archived=execFileSync('git',['archive',index.baseCommit,'--','package.json','scripts','components/rust','components/transport/package.json','components/transport/package-lock.json','fixtures/teranode/wab-funding-v1.json'],{cwd:root,maxBuffer:64*1024*1024})
 const unpack=spawnSync('tar',['-xf','-','-C',source],{input:archived});assert.equal(unpack.status,0,String(unpack.stderr))
 for(const [name,binding]of Object.entries(index.sourceInputs)){
  assert(/^[a-zA-Z0-9_.@/-]+$/.test(name)&&name.split('/').every(x=>x&&x!=='.'&&x!=='..'))
  const b=fs.readFileSync(path.join(evidence,'source-inputs',name));assert.equal(b.length,binding.bytes);assert.equal(sha(b),binding.sha256)
  fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),b)
 }
 fs.symlinkSync(path.join(root,'components/transport/node_modules'),path.join(source,'components/transport/node_modules'),'dir')
 const {corpusV3Sources,rustCorpusPolicy}=await import(pathToFileURL(path.join(source,'scripts/rust-corpus.mjs')).href)
 assert.deepEqual(Object.keys(index.sourceInputs).sort(),[...corpusV3Sources].sort())
 assert.deepEqual(rustCorpusPolicy('tpnil-rust-corpus@3').graphOracle,index.graphOracle)
 assert.equal(sha(fs.readFileSync(path.join(source,'components/transport/package-lock.json'))),sha(fs.readFileSync(path.join(root,'components/transport/package-lock.json'))),'Install the retained TypeScript dependency before replay')
 fs.symlinkSync(path.join(root,'components/rust/target'),path.join(source,'components/rust/target'),'dir')
 const results=[]
 for(const run of index.executions){
  const location=path.join(evidence,run.directory),inputs=[1,2,3,4].map(n=>path.join(location,`input-${n}.json`))
  // The verifier binds sourceName to the original filename, so retain exact names.
  const originalNames=['paid-http.json','messaging.json','synthesis-transactions.json','identity-trust.json']
  const named=path.join(temporary,run.directory);fs.mkdirSync(named,{recursive:true})
  const expected=inputs.map((input,i)=>{const target=path.join(named,originalNames[i]);fs.copyFileSync(input,target);return target})
  const args=[path.join(source,'scripts/verify-rust.mjs'),location,...expected,...(run.corpus==='tpnil-rust-corpus@3'?['--corpus-v3']:[])]
  const replay=spawnSync(process.execPath,args,{cwd:source,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024,env:{...process.env,RUSTUP_TOOLCHAIN:'1.88.0'}})
  assert.equal(replay.status,0,`${replay.stderr}\n${replay.stdout}`)
  const result=JSON.parse(replay.stdout);assert.equal(result.verified,true);assert.equal(result.assertions,48)
  const observed=JSON.parse(fs.readFileSync(path.join(location,'result.json')));assert.equal(observed.corpus,run.corpus)
  const counts=observed.assertions.reduce((n,a)=>(n[a.result]=(n[a.result]??0)+1,n),{});assert.deepEqual(counts,run.counts)
  results.push({directory:run.directory,...result,counts})
 }
 const original=JSON.parse(fs.readFileSync(path.join(evidence,'original-rust-repetition-1/calls.json')))
 const control=JSON.parse(fs.readFileSync(path.join(evidence,'corpus2-control/calls.json')))
 assert.deepEqual(control,original,'Default corpus2 must retain every original request and response')
 console.log(JSON.stringify({verified:true,claim:index.claim,nativeQualification:false,originalFailurePreserved:true,executions:results},null,2))
}finally{fs.rmSync(temporary,{recursive:true,force:true})}
