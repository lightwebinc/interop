import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { prepareFrozenComponentReplay } from '../scripts/frozen-component-replay.mjs'
test('component3 frozen replay survives current source drift but rejects dependency drift and Git links',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-frozen-replay-test-')),root=path.join(temporary,'repository')
 fs.mkdirSync(root);const write=(name,value)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value)}
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'})
 try{
  for(const directory of ['infra','fixtures','itcves','programs'])write(`${directory}/.keep`,'fixture')
  write('.nvmrc',process.versions.node+'\n');write('scripts/oracle.mjs','export const marker="frozen"\n');write('package.json','{}')
  for(const dir of ['synthesis','integrations/services','components/transport']){write(`${dir}/package-lock.json`,'{"lockfileVersion":3}');fs.mkdirSync(path.join(root,dir,'node_modules'))}
  write('components/rust/Cargo.lock','# pinned\n');fs.mkdirSync(path.join(root,'out'));fs.mkdirSync(path.join(root,'components/rust/target'))
  git('init','-q');git('add','.');git('-c','user.name=TPNIL fixture','-c','user.email=fixture@example.invalid','commit','-qm','Frozen fixture')
  const revision=git('rev-parse','HEAD').trim();write('scripts/oracle.mjs','throw new Error("current drift")\n')
  const copy=path.join(temporary,'frozen');const result=prepareFrozenComponentReplay(root,revision,copy)
  assert.equal(fs.readFileSync(path.join(copy,'scripts/oracle.mjs'),'utf8'),'export const marker="frozen"\n');assert.equal(result.source,revision);assert.ok(result.reused.includes('synthesis/node_modules'))
  fs.rmSync(copy,{recursive:true});assert.ok(fs.existsSync(path.join(root,'out')),'Removing replay cannot remove original cache')
  write('synthesis/package-lock.json','{"lockfileVersion":2}');assert.throws(()=>prepareFrozenComponentReplay(root,revision,path.join(temporary,'bad-lock')),/frozen dependencies/)
  write('synthesis/package-lock.json','{"lockfileVersion":3}');fs.symlinkSync('/outside',path.join(root,'scripts/link'));git('add','scripts/link');git('-c','user.name=TPNIL fixture','-c','user.email=fixture@example.invalid','commit','-qm','Unsupported link')
  assert.throws(()=>prepareFrozenComponentReplay(root,git('rev-parse','HEAD').trim(),path.join(temporary,'bad-link')),/Git symlinks/)
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
