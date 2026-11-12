import { createDecipheriv } from 'node:crypto'
import { Certificate, MasterCertificate, PrivateKey, ProtoWallet, SymmetricKey, Utils } from '@bsv/sdk'
import { expect, it } from 'vitest'
import { issueFixtureCertificateForSubject } from '../src/wallet-lab/certificate-fixture.js'

const issuer = new ProtoWallet(PrivateKey.fromHex('36'.repeat(32))), subject = new ProtoWallet(PrivateKey.fromHex('79'.repeat(32)))
const subjectIdentity = (await subject.getPublicKey({ identityKey: true })).publicKey
const type = Buffer.alloc(32, 17).toString('base64'), serial = Buffer.alloc(32, 18).toString('base64')
const revocation = async () => `${'00'.repeat(32)}.0`

it('preserves a deterministic leading-zero field key through issuance and selective public disclosure', async () => {
  const raw = Uint8Array.from([0, ...Array(31).fill(17)])
  expect(new SymmetricKey([...raw]).toArray().length).toBe(31) // Original issuer's exact failure trigger.
  const cert = await issueFixtureCertificateForSubject(issuer, subjectIdentity, { name: 'TPNIL valid zero-prefix fixture', private: 'hidden' }, type, revocation, serial, () => raw)
  expect(await cert.verify()).toBe(true)
  const keyring = await MasterCertificate.createKeyringForVerifier(subject, cert.certifier, 'anyone', cert.fields, ['name'], cert.masterKeyring, serial)
  expect(Object.keys(keyring)).toEqual(['name'])
  const anyone = new ProtoWallet('anyone')
  const revealed = await anyone.decrypt({ ciphertext: Utils.toArray(keyring.name!, 'base64'), ...Certificate.getCertificateFieldEncryptionDetails('name', serial), counterparty: subjectIdentity })
  expect(revealed.plaintext).toEqual([...raw]); expect(revealed.plaintext).toHaveLength(32)
  // Independent AES-GCM confirms that the preserved bytes encrypt the signed field.
  const encrypted = Buffer.from(cert.fields.name!, 'base64'), decrypt = createDecipheriv('aes-256-gcm', Buffer.from(revealed.plaintext), encrypted.subarray(0, 32))
  decrypt.setAuthTag(encrypted.subarray(-16))
  expect(Buffer.concat([decrypt.update(encrypted.subarray(32, -16)), decrypt.final()]).toString()).toBe('TPNIL valid zero-prefix fixture')
})

it('rejects an incorrectly sized fixture key rather than retrying or changing its distribution', async () => {
  for (const length of [0, 31, 33]) await expect(issueFixtureCertificateForSubject(issuer, subjectIdentity, { name: 'fixture' }, type, revocation, serial, () => new Uint8Array(length))).rejects.toThrow(/exactly 32/)
})
