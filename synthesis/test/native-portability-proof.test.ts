import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { Beef, Transaction, UnlockingScript } from '@bsv/sdk'
import { expect, it } from 'vitest'
import { verifyPortableProofClosure } from '../src/wallet-lab/native/portability-proof.js'
import { verifyNativePortability } from '../src/wallet-lab/native/verify-conformance-portability.js'

const archive = path.resolve(import.meta.dirname, '../../journals/integrated-native-attempts/2026-11-09/42680240116/native-integrated.zip')
expect(createHash('sha256').update(fs.readFileSync(archive)).digest('hex')).toBe('264ba858b5618574c3aea189425d22c5cbb47c91a1ae361b618609cc17d38e49')
const read = (rep: number) => JSON.parse(execFileSync('unzip', ['-p', archive, `repetition-${rep}/evidence/conformance/portability.json`], { maxBuffer: 16 * 1024 * 1024 }).toString())
for (const repetition of [1, 2]) it(`verifies retained native${repetition} dataset-only proof closure without promoting its failed cold operation`, async () => {
  const report = read(repetition)
  for (const copy of [report.source, report.destination]) {
    expect(copy.provenTxs).toHaveLength(0)
    expect((await verifyPortableProofClosure(copy)).verifiedTxids).toHaveLength(12)
  }
  expect(report.result).toBe('FAIL')
  await expect(verifyNativePortability(report)).rejects.toThrow('portability.complete-logical-dataset')
})

it('rejects missing or corrupt ancestry, signed bytes and owner bindings without an external BEEF seed', async () => {
  const original = read(1).source
  const mutations: Array<(r: any) => void> = [
    r => { for (const row of [...r.transactions, ...r.provenTxReqs]) row.inputBEEF = [] },
    r => { for (const row of r.provenTxReqs) if (row.inputBEEF?.length > 10) row.inputBEEF = [0, 1, 2] },
    r => { const row = r.provenTxReqs.find((row: any) => row.rawTx?.length); row.rawTx[0] ^= 1 },
    r => { const row = r.provenTxReqs.find((row: any) => row.inputBEEF?.length > 10); const beef = Beef.fromBinary(row.inputBEEF); beef.bumps[0]!.blockHeight++; row.inputBEEF = beef.toBinary() },
    r => { const row = r.provenTxReqs.find((row: any) => row.inputBEEF?.length > 10); const beef = Beef.fromBinary(row.inputBEEF); beef.bumps[0]!.path[0]![0]!.hash = '00'.repeat(32); row.inputBEEF = beef.toBinary() },
    r => { r.provenTxReqs[0].rawTx = [] },
    r => { r.transactions.push({ txid: '00'.repeat(32) }) },
    r => { const row = r.provenTxReqs.find((row: any) => row.rawTx?.length); const tx = Transaction.fromBinary(row.rawTx); tx.inputs[0]!.unlockingScript = UnlockingScript.fromHex('00'); row.rawTx = tx.toBinary(); const old = row.txid; row.txid = tx.id('hex'); for (const owner of r.transactions) if (owner.txid === old) owner.txid = row.txid }
  ]
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(original); mutate(changed)
    let rejected = false
    try { await verifyPortableProofClosure(changed) } catch { rejected = true }
    expect(rejected, `mutation ${index}`).toBe(true)
  }
})

const engineeringRoot = path.resolve(import.meta.dirname, '../../journals/native-portability-reference/2026-11-09/ancestry-closure-v2')
const engineeringSummary = JSON.parse(fs.readFileSync(path.join(engineeringRoot, 'summary.json'), 'utf8'))
const engineeringBytes = fs.readFileSync(path.join(engineeringRoot, engineeringSummary.archive.path))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
expect(engineeringBytes.length).toBe(engineeringSummary.archive.size)
expect(hash(engineeringBytes)).toBe(engineeringSummary.archive.sha256)
const engineeringFiles = new Map<string, string>()
for (const file of JSON.parse(gunzipSync(engineeringBytes, { maxOutputLength: 64 * 1024 * 1024 }).toString()).files) {
  const bytes = Buffer.from(file.content)
  expect(bytes.length).toBe(file.size); expect(hash(bytes)).toBe(file.sha256)
  expect(engineeringFiles.has(file.path)).toBe(false); engineeringFiles.set(file.path, file.content)
}
for (const run of engineeringSummary.finalRuns) it(`replays final ${run.implementation} source-off portability reference under oracle2`, async () => {
  const report = JSON.parse(engineeringFiles.get(`${run.directory}/portability.json`)!)
  expect(report.schema).toBe('tpnil-native-storage-portability@2')
  expect(report.oracle).toBe('tpnil-native-portability-oracle@2.0.0')
  const result = await verifyNativePortability(report, { requireNative: false })
  expect(result.result).toBe('PASS'); expect(result.assertions).toHaveLength(9)
  await expect(verifyNativePortability(report)).rejects.toThrow('Reference recreation cannot qualify native portability')
})
