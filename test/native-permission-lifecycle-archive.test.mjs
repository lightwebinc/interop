import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { verifyPermissionLifecycleArchive } from '../scripts/verify-native-permission-lifecycle-archive.mjs'
const original = path.resolve(import.meta.dirname, '../journals/native-permission-lifecycle/2026-11-09')
function mutated(operation) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-permission-archive-test-'))
  try { const directory = path.join(temporary, 'archive'); fs.cpSync(original, directory, { recursive: true }); operation(directory); assert.throws(() => verifyPermissionLifecycleArchive(directory)) }
  finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}
test('permission lifecycle engineering archive preserves every file and original attempt member', () => {
  const result = verifyPermissionLifecycleArchive(original)
  assert.equal(result.result, 'PASS'); assert.equal(result.lifecyclePredicates, 16); assert.equal(result.nativeMacOSEngineeringOnly, true)
})
test('permission archive rejects a changed original artifact byte', () => mutated(directory => {
  fs.appendFileSync(path.join(directory, 'prior-attempts.zip'), 'changed')
}))
test('permission archive rejects omission of a mandatory frozen verifier input even with a rewritten inventory', () => mutated(directory => {
  const name = 'replay-source/synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts'
  fs.unlinkSync(path.join(directory, name))
  const file = path.join(directory, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  manifest.files = manifest.files.filter(row => row.path !== name); fs.writeFileSync(file, JSON.stringify(manifest))
}))
test('permission archive rejects an upgraded qualification claim', () => mutated(directory => {
  const file = path.join(directory, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  manifest.claim = 'FULL_NATIVE_BRC100_CONFORMANCE'; fs.writeFileSync(file, JSON.stringify(manifest))
}))
