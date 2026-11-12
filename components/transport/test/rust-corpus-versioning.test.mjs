import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import os from 'node:os'
import { verifyRust } from '../../../scripts/verify-rust.mjs'
import { corpusSources, corpusV3Sources, corpusV3ManifestInputs, evaluateRustCorpus, rustCorpusPolicy, validateRustGraphManifest } from '../../../scripts/rust-corpus.mjs'
const root=path.resolve(import.meta.dirname,'../../..'), sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const read=file=>fs.readFileSync(path.join(root,file))
const require=createRequire(path.join(root,'components/transport/package.json'))
const {Transaction}=require('@bsv/sdk')
const manifest=()=>({schema:'tpnil-rust-graph-oracle@3.0.0',corpus:'tpnil-rust-corpus@3',operation:'spends-indexed-v3',cargoFeature:'graph-oracle-v3',pins:{rustSdk:'99d2313f2ede48a465aa8be1907d26d098aac8fd',typescriptSdk:'4.0.1'},sources:Object.fromEntries(corpusV3ManifestInputs.map(file=>[file,sha(read(file))]))})

test('Rust corpus2 remains the default and has no graph-v3 policy',()=>{
  assert.deepEqual(rustCorpusPolicy(),{corpus:'tpnil-rust-corpus@2',sources:corpusSources})
  assert.ok(corpusV3Sources.includes('components/rust/src/graph_oracle_v3.rs'))
  assert.ok(!corpusSources.includes('components/rust/src/graph_oracle_v3.rs'))
  assert.throws(()=>rustCorpusPolicy('tpnil-rust-corpus@4'))
})
test('graph manifest requires the entire exact source inventory',()=>{
  validateRustGraphManifest(manifest(),read)
  for(const file of corpusV3ManifestInputs){const m=manifest();delete m.sources[file];assert.throws(()=>validateRustGraphManifest(m,read))}
  const m=manifest();m.sources['unexpected-input']='00'.repeat(32);assert.throws(()=>validateRustGraphManifest(m,read))
})
test('graph manifest rejects source byte changes and policy/pin substitution',()=>{
  for(const file of corpusV3ManifestInputs) assert.throws(()=>validateRustGraphManifest(manifest(),name=>name===file?Buffer.concat([read(name),Buffer.from('changed')]):read(name)))
  for(const mutate of [m=>m.corpus='tpnil-rust-corpus@2',m=>m.schema='tpnil-rust-graph-oracle@2.0.0',m=>m.operation='spends',m=>m.pins.rustSdk='00'.repeat(20),m=>m.pins.typescriptSdk='2.0.0']){const m=manifest();mutate(m);assert.throws(()=>validateRustGraphManifest(m,read))}
})
test('explicit corpus3 changes only joined spend operation and subject binding',()=>{
  const fixture=JSON.parse(read('fixtures/teranode/wab-funding-v1.json'))
  const payment={txid:fixture.txid,rawHex:fixture.rawHex,beefHex:fixture.atomicBeefHex}
  const capture=corpus=>{
    const requests=[]
    // Responses are intentionally incomplete: this test checks generated request
    // identity, while Rust tests and retained real-payment replays check outcomes.
    evaluateRustCorpus(request=>{requests.push(request);return {ok:false,result:{publicKey:'0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',signature:'3006020101020101'}}},[[payment]],{corpus})
    return requests
  }
  const old=capture('tpnil-rust-corpus@2'),fresh=capture('tpnil-rust-corpus@3')
  assert.equal(old.length,fresh.length)
  let changed=0
  for(let i=0;i<old.length;i++){
    if(old[i].op==='spends'){
      changed++;assert.equal(fresh[i].op,'spends-indexed-v3');assert.equal(fresh[i].txid,Transaction.fromBEEF([...Buffer.from(fresh[i].hex,'hex')]).id('hex'))
      const {txid,op,...rest}=fresh[i];assert.deepEqual(rest,((({op,...rest})=>rest)(old[i])))
    }else assert.deepEqual(fresh[i],old[i])
  }
  assert.equal(changed,2)
})
test('removing native compatibility fields cannot relabel corpus3 as default2, or corpus2 as explicit3',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-rust-policy-'))
  try{
    fs.writeFileSync(path.join(directory,'calls.json'),'[]')
    fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify({schema:'tpnil-component-result@1',corpus:'tpnil-rust-corpus@3'}))
    assert.throws(()=>verifyRust(directory,[]),/tpnil-rust-corpus@/)
    fs.writeFileSync(path.join(directory,'result.json'),JSON.stringify({schema:'tpnil-component-result@1',corpus:'tpnil-rust-corpus@2'}))
    assert.throws(()=>verifyRust(directory,[],{corpus:'tpnil-rust-corpus@3'}),/tpnil-rust-corpus@/)
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
})
