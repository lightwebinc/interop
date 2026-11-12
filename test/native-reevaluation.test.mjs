import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {execFileSync} from 'node:child_process'
import { validateReevaluationPlan, validateReevaluationLock, validateOriginalEvidence, evaluatorSourceNames, reevaluationInputNames, sha256 } from '../scripts/native-reevaluation.mjs'
import { extractZipSafely, verifyIntegrationArchive } from '../scripts/verify-published-integrations.mjs'
const temporary=fn=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-reevaluation-test-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
const original={archive:'journals/integrated-native-attempts/2026-11-09/42711700295/native-integrated.zip',source:'c338a93c97ffebeeef318e679ff82b7dbf309dd5',workflowRun:42711700295,sha256:'c0645821afeea30cbc1c0c70f4ca10bfbe288ebfa570b719af5a709f145c3826',size:4255642,members:186,profile:'ITCVE-1@2.0.0',program:'ISI-4@4.0.0',planSha256:'eb08ea9808a3cd314d9060c16c466f47cbb36c64ebd3506064085276596432c6',qualificationSha256:'8a98103995b918aec867f414c36bc8ff71645ce1004e1ced3f4706257ea82ad7'}
const planFor=root=>{const write=(name,bytes)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),bytes)};for(const file of evaluatorSourceNames)write(file,'frozen fixture '+file);const manifest='components/rust/graph-oracle-3.0.0.json';write(manifest,'{"oracle":"fixture"}\n');return {schema:'tpnil-native-integrated-reevaluation-plan@1',id:'fixture',original:structuredClone(original),rust:{corpus:'tpnil-rust-corpus@3',manifest,manifestSha256:sha256(fs.readFileSync(path.join(root,manifest))),inputNames:[...reevaluationInputNames]},expected:{repetitions:2,nativeAssertions:280,integratedAssertions:77,rustAssertions:48},evaluatorSources:Object.fromEntries(evaluatorSourceNames.map(file=>[file,sha256(fs.readFileSync(path.join(root,file)))]))}}
test('reevaluation plan binds major3, exact unchanged four-input order and every evaluator/extractor source',()=>temporary(root=>{
 const plan=planFor(root);validateReevaluationPlan(plan,root)
 for(const mutate of [p=>p.rust.corpus='tpnil-rust-corpus@2',p=>p.rust.inputNames.reverse(),p=>p.rust.inputNames.push('supplemental.json'),p=>p.expected.repetitions=1,p=>delete p.evaluatorSources['scripts/verify-published-integrations.mjs'],p=>p.original.profile='ITCVE-1@3.0.0',p=>p.rust.manifestSha256='00'.repeat(32)]){const copy=structuredClone(plan);mutate(copy);assert.throws(()=>validateReevaluationPlan(copy,root))}
 fs.appendFileSync(path.join(root,evaluatorSourceNames[0]),' changed');assert.throws(()=>validateReevaluationPlan(plan,root),/Evaluator input differs/)
}))
test('original native9 evidence remains exact, with valid base FAIL and retained Rust failure; mutation/supplement rejected',()=>temporary(root=>{
 const zip=fs.readFileSync(new URL('../'+original.archive,import.meta.url)),directory=path.join(root,'original');fs.mkdirSync(directory);extractZipSafely(zip,directory)
 const plan={original};const observed=validateOriginalEvidence(plan,zip,directory);assert.equal(observed.base.outcome,'FAIL');assert.equal(observed.base.qualifiedEnvironment,true)
 for(const mutate of [p=>p.original.sha256='00'.repeat(32),p=>p.original.source='11'.repeat(20),p=>p.original.members=185,p=>p.original.planSha256='22'.repeat(32),p=>p.original.qualificationSha256='33'.repeat(32)]){const copy=structuredClone(plan);mutate(copy);assert.throws(()=>validateOriginalEvidence(copy,zip,directory))}
 const file=path.join(directory,'repetition-1/evidence/integrated/paid-http.json'),bytes=fs.readFileSync(file);fs.appendFileSync(file,' ');assert.throws(()=>validateOriginalEvidence(plan,zip,directory),/changed or were supplemented/);fs.writeFileSync(file,bytes)
 fs.unlinkSync(file);assert.throws(()=>validateOriginalEvidence(plan,zip,directory),/changed or were supplemented/);fs.writeFileSync(file,bytes)
 fs.writeFileSync(path.join(directory,'supplemental-ancestor.json'),'{}');assert.throws(()=>validateOriginalEvidence(plan,zip,directory),/changed or were supplemented/)
}))
function writeArchive(directory,mutate=()=>{}) {
 const source='ab'.repeat(20),row=index=>({index,native:{assertions:280},assertions:Array.from({length:77},(_,i)=>({id:String(i),result:'PASS'})),rust:{corpus:'tpnil-rust-corpus@3',assertions:48,outcome:'PASS',counts:{PASS:48,FAIL:0,BLOCKED:0},inputs:reevaluationInputNames.map(name=>({name}))}})
 const result={schema:'tpnil-native-integrated-reevaluation@1',claim:'RETAINED_NATIVE_EVIDENCE_REEVALUATION',evaluatorSource:source,qualifiedRetainedEvidence:true,newNativeSessions:0,originalMembersUnchanged:true,completeBRC100Conformance:false,original:{...original},rustOutcome:'PASS',repetitions:[row(1),row(2)]};mutate(result)
 fs.writeFileSync(path.join(directory,'reevaluation.json'),JSON.stringify(result));fs.writeFileSync(path.join(directory,'native-reevaluation.zip'),'fixture')
 fs.writeFileSync(path.join(directory,'provenance.json'),JSON.stringify({schema:'tpnil-native-integrated-reevaluation-archive@1',source,files:['reevaluation.json','native-reevaluation.zip'].map(name=>{const b=fs.readFileSync(path.join(directory,name));return {path:name,size:b.length,sha256:sha256(b)}})}))
}
test('publication distinguishes retained reevaluation and rejects partial repetitions or corpus relabels even with rebound inventory',()=>temporary(root=>{
 writeArchive(root);assert.equal(verifyIntegrationArchive(root).kind,'reevaluation')
 for(const mutate of [r=>r.claim='EXPERIMENTAL_CONFORMANCE_RESULT',r=>r.newNativeSessions=1,r=>r.completeBRC100Conformance=true,r=>r.repetitions.pop(),r=>r.repetitions[1].index=1,r=>r.repetitions[0].rust.corpus='tpnil-rust-corpus@2',r=>r.repetitions[0].rust.counts={PASS:42,FAIL:6,BLOCKED:0}]){writeArchive(root,mutate);assert.throws(()=>verifyIntegrationArchive(root))}
}))

