import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export function inventory(directory) {
  const files=[]
  function walk(current) {
    for(const entry of fs.readdirSync(current,{withFileTypes:true})) {
      const target=path.join(current,entry.name)
      if(entry.isSymbolicLink()) throw new Error(`Evidence symlink: ${target}`)
      if(entry.isDirectory()) walk(target)
      else if(entry.isFile()) {
        const name=path.relative(directory,target).split(path.sep).join('/')
        if(['manifest.json','verification.json'].includes(name)) continue
        const bytes=fs.readFileSync(target);files.push({path:name,sha256:digest(bytes),size:bytes.length})
      } else throw new Error(`Unsupported evidence file: ${target}`)
    }
  }
  walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path))
}
export function projection(report) {
  const runs=report.schema==='tpnil-descendant-storage-matrix@2'?report.runs.map(run=>({...run,assertions:run.verification?.assertions})):report.runs??[{assertions:report.assertions}]
  return runs.flatMap((run,index)=>(run.assertions??[]).map(a=>({run:run.name??index,implementation:a.implementation??null,id:a.id.replace(/[a-f0-9]{64}/g,'<txid>'),result:a.result??a.verdict}))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
}
export function verifyIntegrated(directory) {
  const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'))
  const manifest=read('manifest.json'), result=read('result.json'), lock=read('run-lock.json')
  assert.equal(manifest.schema,'tpnil-integrated-manifest@1')
  assert.deepEqual(inventory(directory),manifest.files,'Evidence content or file set differs')
  const exactHistory=result.profile==='ITCVE-1@3.0.0', version=exactHistory?'3.0.0':'1.3.0'
  assert.equal(result.schema,exactHistory?'tpnil-integrated-result@2':'tpnil-integrated-result@1')
  assert.equal(result.profile,`ITCVE-1@${version}`)
  if(exactHistory) assert.equal(result.claim,'INFRASTRUCTURE_QUALIFICATION_ONLY')
  assert.equal(lock.schema,exactHistory?'tpnil-integrated-run-lock@2':'tpnil-integrated-run-lock@1')
  const profilePath=`itcves/ITCVE-1/${version}/profile.json`
  const frozen=JSON.parse(fs.readFileSync(new URL('../'+profilePath,import.meta.url),'utf8'))
  assert.deepEqual(lock.profile,frozen,'The declared lane set differs from the frozen profile')
  const inputs=[profilePath,...frozen.componentProfiles,...frozen.dependencies]
  assert.deepEqual(Object.keys(lock.files).sort(),[...inputs].sort())
  for(const file of inputs) assert.equal(lock.files[file],digest(fs.readFileSync(new URL('../'+file,import.meta.url))),`Frozen input differs: ${file}`)
  assert.ok(!result.executionError)
  assert.equal(lock.profile.id,'ITCVE-1');assert.equal(lock.profile.version,version)
  assert.match(lock.source,/^[0-9a-f]{40}$/)
  assert.equal(lock.dirty,false,'Scored integration requires committed source')
  const expected=lock.profile.lanes
  assert.deepEqual(result.lanes.map(x=>x.id).sort(),[...expected].sort())
  for(const lane of result.lanes) {
    assert.equal(lane.runs.length,['storage-sync','descendant-storage-sync'].includes(lane.id)?1:2)
    const projections=[]
    for(const run of lane.runs) {
      assert.equal(run.timedOut,false)
      assert.equal(run.exitCode,0,`${lane.id} did not complete`)
      assert.ok(!path.isAbsolute(run.result)&&!run.result.split('/').includes('..'))
      const report=read(run.result)
      assert.ok(!report.executionError,`${lane.id} execution error`)
      const observed=projection(report)
      assert.ok(observed.length>0,`${lane.id} has no assertions`)
      assert.ok(observed.every(x=>['PASS','FAIL','BLOCKED'].includes(x.result)))
      assert.deepEqual(observed,run.assertions)
      if(exactHistory&&['storage-sync','descendant-storage-sync'].includes(lane.id)) verifyExactHistoryMatrix(lane.id,report,run.result,read,frozen,lock.files,name=>fs.readFileSync(path.join(directory,name)))
      if(lane.id==='descendant-storage-sync') {
        assert.equal(report.runs.length,8);assert.equal(observed.length,80)
        assert.equal(report.sourceCommit,lock.source);assert.equal(report.sourceDirty,false)
      } else if(lane.id==='storage-sync') {
        if(exactHistory) assert.equal(report.sourceRevision,lock.source)
        assert.equal(report.runs.length,8);assert.equal(report.repeatability.length,4)
        assert.ok(report.repeatability.every(x=>x.matches));assert.ok(report.runs.every(x=>x.cleanup===true))
      } else {
        const cleanup=report.cleanup
        assert.ok(cleanup,`${lane.id} lacks cleanup evidence`)
        if(Array.isArray(cleanup)) assert.ok(cleanup.length>0&&cleanup.every(x=>!x.error&&!x.walletError&&x.running!==true&&x.closed!==false&&(x.exitCode===undefined||x.exitCode===0)&&x.signal==null),`${lane.id} cleanup failed`)
        else assert.ok(Object.values(cleanup).length>0&&Object.values(cleanup).every(x=>x===true),`${lane.id} cleanup failed`)
      }
      projections.push(observed)
    }
    if(projections.length===2) assert.deepEqual(projections[0],projections[1],`${lane.id} repetitions differ`)
  }
  if(exactHistory) {
    assert.equal(result.lanes.length,frozen.denominator.lanes)
    assert.equal(result.lanes.reduce((total,lane)=>total+lane.runs.reduce((sum,run)=>sum+run.assertions.length,0),0),frozen.denominator.assertions,'Exact-history assertion denominator differs')
    assert.equal(result.lanes.reduce((total,lane)=>total+(['storage-sync','descendant-storage-sync'].includes(lane.id)?read(lane.runs[0].result).runs.length:lane.runs.length),0),frozen.denominator.isolatedExecutions,'Exact-history execution denominator differs')
  }
  return {schema:exactHistory?'tpnil-integrated-verification@2':'tpnil-integrated-verification@1',verified:true,source:lock.source,profile:`ITCVE-1@${version}`,lanes:result.lanes.length,findings:result.lanes.flatMap(l=>l.runs.flatMap(r=>r.assertions.filter(a=>a.result!=='PASS').map(a=>({lane:l.id,resultFile:r.result,...a}))))}
}

function verifyExactHistoryMatrix(id,report,resultPath,read,profile,files,bytes) {
  const policy=profile.matrixPolicy[id], directory=path.posix.dirname(resultPath)
  assert.equal(report.schema,policy.matrixSchema,'Matrix schema does not select exact history')
  assert.equal(report.runs.length,policy.cells)
  const storage=profile.matrixPolicy['storage-sync']
  const storageBinding={profile:storage.profile,projectionPolicy:storage.projectionPolicy,projectionManifestSha256:files[storage.manifest]}
  const binding=id==='storage-sync'?storageBinding:{profile:policy.profile,projectionPolicy:policy.projectionPolicy,projectionManifestSha256:files[policy.manifest],storageProjection:storageBinding}
  if(id==='storage-sync') for(const [key,value] of Object.entries(binding)) assert.equal(report[key],value,`Storage matrix ${key} mismatch`)
  else assert.deepEqual(report.projection,binding,'Descendant matrix projection mismatch')
  const checkRuntime=cell=>{
    const runtime=cell.projectionRuntime
    assert.deepEqual(Object.keys(runtime).sort(),['declaredTimezone','resolvedTimezone','offsetMinutes','observedAt'].sort())
    assert.equal(runtime.declaredTimezone,'UTC');assert.equal(runtime.resolvedTimezone,'UTC');assert.equal(runtime.offsetMinutes,0)
    assert.ok(Number.isFinite(Date.parse(runtime.observedAt))&&Date.parse(runtime.observedAt)<=Date.parse(cell.startedAt),'Exact-history cell lacks its pre-start UTC observation')
  }
  if(id==='descendant-storage-sync') checkRuntime(report)
  const seen=new Set()
  for(const row of report.runs) {
    assert.equal(typeof row.name,'string');assert.ok(!path.isAbsolute(row.name)&&row.name.split('/').every(part=>part&&part!=='.'&&part!=='..'));assert.ok(!seen.has(row.name));seen.add(row.name)
    const file=id==='storage-sync'?`${row.name}/result.json`:row.report.file
    if(id!=='storage-sync') assert.equal(file,`${row.name}/observations.json`)
    const cell=read(`${directory}/${file}`)
    checkRuntime(cell)
    assert.equal(cell.schema,policy.runSchema,'Old cell cannot be relabelled as exact-history matrix')
    if(id==='storage-sync') {
      for(const [key,value] of Object.entries(binding)) assert.equal(cell[key],value,`Storage cell ${key} mismatch`)
      assert.deepEqual(cell.assertions,row.assertions);assert.equal(cell.cleanup,true)
    } else {
      assert.deepEqual(cell.projection,binding,'Descendant cell projection mismatch')
      assert.equal(row.status,0);assert.equal(row.signal,null);assert.equal(row.verification.verified,true)
      const raw=bytes(`${directory}/${file}`);assert.equal(raw.length,row.report.bytes);assert.equal(digest(raw),row.report.sha256)
      assert.deepEqual(cell.assertions.map(({id,result})=>({id,result})),row.verification.assertions)
      assert.equal(cell.cleanup.sourceRestored,true);assert.deepEqual(cell.cleanup.errors,[])
    }
  }
}
