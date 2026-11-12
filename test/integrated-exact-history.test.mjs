import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { digest, inventory, projection, verifyIntegrated } from '../scripts/integrated-evidence.mjs'
const root=path.resolve(import.meta.dirname,'..'), profilePath='itcves/ITCVE-1/3.0.0/profile.json'
const profile=JSON.parse(fs.readFileSync(path.join(root,profilePath))), source='1'.repeat(40)
function fixture() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-exact-history-'))
  const write=(name,value)=>{const file=path.join(directory,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value))}
  const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name)))
  const inputs=[profilePath,...profile.componentProfiles,...profile.dependencies],files=Object.fromEntries(inputs.map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]))
  const storage=profile.matrixPolicy['storage-sync'], descendant=profile.matrixPolicy['descendant-storage-sync']
  const binding={profile:storage.profile,projectionPolicy:storage.projectionPolicy,projectionManifestSha256:files[storage.manifest]}
  const descBinding={profile:descendant.profile,projectionPolicy:descendant.projectionPolicy,projectionManifestSha256:files[descendant.manifest],storageProjection:binding}
  const runtime={declaredTimezone:'UTC',resolvedTimezone:'UTC',offsetMinutes:0,observedAt:'2026-11-09T00:00:00.000Z'}
  const storageRuns=[],descendantRuns=[]
  for(let i=0;i<8;i++) {
    const name=`cell-${i}`, assertions=Array.from({length:11},(_,n)=>({id:`fixture-${n}`,result:'PASS'})), child={schema:storage.runSchema,...binding,projectionRuntime:runtime,startedAt:runtime.observedAt,assertions,cleanup:true}
    write(`storage-sync/${name}/result.json`,child);storageRuns.push({name,assertions,cleanup:true})
    const da=Array.from({length:10},(_,n)=>({id:`predicate-${n}`,result:'PASS'})),file=`${name}/observations.json`
    const dc={schema:descendant.runSchema,projection:descBinding,projectionRuntime:runtime,startedAt:runtime.observedAt,assertions:da.map(row=>({...row,detail:'Retained raw observation'})),cleanup:{sourceRestored:true,errors:[]}}
    write(`descendant-storage-sync/${file}`,dc);const bytes=fs.readFileSync(path.join(directory,'descendant-storage-sync',file))
    descendantRuns.push({name,status:0,signal:null,report:{file,bytes:bytes.length,sha256:digest(bytes)},verification:{verified:true,assertions:da}})
  }
  write('storage-sync/result.json',{schema:storage.matrixSchema,...binding,sourceRevision:source,runs:storageRuns,repeatability:Array.from({length:4},()=>({matches:true}))})
  write('descendant-storage-sync/matrix.json',{schema:descendant.matrixSchema,projection:descBinding,projectionRuntime:runtime,startedAt:runtime.observedAt,sourceCommit:source,sourceDirty:false,runs:descendantRuns})
  const lanes=profile.lanes.map(id=>({id,runs:Array.from({length:['storage-sync','descendant-storage-sync'].includes(id)?1:2},(_,i)=>{
    const result=id==='storage-sync'?'storage-sync/result.json':id==='descendant-storage-sync'?'descendant-storage-sync/matrix.json':`${id}-${i}/result.json`
    if(!['storage-sync','descendant-storage-sync'].includes(id))write(result,{assertions:Array.from({length:{'overlay-identity':14,messaging:41,'transport-typescript':17,'transport-go':17,'boundary-typescript':43,'boundary-go':43,rust:36}[id]},(_,n)=>({id:`fixture-${n}`,result:'PASS'})),cleanup:{closed:true}})
    return {result,exitCode:0,timedOut:false,assertions:projection(read(result))}
  })}))
  write('run-lock.json',{schema:'tpnil-integrated-run-lock@2',source,dirty:false,profile,files})
  write('result.json',{schema:'tpnil-integrated-result@2',claim:'INFRASTRUCTURE_QUALIFICATION_ONLY',profile:'ITCVE-1@3.0.0',lanes})
  const edit=(name,fn)=>{const r=read(name);fn(r);write(name,r)}
  const rebind=()=>write('manifest.json',{schema:'tpnil-integrated-manifest@1',files:inventory(directory)})
  const editCell=(id,fn)=>{
    const file=id==='storage-sync'?'cell-0/result.json':'cell-0/observations.json';edit(`${id}/${file}`,fn)
    if(id==='descendant-storage-sync')edit(`${id}/matrix.json`,r=>{const b=fs.readFileSync(path.join(directory,id,file));r.runs[0].report.sha256=digest(b);r.runs[0].report.bytes=b.length})
  }
  rebind();return {directory,edit,editCell,rebind,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})}
}
test('component3 rejects old schemas, relabelled policies and non-UTC cells despite rebound inventories',()=>{
 const mutations=[
  f=>f.edit('result.json',r=>r.schema='tpnil-integrated-result@1'),
  f=>f.edit('run-lock.json',r=>r.schema='tpnil-integrated-run-lock@1'),
  f=>f.edit('storage-sync/result.json',r=>r.schema='tpnil-storage-sync-matrix@1.0.0'),
  f=>f.edit('storage-sync/result.json',r=>r.projectionPolicy='looser-policy'),
  f=>f.editCell('storage-sync',r=>r.schema='tpnil-storage-sync-run@1.0.0'),
  f=>f.editCell('storage-sync',r=>r.projectionManifestSha256='0'.repeat(64)),
  f=>f.edit('descendant-storage-sync/matrix.json',r=>r.projectionRuntime.declaredTimezone='Europe/London'),
  f=>f.edit('descendant-storage-sync/matrix.json',r=>r.schema='tpnil-descendant-storage-matrix@1'),
  f=>f.edit('descendant-storage-sync/matrix.json',r=>r.projection.storageProjection.projectionManifestSha256='0'.repeat(64)),
  f=>f.editCell('descendant-storage-sync',r=>r.schema='tpnil-descendant-storage-sync@1'),
  f=>f.editCell('descendant-storage-sync',r=>r.projection.projectionPolicy='looser-policy'),
  f=>f.editCell('descendant-storage-sync',r=>r.cleanup.sourceRestored=false),
  f=>f.editCell('descendant-storage-sync',r=>r.projectionRuntime.offsetMinutes=480),
  f=>f.editCell('storage-sync',r=>r.projectionRuntime.resolvedTimezone='America/Los_Angeles'),
  f=>f.editCell('storage-sync',r=>r.projectionRuntime.observedAt='2026-11-09T00:00:01.000Z'),
  f=>f.edit('result.json',r=>r.lanes.splice(1,1)),
  f=>{for(const i of [0,1])f.edit(`rust-${i}/result.json`,r=>r.assertions.pop());f.edit('result.json',r=>{for(const run of r.lanes.find(l=>l.id==='rust').runs)run.assertions=run.assertions.filter(a=>a.id!=='fixture-35')})}
 ]
 for(const [index,mutate] of mutations.entries()){const f=fixture();try{assert.equal(verifyIntegrated(f.directory).verified,true);mutate(f);f.rebind();assert.throws(()=>verifyIntegrated(f.directory),`mutation${index}`)}finally{f.cleanup()}}
})
test('component3 explicitly freezes the ninth matrix and never replaces native2',()=>{
 assert.deepEqual(profile.denominator,{lanes:9,isolatedExecutions:30,assertions:590,descendantExecutions:8,descendantAssertions:80,priorComponent13Executions:22,priorComponent13Assertions:510})
 assert.equal(profile.componentOnly,true);assert.equal(profile.nativeProfile,undefined)
 const native=JSON.parse(fs.readFileSync(path.join(root,'infra/native/conformance/plan-coverage-closure.json')))
 assert.equal(native.itcve,'ITCVE-1@2.0.0');assert.equal(native.program,'ISI-4@4.0.0');assert.equal(Object.keys(native.conformanceInputs).length,10)
 for(const [file,sha]of Object.entries(native.conformanceInputs))assert.equal(digest(fs.readFileSync(path.join(root,file))),sha)
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'itcves/ITCVE-1/1.3.0/profile.json'))).lanes.length,8)
})
