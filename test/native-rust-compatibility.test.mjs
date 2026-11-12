import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {nativeRustBinding,selectNativeRustCorpus,nativeRustV3Variant,nativeRustV3Flag,nativeRustCompatibilityPath,nativeRustCompatibilitySources} from '../scripts/native-rust-compatibility.mjs'
const root=path.resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex'),read=name=>fs.readFileSync(path.join(root,name))
const planPath='infra/native/conformance/plan-coverage-closure.json',plan=JSON.parse(read(planPath)),planSha256=sha(read(planPath)),source='ab'.repeat(20)
const graphPath='components/rust/graph-oracle-3.0.0.json',graphManifest=JSON.parse(read(graphPath))
const graphOracle={id:graphManifest.schema,manifest:graphPath,manifestSha256:sha(read(graphPath)),operation:graphManifest.operation,cargoFeature:graphManifest.cargoFeature}
const options={read,readCommitted:(revision,file)=>{assert.equal(revision,source);return read(file)},graphPolicy:()=>({corpus:'tpnil-rust-corpus@3',graphOracle})}
async function lock(){return {source,plan,planSha256,executionVariant:nativeRustV3Variant,rustCompatibility:await nativeRustBinding(plan,planSha256,source,options)}}

test('native callers without explicit binding retain corpus2 without loading optional dependencies',async()=>{
  const forbidden=()=>{throw Error('Default caller touched optional Rust3 source')}
  assert.deepEqual(await selectNativeRustCorpus({plan,source},{read:forbidden,readCommitted:forbidden,graphPolicy:forbidden}),{corpus:'tpnil-rust-corpus@2',cliFlags:[]})
  assert.equal(nativeRustV3Flag,'--conformance-closure-rust-v3')
})
test('future native Rust3 requires exact paired variant and digest-addressed binding',async()=>{
  const original=await lock(),observed=await selectNativeRustCorpus(original,options)
  assert.equal(observed.corpus,'tpnil-rust-corpus@3');assert.deepEqual(observed.cliFlags,['--corpus-v3']);assert.deepEqual(observed.binding,original.rustCompatibility)
  for(const mutate of [l=>delete l.rustCompatibility,l=>delete l.executionVariant,l=>l.executionVariant='integrated-native-conformance-closure',l=>l.rustCompatibility.corpus='tpnil-rust-corpus@2',l=>l.rustCompatibility.manifestSha256='00'.repeat(32),l=>l.rustCompatibility.graphOracle.manifestSha256='11'.repeat(32),l=>l.planSha256='22'.repeat(32)]){
    const changed=structuredClone(original);mutate(changed);await assert.rejects(selectNativeRustCorpus(changed,options))
  }
})
test('compatibility metadata is bound to its original Git source, preventing c338 retrofits',async()=>{
  const original=await lock();original.source='c338a93c97ffebeeef318e679ff82b7dbf309dd5'
  await assert.rejects(selectNativeRustCorpus(original,{graphPolicy:options.graphPolicy}),/Command failed|did not exist/)
})
test('every selector/runner/verifier/workflow input must exist unchanged at execution source',async()=>{
  const original=await lock()
  for(const changed of [nativeRustCompatibilityPath,planPath,graphPath,...nativeRustCompatibilitySources,...Object.keys(graphManifest.sources)]) {
    await assert.rejects(selectNativeRustCorpus(original,{...options,readCommitted:(revision,file)=>file===changed?Buffer.concat([read(file),Buffer.from(' changed')]):options.readCommitted(revision,file)}))
  }
})
test('compatibility source inventory and Rust/native policy substitutions fail closed',async()=>{
  const original=await lock()
  for(const mutate of [m=>delete m.sources['scripts/run-native-go-wallet.mjs'],m=>m.nativePlan.profile='ITCVE-1@1.5.0',m=>m.rustCorpus='tpnil-rust-corpus@2',m=>m.graphOracle.operation='spends']){
    const manifest=JSON.parse(read(nativeRustCompatibilityPath));mutate(manifest);const bytes=Buffer.from(JSON.stringify(manifest));
    const changedRead=file=>file===nativeRustCompatibilityPath?bytes:read(file)
    await assert.rejects(selectNativeRustCorpus(original,{...options,read:changedRead,readCommitted:(_revision,file)=>changedRead(file)}))
  }
})
test('future Rust selection leaves the original native2 plan and all ten acceptance inputs byte-identical',()=>{
  const frozen='c338a93c97ffebeeef318e679ff82b7dbf309dd5'
  assert.equal(Object.keys(plan.conformanceInputs).length,10)
  for(const name of [planPath,...Object.keys(plan.conformanceInputs)])assert.deepEqual(read(name),execFileSync('git',['show',`${frozen}:${name}`],{cwd:root}))
})
