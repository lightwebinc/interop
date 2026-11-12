import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { historyProjectionPolicy } from './history-projection.js'
import { storageProjectionV2Binding } from './projection-profile.js'

export const descendantProjectionProfilePath = 'programs/ISI-3/profiles/descendant-storage-2.0.0/profile.json'
export const descendantProjectionProfile = 'ISI-3/descendant-storage@2.0.0'
const root = path.resolve(import.meta.dirname, '../../..')
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** The opt-in policy is evidence, not an inference from a caller's file list. */
export function descendantProjectionV2Binding() {
  const bytes = fs.readFileSync(path.join(root, descendantProjectionProfilePath))
  const manifest = JSON.parse(bytes.toString())
  assert.equal(manifest.schema, 'tpnil-descendant-storage-profile@2.0.0')
  assert.equal(manifest.id, descendantProjectionProfile)
  assert.equal(manifest.projectionPolicy, historyProjectionPolicy)
  assert.equal(manifest.reportSchema, 'tpnil-descendant-storage-sync@2')
  assert.equal(manifest.matrixSchema, 'tpnil-descendant-storage-matrix@2')
  assert.deepEqual(Object.keys(manifest.sourceFiles).sort(), [
    'synthesis/src/storage-sync/descendant-funding.ts',
    'synthesis/src/storage-sync/descendant-profile.ts',
    'synthesis/src/storage-sync/verify-descendant.ts'
  ])
  for (const [file, digest] of Object.entries(manifest.sourceFiles)) {
    assert.equal(hash(fs.readFileSync(path.join(root, file))), digest, `Descendant projection source differs: ${file}`)
  }
  const storageProjection = storageProjectionV2Binding()
  assert.deepEqual(manifest.storageProjection, storageProjection)
  return { profile: descendantProjectionProfile, projectionPolicy: historyProjectionPolicy, projectionManifestSha256: hash(bytes), storageProjection }
}

export function verifyDescendantProjectionRuntime(runtime: any, startedAt: string): void {
  assert.deepEqual(Object.keys(runtime).sort(), ['declaredTimezone', 'observedAt', 'offsetMinutes', 'resolvedTimezone'])
  assert.equal(runtime.declaredTimezone, 'UTC'); assert.equal(runtime.resolvedTimezone, 'UTC'); assert.equal(runtime.offsetMinutes, 0)
  assert.match(runtime.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.ok(Number.isFinite(Date.parse(runtime.observedAt)) && Date.parse(runtime.observedAt) <= Date.parse(startedAt), 'UTC runtime was not observed before the scenario')
}
