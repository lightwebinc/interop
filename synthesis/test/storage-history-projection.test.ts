import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { normalizeHistoryTimestamp, projectDatasetV2 } from '../src/storage-sync/history-projection.js'
import { projectDataset } from '../src/storage-sync/projection.js'
import { storageProjectionV2Binding, storageProjectionV2Runtime } from '../src/storage-sync/projection-profile.js'
import { runStorageSyncCase } from '../src/storage-sync/run.js'
import { verifyStorageCase } from '../src/storage-sync/verify.js'

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const archive = path.resolve(import.meta.dirname, '../../journals/integrated-component-attempts/2026-11-09/42706097914/integrated-lab.zip')
const original = (name: string) => execFileSync('unzip', ['-p', archive, `storage-sync/typescript-to-go-2/${name}`], { maxBuffer: 4 * 1024 * 1024 })
const observationsBytes = original('observations.json')
expect(sha(observationsBytes)).toBe('c848406585f4b2e57ff181001a34d1718cf136b09249e6d95dc894ffab3bec62')
const observed = JSON.parse(observationsBytes.toString())

describe('explicit major2 exact history timestamp projection', () => {
  it.each([
    ['2026-11-09T21:54:52.660Z', '2026-11-09T21:54:52.66Z'],
    ['2026-11-09T21:54:52.000Z', '2026-11-09T21:54:52Z'],
    ['2000-02-29T00:00:00.123456789000Z', '2000-02-29T00:00:00.123456789Z'],
    ['2024-02-29T23:59:59.00000000100+00:00', '2024-02-29T23:59:59.000000001+00:00']
  ])('removes only insignificant fractional zeros: %s', (value, expected) => expect(normalizeHistoryTimestamp(value)).toBe(expected))
  it('preserves unequal nanoseconds and arbitrarily small significant fractions', () => {
    expect(normalizeHistoryTimestamp('2026-11-09T21:54:52.660000001Z')).not.toBe(normalizeHistoryTimestamp('2026-11-09T21:54:52.660000002Z'))
    const tiny = `2026-11-09T21:54:52.${'0'.repeat(40)}1Z`
    expect(normalizeHistoryTimestamp(tiny)).toBe(tiny)
    expect(normalizeHistoryTimestamp('2026-11-09T21:54:52Z')).not.toBe(normalizeHistoryTimestamp('2026-11-09T21:54:52+00:00'))
  })
  it.each(['2026-02-29T00:00:00Z', '1900-02-29T00:00:00Z', '2026-02-30T00:00:00Z', '2026-04-31T00:00:00Z', '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z', '2026-01-00T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z', '2026-01-01T00:00:60Z', '2026-01-01T00:00:00.Z', '2026-01-01T00:00:00.1e3Z', '2026-01-01T00:00:00-00:00', '2026-01-01T00:00:00+01:00', '2026-01-01t00:00:00z', '2026-01-01T00:00:00Z ', '', null, 1762722000000])('rejects malformed or unsupported history time %s', value => expect(() => normalizeHistoryTimestamp(value)).toThrow())
  it('retains the original Foundation9 v1 mismatch and compares its unchanged raw records under v2', () => {
    expect(projectDataset(observed.source)).not.toEqual(projectDataset(observed.destination))
    expect(projectDatasetV2(observed.source)).toEqual(projectDatasetV2(observed.destination))
    expect(projectDatasetV2(observed.incremental.sourceRaw)).toEqual(projectDatasetV2(observed.incremental.destinationRaw))
    expect(JSON.stringify(observed)).toBe(JSON.stringify(JSON.parse(observationsBytes.toString())))
    expect(JSON.parse(original('result.json').toString()).result).toBe('FAIL')
  })
  it('normalizes only the declared field and retains unrelated history metadata', () => {
    const a = structuredClone(observed.source), b = structuredClone(a)
    for (const [dataset, suffix] of [[a, '.660Z'], [b, '.66Z']] as const) {
      const row = dataset.provenTxReqs[0], history = JSON.parse(row.history)
      history.unrelatedWhen = `2026-11-09T21:54:52${suffix}`
      row.history = JSON.stringify(history)
    }
    expect(projectDatasetV2(a)).not.toEqual(projectDatasetV2(b))
  })
  it('keeps v1 explicit and rejects rebound v2 nanoseconds, malformed calendar and unrelated metadata', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-history-v2-unit-'))
    try {
      for (const name of ['result.json', 'observations.json', 'transcript.json']) fs.writeFileSync(path.join(directory, name), original(name))
      expect(() => verifyStorageCase(directory)).toThrow('Initial raw logical datasets differ')
      // Prospective unit fixture only: immutable failed CI bytes above stay v1.
      const baseline = JSON.parse(original('result.json').toString())
      baseline.schema = 'tpnil-storage-sync-run@2.0.0'; Object.assign(baseline, storageProjectionV2Binding())
      baseline.projectionRuntime = { declaredTimezone: 'UTC', resolvedTimezone: 'UTC', offsetMinutes: 0, observedAt: baseline.startedAt }
      baseline.result = 'PASS'; for (const assertion of baseline.assertions) assertion.result = 'PASS'
      function write(mutate: (o: any) => void = () => {}) {
        const o = structuredClone(observed), result = structuredClone(baseline); mutate(o)
        o.sourceProjection = projectDatasetV2(o.source); o.destinationProjection = projectDatasetV2(o.destination)
        o.incremental.source = projectDatasetV2(o.incremental.sourceRaw); o.incremental.destination = projectDatasetV2(o.incremental.destinationRaw)
        const bytes = Buffer.from(JSON.stringify(o)); fs.writeFileSync(path.join(directory, 'observations.json'), bytes)
        result.evidence.find((row: any) => row.path === 'observations.json').sha256 = sha(bytes)
        fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(result))
      }
      write(); expect(verifyStorageCase(directory).components).toMatchObject({ source: 'typescript', destination: 'go' })
      write(o => { const row = o.destination.provenTxReqs[0], history = JSON.parse(row.history); history.notes[1].when = '2026-11-09T21:54:52.660000001Z'; row.history = JSON.stringify(history) })
      expect(() => verifyStorageCase(directory)).toThrow('Initial raw logical datasets differ')
      write(o => { o.destination.outputs[0].providedBy = 'altered' })
      expect(() => verifyStorageCase(directory)).toThrow('Initial raw logical datasets differ')
      expect(() => write(o => { const row = o.destination.provenTxReqs[0], history = JSON.parse(row.history); history.notes[1].when = '2026-02-30T00:00:00Z'; row.history = JSON.stringify(history) })).toThrow('invalid calendar')
      write(); const relabelled = JSON.parse(fs.readFileSync(path.join(directory, 'result.json'), 'utf8')); relabelled.schema = 'tpnil-storage-sync-run@1.0.0'
      fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify(relabelled))
      expect(() => verifyStorageCase(directory)).toThrow('Storage projection binding differs')
    } finally { fs.rmSync(directory, { recursive: true, force: true }) }
  })
})


it('observes the UTC process and rejects missing or falsely declared UTC before starting services', async () => {
  const directory = path.join(os.tmpdir(), `tpnil-history-utc-${process.pid}-${Date.now()}`)
  try {
    vi.stubEnv('TZ', undefined)
    expect(() => storageProjectionV2Runtime()).toThrow('requires TZ=UTC')
    await expect(runStorageSyncCase('typescript', 'typescript', directory, { projectionVersion: 2 })).rejects.toThrow('requires TZ=UTC')
    expect(fs.existsSync(directory)).toBe(false)
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(() => storageProjectionV2Runtime()).toThrow('requires TZ=UTC')
    vi.stubEnv('TZ', 'UTC')
    expect(storageProjectionV2Runtime()).toMatchObject({ declaredTimezone: 'UTC', resolvedTimezone: 'UTC', offsetMinutes: 0 })
    const offset = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(60)
    try { expect(() => storageProjectionV2Runtime()).toThrow('requires TZ=UTC') } finally { offset.mockRestore() }
  } finally { vi.unstubAllEnvs(); fs.rmSync(directory, { recursive: true, force: true }) }
})
