import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runDescendantFundingSync } from '../src/storage-sync/descendant-funding.js'
import { verifyDescendantFundingReport } from '../src/storage-sync/verify-descendant.js'
import { descendantProjectionV2Binding } from '../src/storage-sync/descendant-profile.js'

const clone = <T>(value: T): T => structuredClone(value)

/** Rebind both retained public RPC pages and their observer datasets, so these
 * mutations reach the actual metadata oracle instead of just its copy guard. */
function changeHistory(value: any, edit: (note: any) => void): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) { value.forEach(item => changeHistory(item, edit)); return }
  for (const [key, item] of Object.entries(value)) {
    if (key === 'history') {
      const history = typeof item === 'string' ? JSON.parse(item) : item
      for (const note of history?.notes ?? []) if (Object.hasOwn(note, 'when')) edit(note)
      value[key] = typeof item === 'string' ? JSON.stringify(history) : history
    } else changeHistory(item, edit)
  }
}
function alterSide(report: any, side: 'source' | 'destination', edit: (note: any) => void): void {
  for (const name of side === 'source' ? ['sourceDataset', 'proofPages'] : ['destinationDataset', 'destinationAfter']) changeHistory(report[name], edit)
  for (const row of report.transcript) {
    if (side === 'source' ? row.provider === 'source-observer' : ['destination-observer', 'replacement-after-observer'].includes(row.provider)) changeHistory(row, edit)
  }
}
function withInstants(report: any, source: string, destination: string): any {
  const result = clone(report)
  alterSide(result, 'source', note => { note.when = source })
  alterSide(result, 'destination', note => { note.when = destination })
  return result
}

describe('explicit descendant v2 exact fractional history policy', () => {
  let directory: string, report: any, oldTimezone: string | undefined
  beforeAll(async () => {
    oldTimezone = process.env.TZ; process.env.TZ = 'UTC'
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-descendant-v2-test-'))
    report = await runDescendantFundingSync({ source: 'typescript', destination: 'typescript', output: path.join(directory, 'actual'), typescriptDescendantExport: true, ownerKeyHex: '7b'.repeat(32), exactHistory: true })
  }, 60_000)
  afterAll(() => {
    if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone
    if (directory) fs.rmSync(directory, { recursive: true, force: true })
  })
  it('verifies actual public source-off replacement with the explicit source-bound v2 policy', async () => {
    expect(report.error).toBeUndefined(); expect(report.schema).toBe('tpnil-descendant-storage-sync@2')
    expect(report.projection).toEqual(descendantProjectionV2Binding())
    const verified = await verifyDescendantFundingReport(report)
    expect(verified.assertions).toHaveLength(10); expect(verified.projection).toEqual(report.projection)
  })
  it.each([
    ['2026-11-09T21:54:52.660Z', '2026-11-09T21:54:52.66Z'],
    ['2026-11-09T21:54:52.1234567890Z', '2026-11-09T21:54:52.123456789Z'],
    ['2026-11-09T21:54:52.000Z', '2026-11-09T21:54:52Z']
  ])('accepts only insignificant trailing zeros: %s versus %s', async (source, destination) => {
    const changed = withInstants(report, source, destination), before = JSON.stringify(changed)
    expect((await verifyDescendantFundingReport(changed)).verified).toBe(true)
    expect(JSON.stringify(changed)).toBe(before)
  })
  it.each([
    ['2026-11-09T21:54:52.123456789Z', '2026-11-09T21:54:52.123456788Z'],
    ['2026-11-09T21:54:52.1234567891Z', '2026-11-09T21:54:52.1234567892Z'],
    ['2026-11-09T21:54:52.66Z', '2026-11-09T21:54:53.66Z']
  ])('rejects a changed instant without millisecond truncation: %s versus %s', async (source, destination) => {
    await expect(verifyDescendantFundingReport(withInstants(report, source, destination))).rejects.toThrow('Logical dataset')
  })
  it.each(['2026-02-29T21:54:52Z', '2026-11-09T24:00:00Z', '2026-11-09T21:54:60Z', '2026-11-09T21:54:52.Z', '2026-11-09T21:54:52-08:00', '2026-11-09 21:54:52Z'])('rejects invalid timestamp even when both copies agree: %s', async value => {
    await expect(verifyDescendantFundingReport(withInstants(report, value, value))).rejects.toThrow()
  })
  it('does not normalize unrelated history metadata or ignore note order', async () => {
    const changed = clone(report)
    alterSide(changed, 'destination', note => { note.what = 'different event' })
    await expect(verifyDescendantFundingReport(changed)).rejects.toThrow('Logical dataset')
  })
  it.each([
    ['missing policy', (r: any) => { delete r.projection }],
    ['wrong policy', (r: any) => { r.projection.projectionPolicy = 'legacy-millisecond-policy' }],
    ['wrong digest', (r: any) => { r.projection.projectionManifestSha256 = '00'.repeat(32) }],
    ['schema downgrade', (r: any) => { r.schema = 'tpnil-descendant-storage-sync@1' }],
    ['unknown schema', (r: any) => { r.schema = 'tpnil-descendant-storage-sync@3' }]
  ] as const)('rejects %s instead of inferring an opt-in policy', async (_name, mutate) => {
    const changed = clone(report); mutate(changed)
    await expect(verifyDescendantFundingReport(changed)).rejects.toThrow()
  })
  it.each([
    ['declaration', (r: any) => { r.projectionRuntime.declaredTimezone = 'America/Los_Angeles' }],
    ['resolved timezone', (r: any) => { r.projectionRuntime.resolvedTimezone = 'America/Los_Angeles' }],
    ['observed offset', (r: any) => { r.projectionRuntime.offsetMinutes = 480 }],
    ['late observation', (r: any) => { r.projectionRuntime.observedAt = r.endedAt }]
  ] as const)('rejects substituted UTC runtime %s', async (_name, mutate) => {
    const changed = clone(report); mutate(changed)
    await expect(verifyDescendantFundingReport(changed)).rejects.toThrow()
  })
  it('rejects an undeclared local-time direct API before creating output or services', async () => {
    const output = path.join(directory, 'must-not-start')
    try {
      process.env.TZ = 'America/Los_Angeles'
      await expect(runDescendantFundingSync({ source: 'typescript', destination: 'typescript', output, exactHistory: true })).rejects.toThrow()
      expect(fs.existsSync(output)).toBe(false)
    } finally { process.env.TZ = 'UTC' }
  })
  it('retains the original v1 default projection on the original schema', async () => {
    const legacy = withInstants(report, '2026-11-09T21:54:52.123456789Z', '2026-11-09T21:54:52.123456788Z')
    legacy.schema = 'tpnil-descendant-storage-sync@1'; delete legacy.projection; delete legacy.projectionRuntime
    expect((await verifyDescendantFundingReport(legacy)).verified).toBe(true)
  })
})
