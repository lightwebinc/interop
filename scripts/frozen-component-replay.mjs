import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const paths=['package.json','.nvmrc','.github','scripts','synthesis','infra','fixtures','components','integrations','itcves','programs','config','src','bin','adapters','schemas','suts']
/** Replay an integration pack against its recorded Git source. The caller owns and
 * removes `directory`; installed dependencies are reused only with exact locks. */
export function prepareFrozenComponentReplay(root,source,directory,{repository=process.env.TPNIL_REPLAY_GIT_ROOT??root}={}) {
  assert.match(source,/^[0-9a-f]{40}$/)
  assert.ok(!fs.existsSync(directory),'Frozen replay requires a new owned directory')
  const tree=execFileSync('git',['ls-tree','-r','-z',source,'--',...paths],{cwd:repository,maxBuffer:32*1024*1024}).toString().split('\0').filter(Boolean)
  assert.ok(tree.length>0,'Frozen source is absent')
  for(const row of tree) {
    assert.match(row,/^100(?:644|755) blob [a-f0-9]{40}\t/,'Frozen replay rejects Git symlinks and non-file objects')
    const name=row.slice(row.indexOf('\t')+1)
    assert.ok(!path.isAbsolute(name)&&name.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe frozen source path')
  }
  fs.mkdirSync(directory,{recursive:true})
  // Node canonicalizes import.meta.filename. Legacy CLI guards compare it to
  // argv[1], so every extracted entry point must use the same physical path.
  directory=fs.realpathSync(directory)
  const present=[...new Set(tree.map(row=>row.slice(row.indexOf('\t')+1).split('/')[0]))]
  const archive=execFileSync('git',['archive','--format=tar',source,'--',...present],{cwd:repository,maxBuffer:128*1024*1024})
  const unpack=spawnSync('tar',['-xf','-','-C',directory],{input:archive});assert.equal(unpack.status,0,String(unpack.stderr))
  const expectedNode=fs.readFileSync(path.join(directory,'.nvmrc'),'utf8').trim().replace(/^v/,'')
  assert.equal(process.versions.node,expectedNode,'Use the recorded Node runtime for integration replay')
  const reused=[]
  for(const dependency of ['synthesis','integrations/services','components/transport']) {
    const lock=`${dependency}/package-lock.json`
    assert.equal(hash(fs.readFileSync(path.join(root,lock))),hash(fs.readFileSync(path.join(directory,lock))),`Install the frozen dependencies before replay: ${lock}`)
    const modules=path.join(root,dependency,'node_modules');assert.ok(fs.statSync(modules).isDirectory())
    fs.symlinkSync(modules,path.join(directory,dependency,'node_modules'),'dir');reused.push(`${dependency}/node_modules`)
  }
  assert.equal(hash(fs.readFileSync(path.join(root,'components/rust/Cargo.lock'))),hash(fs.readFileSync(path.join(directory,'components/rust/Cargo.lock'))),'Install the frozen Rust dependency closure before replay')
  // Cargo still rebuilds and checks its locked exact-source program offline.
  for(const cache of ['components/rust/target','out']) if(fs.existsSync(path.join(root,cache))) {
    fs.symlinkSync(path.join(root,cache),path.join(directory,cache),'dir');reused.push(cache)
  }
  return {root:directory,source,files:tree.length,reused}
}

/** A successful process exit alone cannot prove that a guarded CLI executed.
 * Accept the final complete JSON receipt, allowing earlier diagnostic lines. */
export function requireVerifierReceipt(stdout,expected={verified:true}) {
  assert.equal(typeof stdout,'string')
  let receipt
  // These CLIs emit top-level receipts at column zero. An indented nested
  // object in a truncated pretty-printed envelope is not a receipt.
  const starts=[...stdout.matchAll(/^\{/gm)].map(match=>match.index)
  for(const start of starts.reverse()) {
    try {receipt=JSON.parse(stdout.slice(start).trim());break} catch {}
  }
  assert.ok(receipt&&typeof receipt==='object'&&!Array.isArray(receipt),'Verifier did not emit a complete JSON receipt')
  for(const [key,value] of Object.entries(expected))assert.deepEqual(receipt[key],value,`Verifier receipt field differs: ${key}`)
  return receipt
}