test('committed plan/run lock resists rehashed original identity and evaluator-source substitutions',()=>temporary(root=>{
 const plan=planFor(root),planPath='plan.json',bytes=Buffer.from(JSON.stringify(plan,null,2)+'\n');fs.writeFileSync(path.join(root,planPath),bytes)
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});git('init','-q');git('add','.');git('-c','user.name=TPNIL fixture','-c','user.email=fixture@example.invalid','commit','-qm','Reevaluation fixture')
 const evaluatorSource=git('rev-parse','HEAD').trim(),lock={schema:'tpnil-native-integrated-reevaluation-run-lock@1',planPath,plan,planSha256:sha256(bytes),evaluatorSource,sourceDirty:false};validateReevaluationLock(lock,root)
 for(const mutate of [l=>l.sourceDirty=true,l=>l.planPath='../plan.json',l=>{l.plan.original.workflowRun++;l.planSha256=sha256(Buffer.from(JSON.stringify(l.plan,null,2)+'\n'))},l=>l.evaluatorSource='00'.repeat(20)]){const changed=structuredClone(lock);mutate(changed);assert.throws(()=>validateReevaluationLock(changed,root))}
 fs.appendFileSync(path.join(root,evaluatorSourceNames[0]),' changed');const changed=structuredClone(lock);changed.plan.evaluatorSources[evaluatorSourceNames[0]]=sha256(fs.readFileSync(path.join(root,evaluatorSourceNames[0])));changed.planSha256=sha256(Buffer.from(JSON.stringify(changed.plan,null,2)+'\n'));assert.throws(()=>validateReevaluationLock(changed,root),/committed evaluator source/)
}))
