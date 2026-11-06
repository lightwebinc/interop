import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { verifyNativeTrust } from '../src/wallet-lab/native/verify-identity-trust.js'
import { verifyBoundaryCorpus } from '../src/wallet-lab/verify-boundary.js'
import { EvidenceBundle } from '../src/wallet-lab/evidence.js'

it('replays both public settings retirement cases and rejects semantic tampering', async () => {
  const directory = path.resolve(import.meta.dirname, '../../journals/native-identity-trust-reference/2026-11-06')
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
  const bytes = fs.readFileSync(path.join(directory, summary.archive.path))
  const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  assert.equal(bytes.length, summary.archive.size); assert.equal(sha(bytes), summary.archive.sha256)
  const bundle = JSON.parse(gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 }).toString())
  assert.equal(bundle.nativeExecution, false); assert.equal(bundle.files.length, summary.archive.files)
  const files = new Map<string, string>()
  for (const row of bundle.files) {
    const data = Buffer.from(row.content)
    assert.equal(data.length, row.size); assert.equal(sha(data), row.sha256)
    assert.ok(!files.has(row.path)); files.set(row.path, row.content)
  }
  for (const run of summary.runs) {
    const report = JSON.parse(files.get(`${run.directory}/identity-trust.json`)!)
    const boundary = JSON.parse(files.get(`${run.directory}/boundary.json`)!)
    const verified = await verifyNativeTrust(report, boundary)
    expect(verified.result).toBe('PASS'); expect(verified.assertions).toHaveLength(8)
    expect(report.originalOutputs.totalOutputs).toBe(run.originalSettingsTokens)
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-trust-serialization-'))
    try {
      const bundle = new EvidenceBundle(temporary)
      const publication = JSON.parse(files.get(`${run.directory}/boundary-publication.json`)!)
      for (const [name, value] of [['identity-trust', report], ['boundary', boundary], ['boundary-publication', publication]]) bundle.addJson(`integrated/${name}.json`, value)
      bundle.flush()
      const read = (name: string) => JSON.parse(fs.readFileSync(path.join(temporary, `evidence/integrated/${name}.json`), 'utf8'))
      expect((await verifyNativeTrust(read('identity-trust'), read('boundary'))).result).toBe('PASS')
      expect((await verifyBoundaryCorpus(read('boundary'), read('boundary-publication'))).outcome).toBe('PASS')
    } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
    const noWait = structuredClone(report); noWait.wait.endedAt = noWait.wait.startedAt
    await expect(verifyNativeTrust(noWait, boundary)).rejects.toThrow('Independent native trust predicate differs')
    const changedSettings = structuredClone(report); changedSettings.restoredSettings.currency = 'ALTERED'
    await expect(verifyNativeTrust(changedSettings, boundary)).rejects.toThrow('Independent native trust predicate differs')
    const unspent = structuredClone(report)
    const writeTx = report.transactions.find((tx: any) => tx.txid === report.temporaryOutputs.outputs[0].outpoint.split('.')[0])
    unspent.retirementTransaction = { txid: writeTx.txid, raw: writeTx.rawHex, beef: [...Buffer.from(writeTx.beefHex, 'hex')] }
    await expect(verifyNativeTrust(unspent, boundary)).rejects.toThrow('Independent native trust predicate differs')
  }
})
