import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync,spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const directory=import.meta.dirname,root=path.resolve(directory,'../../../..'),sha=b=>createHash('sha256').update(b).digest('hex')
const {extractZipSafely}=await import(pathToFileURL(path.join(root,'scripts/verify-published-integrations.mjs')).href)
const index=JSON.parse(fs.readFileSync(path.join(directory,'index.json')))
assert.equal(index.schema,'tpnil-descendant-history-engineering@2');assert.equal(index.claim,'ENGINEERING_OBSERVATION_ONLY');assert.equal(index.nativeQualification,false)
assert.deepEqual(fs.readdirSync(directory).filter(n=>n!=='index.json').sort(),index.files.map(x=>x.name).sort())
for(const item of index.files){assert(/^[a-zA-Z0-9_.-]+$/.test(item.name));const b=fs.readFileSync(path.join(directory,item.name));assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256)}
const results=[]
for(const recorded of index.matrices){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-descendant-history-replay-'))
 try{
  const evidence=path.join(temporary,'evidence'),source=path.join(temporary,'source');fs.mkdirSync(evidence);fs.mkdirSync(source)
  extractZipSafely(fs.readFileSync(path.join(directory,recorded.archive)),evidence)
  const matrix=JSON.parse(fs.readFileSync(path.join(evidence,'matrix.json')))
  assert.equal(matrix.sourceCommit,recorded.baseCommit);assert.equal(matrix.sourceDirty,true);assert.equal(matrix.schema,'tpnil-descendant-storage-matrix@2')
  assert.match(matrix.sourceCommit,/^[a-f0-9]{40}$/)
  const archive=execFileSync('git',['archive',matrix.sourceCommit,'--','package.json','scripts','synthesis','infra','fixtures','programs'],{cwd:root,maxBuffer:128*1024*1024})
  const unpacked=spawnSync('tar',['-xf','-','-C',source],{input:archive});assert.equal(unpacked.status,0,String(unpacked.stderr))
  for(const [name,item]of Object.entries(matrix.inputs)){
   assert(/^[a-zA-Z0-9_.@/-]+$/.test(name)&&name.split('/').every(x=>x&&x!=='.'&&x!=='..'))
   const b=fs.readFileSync(path.join(evidence,'source-inputs',name));assert.equal(b.length,item.bytes);assert.equal(sha(b),item.sha256)
   fs.mkdirSync(path.dirname(path.join(source,name)),{recursive:true});fs.writeFileSync(path.join(source,name),b)
  }
  assert.equal(sha(fs.readFileSync(path.join(source,'synthesis/package-lock.json'))),sha(fs.readFileSync(path.join(root,'synthesis/package-lock.json'))),'Install retained dependencies before replay')
  fs.symlinkSync(path.join(root,'synthesis/node_modules'),path.join(source,'synthesis/node_modules'),'dir')
  const replay=spawnSync(process.execPath,[path.join(source,'scripts/verify-descendant-storage-matrix.mjs'),evidence,'--exact-history'],{cwd:source,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
  assert.equal(replay.status,0,`${replay.stderr}\n${replay.stdout}`)
  const result=JSON.parse(replay.stdout.slice(replay.stdout.indexOf('{\n')));assert.equal(result.verified,true);assert.equal(result.assertions,80)
  assert.deepEqual(result.projection,recorded.projection)
  results.push({archive:recorded.archive,verified:true,assertions:result.assertions,identities:result.independentIdentities})
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
}
console.log(JSON.stringify({verified:true,claim:index.claim,nativeQualification:false,matrices:results},null,2))
