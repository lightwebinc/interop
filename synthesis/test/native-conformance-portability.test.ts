import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { EvidenceBundle } from '../src/wallet-lab/evidence.js'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'
import { verifyNativePortability } from '../src/wallet-lab/native/verify-conformance-portability.js'

const directory = path.resolve(import.meta.dirname, '../../journals/native-portability-reference/2026-11-09')
const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'))
const bytes = fs.readFileSync(path.join(directory, summary.archive.path))
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
assert.equal(bytes.length, summary.archive.size); assert.equal(sha(bytes), summary.archive.sha256)
const archive = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString())
const files = new Map<string, string>()
for (const file of archive.files) {
  const bytes = Buffer.from(file.content); assert.equal(bytes.length, file.size); assert.equal(sha(bytes), file.sha256)
  assert.ok(!files.has(file.path)); files.set(file.path, file.content)
}

for (const run of summary.finalRuns) it(`independently replays ${run.implementation} portability and rejects tampered task/state/proof evidence`, async () => {
  const report = JSON.parse(files.get(`${run.directory}/portability.json`)!)
  expect((await verifyNativePortability(report, { requireNative: false })).result).toBe('PASS')
  await expect(verifyNativePortability(report)).rejects.toThrow('Reference recreation cannot qualify native portability')
  const mutations: Array<(r: any) => void> = [
    r => { r.identityAfter = '02' + '00'.repeat(32) },
    r => { r.outage.probe.reachable = true },
    r => { r.coldReload.at = new Date(Date.parse(r.outage.endedAt) + 1).toISOString() },
    r => { r.trace.filter((row: any) => row.method === 'decrypt').at(-1).startedAt = '2000-01-01T00:00:00.000Z' },
    r => { const row = r.trace.at(-1); row.startedAt = new Date(Date.parse(r.outage.endedAt) + 60_000).toISOString(); row.endedAt = new Date(Date.parse(r.outage.endedAt) + 61_000).toISOString() },
    r => { const row = r.trace.at(-1); row.startedAt = r.outage.startedAt; row.endedAt = r.outage.startedAt },
    r => { const rows = r.trace.filter((row: any) => row.method === 'decrypt'); rows[0].startedAt = rows[1].startedAt; rows[0].endedAt = rows[1].endedAt },
    r => { const row = r.trace.at(-1); row.endedAt = new Date(Date.parse(row.startedAt) - 1).toISOString() },
    r => { r.recovered.outputs[0].outpoint = '00'.repeat(32) + '.0' },
    r => { r.task.ciphertext[0] ^= 1 },
    r => { r.redemption.rawHex = r.task.rawHex },
    r => { r.source.outputs[0].providedBy = 'forged'; r.destination.outputs[0].providedBy = 'forged' },
    r => { r.source.provenTxs[0].merkleRoot = '00'.repeat(32); r.destination.provenTxs[0].merkleRoot = '00'.repeat(32) },
    r => { r.storage.find((row: any) => row.method === 'getSyncChunk').request[0].offsets[0].offset = 1 },
    r => { r.destinationAfter.outputs.find((row: any) => row.txid === r.task.txid && row.vout === r.task.vout).spendable = true }
  ]
  for (const mutate of mutations) {
    const changed = structuredClone(report); mutate(changed)
    await expect(verifyNativePortability(changed, { requireNative: false })).rejects.toThrow('Independent portability predicate differs')
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-portability-evidence-'))
  try {
    const evidence = new EvidenceBundle(temporary)
    evidence.addJson('conformance/portability.json', report); evidence.flush()
    const read = JSON.parse(fs.readFileSync(path.join(temporary, 'evidence/conformance/portability.json'), 'utf8'))
    expect((await verifyNativePortability(read, { requireNative: false })).result).toBe('PASS')
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
})

it('binds fresh source, destination and post-redemption snapshots to their exact outage intervals and RPC pages', async () => {
  const timing = path.join(directory, 'timing-binding')
  const manifest = JSON.parse(fs.readFileSync(path.join(timing, 'summary.json'), 'utf8'))
  const bytes = fs.readFileSync(path.join(timing, manifest.archive.path))
  assert.equal(bytes.length, manifest.archive.size); assert.equal(sha(bytes), manifest.archive.sha256)
  const files = new Map<string, string>()
  for (const item of JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString()).files) {
    const bytes = Buffer.from(item.content); assert.equal(bytes.length, item.size); assert.equal(sha(bytes), item.sha256)
    assert.ok(!files.has(item.path)); files.set(item.path, item.content)
  }
  for (const run of manifest.finalRuns) {
    const report = JSON.parse(files.get(`${run.directory}/portability.json`)!)
    expect(report.readWindows).toBeDefined(); expect(report.outage.restorationStartedAt).toBeDefined()
    expect((await verifyNativePortability(report, { requireNative: false })).result).toBe('PASS')
    const mutations: Array<(report: any) => void> = [
      r => { r.readWindows.destinationAfter.startedAt = r.outage.endedAt; r.readWindows.destinationAfter.endedAt = new Date(Date.parse(r.outage.endedAt) + 1000).toISOString() },
      r => { r.readWindows.destinationAfter.startedAt = r.coldReload.at },
      r => { r.readWindows.destinationAfter.storageStart = r.readWindows.destination.storageStart },
      r => { r.readWindows.destination.storageEnd = r.readWindows.destinationAfter.storageEnd },
      r => { r.readWindows.destinationAfter.storageEnd-- },
      r => { r.readWindows.source.endedAt = r.outage.endedAt },
      r => { r.outage.restorationStartedAt = r.coldReload.at },
      r => { r.storage.at(-1).request[0].fromStorageIdentityKey = r.counterparts.source.storageIdentityKey }
    ]
    for (const mutate of mutations) {
      const changed = structuredClone(report); mutate(changed)
      await expect(verifyNativePortability(changed, { requireNative: false })).rejects.toThrow('Independent portability predicate differs')
    }
    const missingWindows = structuredClone(report); missingWindows.mode = 'native-ui'; delete missingWindows.readWindows
    await expect(verifyNativePortability(missingWindows)).rejects.toThrow('portability.complete-logical-dataset')
  }
})

it('stops only the source listener, routes large prospective RPCs, and retires the owned counterpart', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-portability-service-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>service ownership fixture</title>')
  const source = new ControlledWalletServices({ webroot: directory })
  const target = source.createStorageCounterpart(directory, '12'.repeat(32))
  let adopted = false, closed = false
  try {
    await source.start(); await target.start()
    for (const endpoint of ['https://example.com/', 'http://192.0.2.1:80/', 'http://127.0.0.1:80/path']) expect(() => source.registerStorageCounterpart('replacement-wallet.itcve.test', endpoint)).toThrow('isolated loopback')
    expect(() => source.registerStorageCounterpart('replacement-wallet.itcve.test', target.storageUrl, source)).toThrow('ownership')
    source.registerStorageCounterpart('replacement-wallet.itcve.test', target.storageUrl, target)
    adopted = true
    expect(Object.keys(source.storageCounterpartIdentities)).toEqual(['replacement-wallet.itcve.test'])
    await source.setStorageEndpointAvailable(false)
    await expect(fetch(source.storageUrl)).rejects.toThrow()
    expect((await fetch(target.storageUrl)).status).toBeGreaterThanOrEqual(200)
    await source.setStorageEndpointAvailable(true)
    expect((await fetch(source.storageUrl)).status).toBeGreaterThanOrEqual(200)
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'processSyncChunk', params: [], padding: 'a'.repeat(128_000) })
    const proxy = new URL(source.proxyUrl)
    await new Promise<void>((resolve, reject) => {
      const request = http.request({ hostname: proxy.hostname, port: proxy.port, path: 'http://replacement-wallet.itcve.test/', method: 'POST', headers: { host: 'replacement-wallet.itcve.test', 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, response => { response.resume(); response.on('end', resolve) })
      request.on('error', reject); request.end(body)
    })
    expect(source.storageRpcObservations.at(-1)).toMatchObject({ host: 'replacement-wallet.itcve.test', method: 'processSyncChunk', completed: true })
    const endpoint = target.storageUrl
    await source.close()
    closed = true
    await expect(fetch(endpoint)).rejects.toThrow()
  } finally { if (!closed) await source.close(); if (!adopted) await target.close(); fs.rmSync(directory, { recursive: true, force: true }) }
}, 30_000)
