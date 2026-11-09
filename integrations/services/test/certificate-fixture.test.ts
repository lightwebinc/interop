import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Certificate, ProtoWallet, Utils, VerifiableCertificate } from '@bsv/sdk'
import { PrivateKey as LegacyPrivateKey, ProtoWallet as LegacyProtoWallet } from '../../../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js'
import { issueFixtureCertificateForSubject } from '../../../synthesis/src/wallet-lab/certificate-fixture.ts'
import { ControlledWalletServices } from '../../../synthesis/src/wallet-lab/services.ts'
import { createFixtureWallet } from '../../../synthesis/src/storage-sync/fixture-wallet.ts'

test('zero-prefix fixture passes actual Toolbox 2.13 public certificate operations and strict SDK4 disclosure', { timeout: 30_000 }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-certificate-zero-prefix-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>Certificate fixture regression</title>')
  const services = new ControlledWalletServices({ webroot: directory })
  let wallet: Awaited<ReturnType<typeof createFixtureWallet>> | undefined
  try {
    await services.start(); wallet = await createFixtureWallet(services, '79'.repeat(32))
    const identity = (await wallet.getPublicKey({ identityKey: true })).publicKey
    const rawKey = Uint8Array.from([0, ...Array(31).fill(17)])
    const certificate = await issueFixtureCertificateForSubject(new LegacyProtoWallet(LegacyPrivateKey.fromHex('36'.repeat(32))), identity,
      { name: 'TPNIL zero-prefix identity', private: 'Unrevealed fixture' }, Buffer.alloc(32, 17).toString('base64'), async () => `${'00'.repeat(32)}.0`, Buffer.alloc(32, 18).toString('base64'), () => rawKey)
    await wallet.acquireCertificate({ ...certificate, signature: certificate.signature!, acquisitionProtocol: 'direct', keyringRevealer: 'certifier', keyringForSubject: certificate.masterKeyring })
    const anyone = new ProtoWallet('anyone'), verifier = (await anyone.getPublicKey({ identityKey: true })).publicKey
    const proof = await wallet.proveCertificate({ certificate: { type: certificate.type, serialNumber: certificate.serialNumber, certifier: certificate.certifier }, fieldsToReveal: ['name'], verifier })
    assert.deepEqual(Object.keys(proof.keyringForVerifier), ['name'])
    const revealed = await anyone.decrypt({ ciphertext: Utils.toArray(proof.keyringForVerifier.name!, 'base64'), ...Certificate.getCertificateFieldEncryptionDetails('name', certificate.serialNumber), counterparty: identity })
    assert.deepEqual(revealed.plaintext, [...rawKey]); assert.equal(revealed.plaintext.length, 32)
    const strict = VerifiableCertificate.fromCertificate(certificate as any, proof.keyringForVerifier)
    assert.equal(await strict.verify(), true)
    assert.deepEqual(Object.entries(await strict.decryptFields(anyone)), [['name', 'TPNIL zero-prefix identity']])
  } finally {
    await wallet?.destroy(); await services.close(); fs.rmSync(directory, { recursive: true, force: true })
  }
})
