// SPDX-License-Identifier: Apache-2.0
import { createCipheriv, createHash } from 'node:crypto'
import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import { describe, expect, it } from 'vitest'
import { clauseContract, clauseCoverageGaps, clauseCrypto, semanticClauseIds } from '../src/wallet-lab/native/conformance-clauses-model.js'
import { deriveClauseOutcomes, verifyNativeClauseConformance } from '../src/wallet-lab/native/verify-conformance-clauses.js'

// Oracle mutation fixtures only. Crypto uses real independent fixture wallets;
// namespace and metadata observations are synthetic, never native qualification.
async function fixture(): Promise<any> {
  const wallet = new ProtoWallet(PrivateKey.fromHex('62'.repeat(32)))
  const peer = new ProtoWallet(PrivateKey.fromHex(clauseCrypto.peerKey))
  const identity = (await wallet.getPublicKey({ identityKey: true })).publicKey
  const counterparty = (await peer.getPublicKey({ identityKey: true })).publicKey
  const context = { protocolID: clauseCrypto.protocolID, keyID: clauseCrypto.keyID, counterparty }
  const alternate = { ...context, keyID: `${context.keyID} alternate` }
  const trace: any[] = []
  const call = async (id: string, method: string, args: any) => {
    const row: any = { id, method, args: structuredClone(args) }; trace.push(row)
    try { row.result = await (wallet as any)[method](args) }
    catch (error) { row.error = { message: String(error) } }
    return row
  }
  await call('crypto.brc42.self-child', 'getPublicKey', { ...context, forSelf: true })
  await call('crypto.brc42.peer-child', 'getPublicKey', { ...context, forSelf: false })
  await call('crypto.brc42.context-separation', 'getPublicKey', { ...alternate, forSelf: true })
  const encrypted = await call('crypto.aes.peer-decrypt', 'encrypt', { ...context, plaintext: clauseCrypto.data })
  const key = Buffer.from(peer.keyDeriver!.deriveSymmetricKey(context.protocolID, context.keyID, identity).toArray('be', 32))
  const iv = Buffer.alloc(32, 23), cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = [...Buffer.concat([iv, cipher.update(Buffer.from(clauseCrypto.data)), cipher.final(), cipher.getAuthTag()])]
  await call('crypto.aes.independent-encrypt', 'decrypt', { ...context, ciphertext })
  const damaged = [...encrypted.result.ciphertext]; damaged[damaged.length - 1]! ^= 1
  await call('crypto.aes.tamper-rejected', 'decrypt', { ...context, ciphertext: damaged })
  await call('crypto.aes.wrong-key-rejected', 'decrypt', { ...alternate, ciphertext: encrypted.result.ciphertext })
  const mac = await call('crypto.hmac.independent', 'createHmac', { ...context, data: clauseCrypto.data })
  await call('crypto.hmac.wrong-context-rejected', 'verifyHmac', { ...alternate, data: clauseCrypto.data, hmac: mac.result.hmac })
  await call('crypto.ecdsa.direct-hash', 'createSignature', { ...context, hashToDirectlySign: [...createHash('sha256').update(Buffer.from(clauseCrypto.data)).digest()] })
  const signature = (await peer.createSignature({ ...context, counterparty: identity, data: clauseCrypto.data })).signature
  await call('crypto.ecdsa.peer-signature', 'verifySignature', { ...context, data: clauseCrypto.data, signature, forSelf: false })
  for (const [suffix, protocol] of Object.entries({ 'double-space': 'tpnil  clauses', suffix: 'tpnil clause protocol', reserved: 'p tpnil clauses', uppercase: 'TPNIL clauses' })) {
    trace.push({ id: `namespace.protocol.${suffix}`, method: 'getPublicKey', args: { ...context, protocolID: [0, protocol] }, error: { message: 'Invalid protocol ID' } })
  }
  for (const [suffix, basket] of Object.entries({ default: 'default', admin: 'admin tpnil', reserved: 'p tpnil clauses' })) {
    trace.push({ id: `namespace.basket.${suffix}`, method: 'listOutputs', args: { basket }, error: { message: 'Invalid basket name' } })
  }
  const metadataTxid = '34'.repeat(32)
  const outputs = [0, 1, 2].map(index => ({ satoshis: 2 + index, lockingScript: '51', basket: 'tpnil native metadata', tags: ['clause', `row${index}`], customInstructions: `metadata:${index}`, outputDescription: `TPNIL metadata output ${index}` }))
  trace.push({ id: 'setup.metadata', method: 'createAction', args: { description: 'TPNIL native clause metadata', outputs, labels: ['tpnil-clause-metadata'], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } }, result: { txid: metadataTxid } })
  const listed = outputs.map((output, i) => ({ ...output, outpoint: `${metadataTxid}.${i}`, spendable: true }))
  trace.push({ id: 'metadata.tags-instructions', method: 'listOutputs', args: { basket: 'tpnil native metadata', includeTags: true, includeCustomInstructions: true, include: 'locking scripts', limit: 100 }, result: { totalOutputs: 3, outputs: listed } })
  trace.push({ id: 'metadata.labels-outputs', method: 'listActions', args: { labels: ['tpnil-clause-metadata'], includeLabels: true, includeOutputs: true, includeOutputLockingScripts: true, limit: 100 }, result: { totalActions: 1, actions: [{ txid: metadataTxid, labels: ['tpnil-clause-metadata'], description: 'TPNIL native clause metadata', outputs: outputs.map((output, outputIndex) => ({ ...output, outputIndex, spendable: true })) }] } })
  trace.push({ id: 'metadata.pagination', method: 'listOutputs', args: { basket: 'tpnil native metadata', tags: ['clause'], tagQueryMode: 'all', limit: 1, offset: 1, includeCustomInstructions: true }, result: { totalOutputs: 3, outputs: [structuredClone(listed[1])] } })
  const report: any = { schema: 'tpnil-native-brc100-clauses@2.0.0', claim: 'ENGINEERING_OBSERVATION_ONLY', substrate: 'reference-toolbox-public-api', source: clauseContract.source, identity, positives: [], trace, cleanup: [], coverageGaps: clauseCoverageGaps, completeBRC100Conformance: false, metadataTxid }
  report.assertions = await deriveClauseOutcomes(report)
  report.result = 'FAIL' // Input/output corpus intentionally absent in this narrow oracle fixture.
  return report
}

