import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
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
