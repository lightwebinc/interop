import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const repository=path.resolve(import.meta.dirname,'..')
export const permissionClickReplayInputs=[
 'synthesis/package.json','synthesis/package-lock.json','synthesis/src/determinism.ts',
 'synthesis/src/wallet-lab/native/conformance-permissions-model.ts','synthesis/src/wallet-lab/native/verify-conformance-permissions.ts',
 'synthesis/src/wallet-lab/native/conformance-permission-lifecycle-model.ts','synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts',
 'synthesis/src/wallet-lab/native/permission-click.ts','fixtures/teranode/wab-funding-v1.json'
]
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
function files(directory){assert(fs.lstatSync(directory).isDirectory()&&!fs.lstatSync(directory).isSymbolicLink());return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{assert(!entry.isSymbolicLink());if(entry.isDirectory())return files(path.join(directory,entry.name)).map(n=>`${entry.name}/${n}`);assert(entry.isFile());return entry.name}).sort()}
function safe(name){assert(/^[A-Za-z0-9_.@/-]+$/.test(name)&&name.split('/').every(part=>part&&part!=='.'&&part!=='..'));return name}
export function verifyPermissionClickArchive(directory,{root=repository,semantic=false}={}){
 const manifest=read(path.join(directory,'manifest.json'));assert.equal(manifest.schema,'tpnil-native-permission-click-engineering-archive@2');assert.equal(manifest.claim,'NATIVE_MACOS_ENGINEERING_PREFLIGHT_ONLY');assert.equal(manifest.profile,'ITCVE-1@2.0.0');assert.equal(manifest.program,'ISI-4@4.0.0');assert.deepEqual(manifest.replayInputs,permissionClickReplayInputs)
 assert.deepEqual(manifest.files.map(r=>r.path).sort(),files(directory).filter(name=>!['README.md','manifest.json'].includes(name)))
 for(const row of manifest.files){const b=fs.readFileSync(path.join(directory,safe(row.path)));assert.equal(b.length,row.size);assert.equal(hash(b),row.sha256)}
 for(const name of permissionClickReplayInputs)assert(manifest.files.some(r=>r.path===`replay-source/${name}`),`Missing mandatory replay input ${name}`)
 assert.equal(manifest.repetitions.length,2);assert.deepEqual(manifest.repetitions.map(r=>r.directory),['repetition-1','repetition-2']);assert.equal(new Set(manifest.repetitions.map(r=>r.identity)).size,2)
 assert.deepEqual(manifest.assertions,{originalPerRepetition:8,lifecyclePerRepetition:16,total:48,PASS:48})
 for(const row of manifest.repetitions){
  const base=path.join(directory,row.directory),result=read(path.join(base,'result.json')),original=read(path.join(base,'evidence/conformance/permissions.json')),lifecycle=read(path.join(base,'evidence/conformance/permission-lifecycle.json'))
  assert.equal(result.identity,row.identity);assert.equal(lifecycle.identity,row.identity);assert.equal(result.platform,'darwin');assert.equal(result.architecture,'arm64');assert.equal(result.implementation,'go');assert.deepEqual(result.cleanup,{browser:true,services:true,profile:true});assert.deepEqual(result.originalPermissions,original);assert.deepEqual(result.lifecycle,lifecycle);assert.equal(original.result,'PASS');assert.equal(lifecycle.result,'PASS');assert.equal(original.schema,'tpnil-native-permission-conformance@2');assert.equal(lifecycle.schema,'tpnil-native-permission-lifecycle@2.0.0')
  for(const name of ['conformance-permissions-model.ts','verify-conformance-permissions.ts','conformance-permission-lifecycle-model.ts','verify-conformance-permission-lifecycle.ts','permission-click.ts'])assert.equal(hash(fs.readFileSync(path.join(base,'source',name))),hash(fs.readFileSync(path.join(directory,'replay-source/synthesis/src/wallet-lab/native',name))))
 }
 const close=read(path.join(directory,'popup-close-attempt-2/result.json'));assert.equal(close.claim,'LAB_SELF_TEST_ONLY');assert.equal(close.result,'PASS');assert.equal(close.runs.length,20);assert.equal(close.cleanup.browser,true);assert(close.runs.every(row=>row.popupClosed===true));assert.equal(close.runs.filter(row=>row.click.automation.status==='rejected').length,manifest.popupCloseSelfTest.observedTransportErrors)
 const failed=read(path.join(directory,'popup-close-attempt-1/result.json'));assert.equal(failed.result,'FAIL');assert.match(failed.error,/__name is not defined/);assert.equal(failed.cleanup.browser,true)
 if(semantic){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-permission-click-replay-'))
  try{
   for(const name of permissionClickReplayInputs){const target=path.join(temp,safe(name));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(directory,'replay-source',name),target)}
   assert.equal(hash(fs.readFileSync(path.join(root,'synthesis/package-lock.json'))),hash(fs.readFileSync(path.join(temp,'synthesis/package-lock.json'))),'Install the frozen synthesis dependencies before replay');fs.symlinkSync(path.join(root,'synthesis/node_modules'),path.join(temp,'synthesis/node_modules'),'dir')
   const script=`import fs from 'node:fs';import assert from 'node:assert/strict';import {verifyNativePermissionConformance} from './synthesis/src/wallet-lab/native/verify-conformance-permissions.ts';import {verifyNativePermissionLifecycle} from './synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts';import {verifyPermissionClick} from './synthesis/src/wallet-lab/native/permission-click.ts';const base=process.argv[2];for(const rep of[1,2]){const read=n=>fs.readFileSync(base+'/repetition-'+rep+'/evidence/'+n);const life=JSON.parse(read('conformance/permission-lifecycle.json'));const old=JSON.parse(read('conformance/permissions.json'));assert.equal(verifyNativePermissionConformance(old,read,life.identity).result,'PASS');assert.equal((await verifyNativePermissionLifecycle(life,read,life.identity)).result,'PASS')}const close=JSON.parse(fs.readFileSync(base+'/popup-close-attempt-2/result.json'));for(const row of close.runs)verifyPermissionClick(row.click,row.observed,{requestNonce:row.outcome.requestNonce,startedAt:row.startedAt,endedAt:row.endedAt,outcome:row.outcome});console.log('PASS48nativeMacOSengineeringPredicates20popupClosureSelfTests');`
   const runner=path.join(temp,'replay.mjs');fs.writeFileSync(runner,script)
   const replay=spawnSync(process.execPath,['--import',path.join(root,'synthesis/node_modules/tsx/dist/loader.mjs'),runner,path.resolve(directory)],{cwd:temp,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});assert.equal(replay.status,0,`${replay.stderr}\n${replay.stdout}`)
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
 }
 return{result:'PASS',files:manifest.files.length,repetitions:2,nativeMacOSEngineeringAssertions:48,popupClosureSelfTests:20,semantic,nativeLinuxQualification:false}
}
if(process.argv[1]===import.meta.filename){assert(process.argv.slice(2).every(value=>value==='--semantic'));console.log(JSON.stringify(verifyPermissionClickArchive(path.join(repository,'journals/native-permission-click/2026-11-09/oracle-2.0.0'),{semantic:process.argv.includes('--semantic')}),null,2))}