const row = (report: any, id: string) => report.trace.find((r: any) => r.id === id)
const outcome = (report: any[], id: string) => report.find(r => r.id === id)?.result
type Mutation = { name: string; id: string; mutate: (report: any) => void }
const mutations: Mutation[] = [
  { name: 'a renamed public method', id: 'crypto.brc42.self-child', mutate: r => { row(r, 'crypto.brc42.self-child').method = 'getVersion' } },
  { name: 'an unbound protocol', id: 'crypto.brc42.self-child', mutate: r => { row(r, 'crypto.brc42.self-child').args.protocolID[1] = 'other protocol' } },
  { name: 'an unbound peer', id: 'crypto.brc42.peer-child', mutate: r => { row(r, 'crypto.brc42.peer-child').args.counterparty = r.identity } },
  { name: 'inverted forSelf', id: 'crypto.brc42.peer-child', mutate: r => { row(r, 'crypto.brc42.peer-child').args.forSelf = true } },
  { name: 'context separation without changed key', id: 'crypto.brc42.context-separation', mutate: r => { row(r, 'crypto.brc42.context-separation').args.keyID = clauseCrypto.keyID } },
  { name: 'wrong native encryption plaintext', id: 'crypto.aes.peer-decrypt', mutate: r => { row(r, 'crypto.aes.peer-decrypt').args.plaintext = [1] } },
  { name: 'wrong independent input ciphertext', id: 'crypto.aes.independent-encrypt', mutate: r => { row(r, 'crypto.aes.independent-encrypt').args.ciphertext[1] ^= 1 } },
  { name: 'arbitrary invalid ciphertext as tamper evidence', id: 'crypto.aes.tamper-rejected', mutate: r => { row(r, 'crypto.aes.tamper-rejected').args.ciphertext = [0] } },
  { name: 'undamaged ciphertext as tamper evidence', id: 'crypto.aes.tamper-rejected', mutate: r => { row(r, 'crypto.aes.tamper-rejected').args.ciphertext = [...row(r, 'crypto.aes.peer-decrypt').result.ciphertext] } },
  { name: 'tampering before successful native encryption', id: 'crypto.aes.tamper-rejected', mutate: r => { const a = r.trace.indexOf(row(r, 'crypto.aes.tamper-rejected')), b = r.trace.indexOf(row(r, 'crypto.aes.peer-decrypt')); [r.trace[a], r.trace[b]] = [r.trace[b], r.trace[a]] } },
  { name: 'missing successful encryption reused as negative', id: 'crypto.aes.wrong-key-rejected', mutate: r => { delete row(r, 'crypto.aes.peer-decrypt').result } },
  { name: 'the original key in a wrong-key case', id: 'crypto.aes.wrong-key-rejected', mutate: r => { row(r, 'crypto.aes.wrong-key-rejected').args.keyID = clauseCrypto.keyID } },
  { name: 'permission denial substituted for AES rejection', id: 'crypto.aes.wrong-key-rejected', mutate: r => { row(r, 'crypto.aes.wrong-key-rejected').error = { message: 'Permission denied during decrypt' } } },
  { name: 'a transport timeout as cryptographic rejection', id: 'crypto.aes.tamper-rejected', mutate: r => { row(r, 'crypto.aes.tamper-rejected').error = { message: 'Decrypt timed out' } } },
  { name: 'valid false in place of an AES error', id: 'crypto.aes.tamper-rejected', mutate: r => { const v = row(r, 'crypto.aes.tamper-rejected'); delete v.error; v.result = { valid: false } } },
  { name: 'wrong HMAC message', id: 'crypto.hmac.independent', mutate: r => { row(r, 'crypto.hmac.independent').args.data = [0] } },
  { name: 'an arbitrary invalid MAC as wrong-context evidence', id: 'crypto.hmac.wrong-context-rejected', mutate: r => { row(r, 'crypto.hmac.wrong-context-rejected').args.hmac = Array(32).fill(0) } },
  { name: 'the original context in a wrong-HMAC-context case', id: 'crypto.hmac.wrong-context-rejected', mutate: r => { row(r, 'crypto.hmac.wrong-context-rejected').args.keyID = clauseCrypto.keyID } },
  { name: 'extra data in a direct-hash signing call', id: 'crypto.ecdsa.direct-hash', mutate: r => { row(r, 'crypto.ecdsa.direct-hash').args.data = clauseCrypto.data } },
  { name: 'a mismatched peer signature message', id: 'crypto.ecdsa.peer-signature', mutate: r => { row(r, 'crypto.ecdsa.peer-signature').args.data = [0] } },
  { name: 'a self signature labeled as peer verification', id: 'crypto.ecdsa.peer-signature', mutate: r => { row(r, 'crypto.ecdsa.peer-signature').args.forSelf = true } },
  { name: 'a valid protocol substituted into a forbidden-name case', id: 'namespace.protocol.uppercase', mutate: r => { row(r, 'namespace.protocol.uppercase').args.protocolID[1] = 'tpnil clauses' } },
  { name: 'a different forbidden protocol borrowed from another case', id: 'namespace.protocol.suffix', mutate: r => { row(r, 'namespace.protocol.suffix').args.protocolID[1] = 'p tpnil clauses' } },
  { name: 'a valid basket substituted into a reserved-name case', id: 'namespace.basket.reserved', mutate: r => { row(r, 'namespace.basket.reserved').args.basket = 'tpnil valid basket' } },
  { name: 'a namespace method mismatch', id: 'namespace.basket.default', mutate: r => { row(r, 'namespace.basket.default').method = 'createAction' } },
  { name: 'a different metadata basket', id: 'metadata.tags-instructions', mutate: r => { row(r, 'metadata.tags-instructions').args.basket = 'other basket' } },
  { name: 'unrequested output metadata', id: 'metadata.tags-instructions', mutate: r => { row(r, 'metadata.tags-instructions').args.includeCustomInstructions = false } },
  { name: 'a fabricated metadata transaction identity', id: 'metadata.tags-instructions', mutate: r => { row(r, 'setup.metadata').result.txid = '99'.repeat(32) } },
  { name: 'changed requested metadata', id: 'metadata.tags-instructions', mutate: r => { row(r, 'setup.metadata').args.outputs[0].customInstructions = 'different' } },
  { name: 'an unconstrained labels query', id: 'metadata.labels-outputs', mutate: r => { row(r, 'metadata.labels-outputs').args.labels = [] } },
  { name: 'an altered action output description', id: 'metadata.labels-outputs', mutate: r => { row(r, 'metadata.labels-outputs').result.actions[0].outputs[0].outputDescription = 'different description' } },
  { name: 'altered action output tags', id: 'metadata.labels-outputs', mutate: r => { row(r, 'metadata.labels-outputs').result.actions[0].outputs[0].tags = [] } },
  { name: 'a second action hidden by find', id: 'metadata.labels-outputs', mutate: r => { const v = row(r, 'metadata.labels-outputs').result; v.actions.push(structuredClone(v.actions[0])); v.totalActions++ } },
  { name: 'an unexecuted pagination offset', id: 'metadata.pagination', mutate: r => { row(r, 'metadata.pagination').args.offset = 0 } },
  { name: 'pagination with altered instructions', id: 'metadata.pagination', mutate: r => { row(r, 'metadata.pagination').result.outputs[0].customInstructions = 'other' } }
]

