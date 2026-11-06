import { expect, it } from 'vitest'
import { verifyHostReceipt } from '../src/wallet-lab/native/verify.js'
const baseline = { image: 'sha256:fixture', networkMode: 'none', privileged: false, readonly: true, init: true, pidMode: '', capDrop: ['ALL'], capAdd: null, user: '1001:1001', mounts: [{ type: 'bind', destination: '/evidence' }], networks: { none: {} } }
it('accepts only the isolated non-root native host contract', () => {
  expect(() => verifyHostReceipt(baseline, baseline.image)).not.toThrow()
  for (const patch of [
    { networkMode: 'host' }, { privileged: true }, { readonly: false }, { init: false }, { pidMode: 'host' },
    { capDrop: [] }, { capAdd: ['NET_ADMIN'] }, { user: '0:0' }, { image: 'sha256:unadmitted' },
    { networks: { bridge: {} } }, { mounts: [{ type: 'bind', destination: '/var/run/docker.sock' }] }
  ]) expect(() => verifyHostReceipt({ ...baseline, ...patch }, baseline.image)).toThrow()
})

it('replays the retained native qualification and rejects corrupted independent evidence', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const { createHash } = await import('node:crypto')
  const { Transaction } = await import('@bsv/sdk')
  const { verifyNativeWallet } = await import('../src/wallet-lab/native/verify.js')
  const original = path.resolve(import.meta.dirname, '../../journals/native-wallet-qualification/2026-11-06/yours-wallet-5.1.0-all-go')
  const result = await verifyNativeWallet(original)
  expect(result.qualifiedEnvironment).toBe(true)
  expect(result.outcome).toBe('FAIL')
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
  const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))
  const write = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
  // Rebind the record's content digests so these cases reach the independent
  // protocol oracle instead of stopping at the evidence-file integrity check.
  const revise = (directory: string, name: string, mutate: (value: any) => void) => {
    const repetition = path.join(directory, 'repetition-1')
    const target = path.join(repetition, 'evidence', name)
    const value = read(target); mutate(value); write(target, value)
    const bytes = fs.readFileSync(target), recordFile = path.join(repetition, 'record.json'), record = read(recordFile)
    Object.assign(record.evidence.find((item: { name: string }) => item.name === name), { sha256: sha(bytes), size: bytes.length })
    write(recordFile, record)
    const workerFile = path.join(repetition, 'worker.json'), worker = read(workerFile)
    worker.recordSha256 = sha(fs.readFileSync(recordFile)); write(workerFile, worker)
  }
  for (const mutate of [
    (directory: string) => { const file = path.join(directory, 'host-repetition-1-after.json'), value = read(file); value.state.Running = true; write(file, value) },
    (directory: string) => revise(directory, 'native-transactions.json', rows => {
      const row = rows.find((item: { txid: string }) => item.txid === result.repetitions[0]!.independent.redemption)
      const tx = Transaction.fromHex(row.rawTxHex)
      tx.outputs[0]!.satoshis!++
      row.rawTxHex = tx.toHex(); row.txid = tx.id('hex')
    }),
    (directory: string) => revise(directory, 'mined-funding-source.json', value => { value.fixture.blockHeaderHex = '00' + value.fixture.blockHeaderHex.slice(2) })
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-native-negative-'))
    try { fs.cpSync(original, directory, { recursive: true }); mutate(directory); await expect(verifyNativeWallet(directory)).rejects.toThrow() }
    finally { fs.rmSync(directory, { recursive: true, force: true }) }
  }
})
