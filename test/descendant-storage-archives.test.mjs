import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { verifyDescendantArchive, verifyDescendantArchives } from '../scripts/verify-descendant-storage-archives.mjs'

const fixture = path.resolve(import.meta.dirname, '../journals/descendant-storage-qualification/2026-11-09/42689603169')
function temporary(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-descendant-archive-test-'))
  const directory = path.join(root, 'journals/descendant-storage-qualification/2026-11-09/fixture')
  try { fs.cpSync(fixture, directory, { recursive: true }); return run(directory, root) }
  finally { fs.rmSync(root, { recursive: true, force: true }) }
}
function rewriteQualification(directory, change) {
  const file = path.join(directory, 'qualification.json'), value = JSON.parse(fs.readFileSync(file))
  change(value); fs.writeFileSync(file, JSON.stringify(value))
  const manifest = path.join(directory, 'provenance.json'), provenance = JSON.parse(fs.readFileSync(manifest)), bytes = fs.readFileSync(file)
  Object.assign(provenance.files.find(row => row.path === 'qualification.json'), { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  fs.writeFileSync(manifest, JSON.stringify(provenance))
}

test('retained descendant CI archive binds all 46 members and eight fresh runs', () => {
  const result = verifyDescendantArchive(fixture)
  assert.equal(result.members, 46); assert.equal(result.assertions.PASS, 80); assert.equal(result.semantic, false)
})
test('a recomputed outer digest cannot relabel reference evidence as native qualification', () => temporary(directory => {
  rewriteQualification(directory, value => { value.nativeQualification = true })
  assert.throws(() => verifyDescendantArchive(directory))
}))
test('published counts and member inventory must agree with the actual ZIP', () => temporary(directory => {
  rewriteQualification(directory, value => { value.assertions.PASS = 79 })
  assert.throws(() => verifyDescendantArchive(directory))
  rewriteQualification(directory, value => { value.assertions.PASS = 80; value.members.pop() })
  assert.throws(() => verifyDescendantArchive(directory))
}))
test('v1 archive cannot claim the prospective exact-history policy', () => temporary(directory => {
  rewriteQualification(directory, value => { value.projection = { profile: 'ISI-3/descendant-storage@2.0.0' } })
  assert.throws(() => verifyDescendantArchive(directory))
}))
test('prospective qualification schema cannot reinterpret a v1 archive', () => temporary(directory => {
  rewriteQualification(directory, value => { value.schema = 'tpnil-descendant-storage-ci-qualification@2' })
  assert.throws(() => verifyDescendantArchive(directory))
}))
test('omitting a provenance file or adding an unlisted file cannot hide an archive', () => temporary((directory, root) => {
  fs.writeFileSync(path.join(directory, 'unlisted.txt'), 'extra')
  assert.throws(() => verifyDescendantArchives({ root }))
  fs.unlinkSync(path.join(directory, 'unlisted.txt'))
  fs.unlinkSync(path.join(directory, 'provenance.json'))
  assert.throws(() => verifyDescendantArchives({ root }), /Unmanifested/)
}))
