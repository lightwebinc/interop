import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { historyProjectionPolicy } from './history-projection.js'

export const storageProjectionProfilePath = 'programs/ISI-3/profiles/storage-http-sync-2.0.0/profile.json'
export const storageProjectionProfile = 'ISI-3/storage-http-sync@2.0.0'
const root = path.resolve(import.meta.dirname, '../../..')
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export function storageProjectionV2Binding() {
  const bytes = fs.readFileSync(path.join(root, storageProjectionProfilePath)), manifest = JSON.parse(bytes.toString())
  assert.equal(manifest.schema, 'tpnil-storage-sync-profile@2.0.0')
  assert.equal(manifest.id, storageProjectionProfile); assert.equal(manifest.projectionPolicy, historyProjectionPolicy)
  assert.deepEqual(Object.keys(manifest.sourceFiles).sort(), ['synthesis/src/storage-sync/history-projection.ts', 'synthesis/src/storage-sync/projection-profile.ts', 'synthesis/src/storage-sync/projection.ts'])
  for (const [name, digest] of Object.entries(manifest.sourceFiles)) assert.equal(sha(fs.readFileSync(path.join(root, name))), digest, `Projection source differs: ${name}`)
  return { profile: storageProjectionProfile, projectionPolicy: historyProjectionPolicy, projectionManifestSha256: sha(bytes) }
}

/** Reference v2 requires an observed UTC process before any service starts. */
export function storageProjectionV2Runtime() {
  const now = new Date()
  const observation = { declaredTimezone: process.env.TZ ?? null, resolvedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes: now.getTimezoneOffset(), observedAt: now.toISOString() }
  if (observation.declaredTimezone !== 'UTC' || observation.resolvedTimezone !== 'UTC' || observation.offsetMinutes !== 0) throw new Error('Storage projection v2 requires TZ=UTC and an observed UTC process timezone before service startup')
  return observation
}