describe('native clause semantic oracle bindings', () => {
  it('independently validates real peer cryptography and complete synthetic metadata controls', async () => {
    const report = await fixture()
    for (const id of semanticClauseIds.filter(id => /^(crypto|namespace|metadata)\./.test(id))) expect(outcome(report.assertions, id), id).toBe('PASS')
    expect((await verifyNativeClauseConformance(report)).result).toBe('FAIL')
  })

  it('permits wallet-added labels and omitted optional listActions custom instructions', async () => {
    const report = await fixture()
    const action = row(report, 'metadata.labels-outputs').result.actions[0]
    action.labels.push('reference wallet-generated-id')
    for (const output of action.outputs) delete output.customInstructions
    expect(outcome(await deriveClauseOutcomes(report), 'metadata.labels-outputs')).toBe('PASS')
  })

  for (const mutation of mutations) it(`rejects ${mutation.name}`, async () => {
    const report = await fixture()
    expect(outcome(report.assertions, mutation.id)).toBe('PASS')
    mutation.mutate(report)
    expect(outcome(await deriveClauseOutcomes(report), mutation.id)).toBe('FAIL')
    await expect(verifyNativeClauseConformance(report)).rejects.toThrow()
  })

  it('retains a genuine cryptographic failure as FAIL after honest recomputation', async () => {
    const report = await fixture()
    row(report, 'crypto.aes.independent-encrypt').result.plaintext = [0]
    report.assertions = await deriveClauseOutcomes(report)
    expect(outcome(report.assertions, 'crypto.aes.independent-encrypt')).toBe('FAIL')
    expect((await verifyNativeClauseConformance(report)).result).toBe('FAIL')
  })
})
