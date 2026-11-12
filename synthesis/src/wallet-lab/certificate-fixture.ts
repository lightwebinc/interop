import { randomBytes } from 'node:crypto'
import { Certificate, MasterCertificate, ProtoWallet, SymmetricKey, Utils } from '@bsv/sdk'

/** External fixture issuer, separate from every wallet under evaluation.
 * BRC-52 field revelation keys are exactly 32 bytes, including leading zeros.
 * SDK 2.7.1's issuance helper converts keys through a minimal-width BigNumber;
 * using the original random byte array avoids that invalid positive fixture.
 * The optional key source permits deterministic zero-prefix regression tests.
 */
export async function issueFixtureCertificateForSubject(
  issuer: ProtoWallet,
  subject: string,
  fields: Record<string, string>,
  type: string,
  getRevocationOutpoint: (serial: string) => Promise<string>,
  serialNumber: string,
  fieldKeySource: () => Uint8Array = () => randomBytes(32)
): Promise<MasterCertificate> {
  const certificateFields: Record<string, string> = {}, masterKeyring: Record<string, string> = {}
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    const rawKey = fieldKeySource()
    if (!(rawKey instanceof Uint8Array) || rawKey.length !== 32) throw new Error('Fixture certificate field keys must be exactly 32 bytes')
    const keyBytes = [...rawKey]
    certificateFields[fieldName] = Utils.toBase64(new SymmetricKey(keyBytes).encrypt(Utils.toArray(fieldValue, 'utf8')) as number[])
    const wrapped = await issuer.encrypt({ plaintext: keyBytes, ...Certificate.getCertificateFieldEncryptionDetails(fieldName), counterparty: subject })
    masterKeyring[fieldName] = Utils.toBase64(wrapped.ciphertext)
  }
  const { publicKey: certifier } = await issuer.getPublicKey({ identityKey: true })
  const certificate = new MasterCertificate(type, serialNumber, subject, certifier, await getRevocationOutpoint(serialNumber), certificateFields, masterKeyring)
  await certificate.sign(issuer)
  return certificate
}
