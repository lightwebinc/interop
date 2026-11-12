import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { verifyNativePermissionConformance } from '../src/wallet-lab/native/verify-conformance-permissions.js'
import { verifyNativePermissionLifecycle } from '../src/wallet-lab/native/verify-conformance-permission-lifecycle.js'
const root=path.resolve(import.meta.dirname,'../..'),v2=path.join(root,'journals/native-permission-click/2026-11-09/oracle-2.0.0')
const historic=path.join(root,'journals/integrated-native-attempts/2026-11-09/42697283161/native-integrated.zip')
describe('versioned native permission observation replay',()=>{
 it.each([1,2])('replays actual version2 native engineering repetition%s',async repetition=>{
  const read=(name:string)=>fs.readFileSync(path.join(v2,`repetition-${repetition}/evidence`,name)),lifecycle=JSON.parse(read('conformance/permission-lifecycle.json').toString()),original=JSON.parse(read('conformance/permissions.json').toString())
  expect(verifyNativePermissionConformance(original,read,lifecycle.identity).result).toBe('PASS');expect((await verifyNativePermissionLifecycle(lifecycle,read,lifecycle.identity)).result).toBe('PASS')
 })
 it.each([1,2])('preserves original native7 version1 repetition%s verdicts',async repetition=>{
  const read=(name:string)=>execFileSync('unzip',['-p',historic,`repetition-${repetition}/evidence/${name}`],{maxBuffer:8*1024*1024}),lifecycle=JSON.parse(read('conformance/permission-lifecycle.json').toString()),original=JSON.parse(read('conformance/permissions.json').toString())
  const old=verifyNativePermissionConformance(original,read,lifecycle.identity),life=await verifyNativePermissionLifecycle(lifecycle,read,lifecycle.identity)
  expect(old.assertions.filter(row=>row.result==='FAIL')).toHaveLength(repetition===1?2:0);expect(life.assertions.filter(row=>row.result==='FAIL')).toHaveLength(repetition===1?1:0)
 })
 it('does not promote a missing event or response replay to permission denial',async()=>{
  const read=(name:string)=>fs.readFileSync(path.join(v2,'repetition-1/evidence',name)),lifecycle=JSON.parse(read('conformance/permission-lifecycle.json').toString()),original=JSON.parse(read('conformance/permissions.json').toString())
  original.steps.find((r:any)=>r.id==='alternate-deny').prompts[0].trustedClick.dispatch=null
  expect(()=>verifyNativePermissionConformance(original,read,lifecycle.identity)).toThrow()
  lifecycle.steps.find((r:any)=>r.id==='basket-cached').outcome.requestNonce=lifecycle.steps[0].requestNonce
  await expect(verifyNativePermissionLifecycle(lifecycle,read,lifecycle.identity)).rejects.toThrow()
 })
})
