import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'
import { createFixtureWallet } from '../src/storage-sync/fixture-wallet.js'
import { EvidenceBundle } from '../src/wallet-lab/evidence.js'
import { readNativeReserveStorage, verifyNativeReserveStorage } from '../src/wallet-lab/native/conformance-reserve-storage.js'

const languages = process.env.TPNIL_TEST_GO_RESERVES === '1' ? ['typescript', 'go'] as const : ['typescript'] as const
for (const storage of languages) it(`binds ${storage} reserve snapshot to native-public auth, signed RPC and complete owner rows`, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-reserve-storage-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>Storage snapshot reference</title>')
  const services = new ControlledWalletServices({ webroot: directory, components: { storage }, ...(storage === 'go' ? { go: { binary: path.resolve(import.meta.dirname, '../../out/itcve-go-storage-sync'), storageSyncPatch: true, terminalRejectionReceipts: true } } : {}) })
  let wallet: Awaited<ReturnType<typeof createFixtureWallet>> | undefined
  try {
    await services.start()
    const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../fixtures/teranode/wab-funding-v1.json'), 'utf8'))
    await services.fundRemoteWalletFromTeranode('77'.repeat(32), fixture)
    wallet = await createFixtureWallet(services, '88'.repeat(32))
    const identity = (await wallet.getPublicKey({ identityKey: true })).publicKey
    const sender = new ProtoWallet(PrivateKey.fromHex('22'.repeat(32)))
    const senderIdentityKey = (await sender.getPublicKey({ identityKey: true })).publicKey
    const derivationPrefix = Buffer.from('tpnil-conformance-reserves').toString('base64'), derivationSuffix = Buffer.from('snapshot-reference').toString('base64')
    const publicKey = (await wallet.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${derivationPrefix} ${derivationSuffix}`, counterparty: senderIdentityKey, forSelf: true })).publicKey
    const payment = await services.payNativeWallet(publicKey, 10000)
    await wallet.internalizeAction({ tx: payment.tx, outputs: [{ outputIndex: 0, protocol: 'wallet payment', paymentRemittance: { derivationPrefix, derivationSuffix, senderIdentityKey } }], description: 'Authenticated storage reserve snapshot' })
    const publicOnly = new Proxy(wallet, { get(target, name) { if (name === 'listOutputs') return () => { throw new Error('Native default basket is admin-only') }; const value = (target as any)[name]; return typeof value === 'function' ? value.bind(target) : value } })
    const report = await readNativeReserveStorage(publicOnly, services)
    const evidence = new EvidenceBundle(directory); evidence.addJson('reserve-storage.json', report); evidence.flush()
    const flattened = JSON.parse(fs.readFileSync(path.join(directory, 'evidence/reserve-storage.json'), 'utf8'))
    if (process.env.TPNIL_RESERVE_STORAGE_EVIDENCE) { const target = path.resolve(process.env.TPNIL_RESERVE_STORAGE_EVIDENCE); fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, `${storage}-raw.json`), JSON.stringify(flattened, null, 2) + '\n') }
    const outputs = await verifyNativeReserveStorage(flattened, identity)
    const paymentOutput = outputs.find(row => row.txid === payment.txid && row.vout === 0)
    expect(paymentOutput).toMatchObject({ satoshis: 10000, spendable: true }); expect(paymentOutput.spentBy).toBeUndefined()
    expect(report.storage.every((row: any) => ['makeAvailable', 'getSyncChunk'].includes(row.method))).toBe(true)
    const mutations: Array<(r: any) => void> = [
      r => { r.identity = senderIdentityKey },
      r => { r.settings.storageIdentityKey = senderIdentityKey },
      r => { r.storage.pop() },
      r => { r.authTrace.find((row: any) => row.method === 'createSignature').result.signature[10] ^= 1 },
      r => { r.authTrace.filter((row: any) => row.method === 'verifySignature').at(-1).args.signature[10] ^= 1 },
      r => { r.dataset.outputs[0].spendable = false },
      r => { const row = r.storage.find((row: any) => row.method === 'getSyncChunk'); row.request[0].offsets[0].offset = 1 },
      r => { const row = r.storage.find((row: any) => row.method === 'getSyncChunk'); row.response.outputs[0].satoshis = 1; row.canonicalResponse.outputs[0].satoshis = 1; r.dataset.outputs[0].satoshis = 1 },
      r => { r.authTrace[0].endedAt = new Date(Date.parse(r.endedAt) + 1).toISOString() }
    ]
    for (const mutate of mutations) { const copy = structuredClone(flattened); mutate(copy); await expect(verifyNativeReserveStorage(copy, identity)).rejects.toThrow() }
    if (process.env.TPNIL_RESERVE_STORAGE_EVIDENCE) {
      const target = path.resolve(process.env.TPNIL_RESERVE_STORAGE_EVIDENCE); fs.mkdirSync(target, { recursive: true })
      fs.writeFileSync(path.join(target, `${storage}.json`), JSON.stringify({ claim: 'REFERENCE_ENGINEERING_ONLY', report: flattened, payment, verifiedOutput: paymentOutput, tamperCasesRejected: mutations.length }, null, 2) + '\n')
    }
  } finally { await wallet?.destroy(); await services.close(); fs.rmSync(directory, { recursive: true, force: true }) }
}, 60000)
