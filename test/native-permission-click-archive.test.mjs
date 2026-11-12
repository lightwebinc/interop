import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { verifyPermissionClickArchive } from '../scripts/verify-native-permission-click-archive.mjs'
const original=path.resolve(import.meta.dirname,'../journals/native-permission-click/2026-11-09/oracle-2.0.0')
function changed(mutate){const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tpnil-permission-click-test-'));try{const directory=path.join(temporary,'evidence');fs.cpSync(original,directory,{recursive:true});mutate(directory);assert.throws(()=>verifyPermissionClickArchive(directory))}finally{fs.rmSync(temporary,{recursive:true,force:true})}}
test('trusted-click archive retains two native engineering repetitions and20 closure selftests',()=>{const r=verifyPermissionClickArchive(original);assert.equal(r.nativeMacOSEngineeringAssertions,48);assert.equal(r.popupClosureSelfTests,20);assert.equal(r.nativeLinuxQualification,false)})
test('trusted-click archive rejects changed recorded native evidence',()=>changed(directory=>fs.appendFileSync(path.join(directory,'repetition-1/evidence/conformance/permissions.json'),'changed')))
test('trusted-click archive rejects missing mandatory source despite rewritten inventory',()=>changed(directory=>{const name='replay-source/synthesis/src/wallet-lab/native/permission-click.ts';fs.unlinkSync(path.join(directory,name));const p=path.join(directory,'manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));m.files=m.files.filter(r=>r.path!==name);fs.writeFileSync(p,JSON.stringify(m))}))
test('trusted-click archive cannot claim native Linux qualification',()=>changed(directory=>{const p=path.join(directory,'manifest.json'),m=JSON.parse(fs.readFileSync(p,'utf8'));m.claim='NATIVE_LINUX_QUALIFICATION';fs.writeFileSync(p,JSON.stringify(m))}))
