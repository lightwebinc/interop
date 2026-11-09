import assert from 'node:assert/strict'
import { PrivateKey, ProtoWallet, PublicKey, Signature, Transaction, Utils, type WalletInterface } from '@bsv/sdk'
import type { ControlledWalletServices } from '../services.js'
import { ObservedStorageClient, readDataset, type Transcript } from '../../storage-sync/run.js'
import { canonicalSyncChunk } from '../../storage-sync/compatibility.js'
import { entities, type Dataset } from '../../storage-sync/projection.js'

const provider = 'native-reserve-observer'
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const allowed = ['getPublicKey', 'createSignature', 'verifySignature', 'createHmac', 'verifyHmac']

/** Authenticate as the native identity through its public CWI. The observer only
 * invokes makeAvailable/getSyncChunk; no default-basket permission or native key
 * extraction is needed. The declared storage-service fixture key is not used by
 * the runner. It is used offline to verify the signed BRC-31 exchange. */
export async function readNativeReserveStorage(wallet: WalletInterface, services: ControlledWalletServices): Promise<any> {
  const report: any = { schema: 'tpnil-native-reserve-storage@1', startedAt: new Date().toISOString(),
    implementation: services.components.storage, endpoint: services.storageUrl, authTrace: [], storage: [] }
  const publicWallet = new Proxy(wallet, { get(target, name) {
    if (typeof name !== 'string' || typeof (target as any)[name] !== 'function') return (target as any)[name]
    return async (...args: any[]) => {
      assert.ok(allowed.includes(name), `Read-only storage observer requested forbidden wallet method: ${name}`)
      const row: any = { sequence: report.authTrace.length, method: name, args: clean(args[0]),
        originator: args[1] ?? null, startedAt: new Date().toISOString() }
      report.authTrace.push(row)
      try { const value = await (target as any)[name](...args); row.result = clean(value); return value }
      catch (error) { row.error = String(error); throw error }
      finally { row.endedAt = new Date().toISOString() }
    }
  } })
  report.identity = (await publicWallet.getPublicKey({ identityKey: true })).publicKey
  const reader = new ObservedStorageClient(publicWallet, services.storageUrl, provider, report.storage as Transcript[], services.components.storage)
  report.settings = await reader.makeAvailable()
  report.dataset = await readDataset(reader, report.identity)
  report.endedAt = new Date().toISOString()
  return clean(report)
}

function normalizeEntity(value: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(value).filter(([, value]) => value !== null).map(([key, value]) => {
    if (['created_at', 'updated_at'].includes(key)) return [key, new Date(value).toISOString()]
    if (['rawTx', 'inputBEEF', 'lockingScript', 'merklePath'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value)
      assert.ok(entries.every(([index, byte], i) => index === String(i) && Number.isInteger(byte) && Number(byte) >= 0 && Number(byte) <= 255))
      return [key, entries.map(([, byte]) => byte)]
    }
    return [key, value]
  }))
}
function normalizedChunk(chunk: any): any {
  const normalized = { ...chunk }
  for (const entity of entities) if (Array.isArray(normalized[entity])) normalized[entity] = normalized[entity].map(normalizeEntity)
  if (normalized.user) normalized.user = normalizeEntity(normalized.user)
  return normalized
}
function decodeWireJson(text: string): any {
  return JSON.parse(text, (_key, value) => {
    if (value?.$bsvBinary === 'base64' && Object.keys(value).length === 2) {
      assert.equal(typeof value.data, 'string'); const bytes = Buffer.from(value.data, 'base64'); assert.equal(bytes.toString('base64'), value.data)
      return [...bytes]
    }
    if (value?.$bsvBinary === 'escaped' && Object.keys(value).length === 2) return Object.fromEntries(value.entries)
    return value
  })
}
function textField(reader: InstanceType<typeof Utils.Reader>): string {
  const length = reader.readVarIntNum(); assert.ok(length >= -1 && length <= reader.bin.length - reader.pos)
  return length === -1 ? '' : Utils.toUTF8(reader.read(length))
}
function headers(reader: InstanceType<typeof Utils.Reader>): Record<string, string> {
  const count = reader.readVarIntNum(); assert.ok(count >= 0 && count < 32)
  const result: Record<string, string> = {}
  for (let i = 0; i < count; i++) { const name = textField(reader); assert.equal(result[name], undefined); result[name] = textField(reader) }
  return result
}

/** Independently bind complete pages to the actual signed request and response
 * payloads. The known public test-service key verifies native signatures without
 * knowing or exporting the native identity key. Return the reconstructed rows. */
export async function verifyNativeReserveStorage(report: any, identity: string): Promise<any[]> {
  assert.equal(report.schema, 'tpnil-native-reserve-storage@1'); assert.equal(report.identity, identity)
  assert.ok(['typescript', 'go'].includes(report.implementation))
  const time = (value: string) => { const n = Date.parse(value); assert.ok(Number.isFinite(n)); assert.equal(new Date(n).toISOString(), value); return n }
  const start = time(report.startedAt), end = time(report.endedAt); assert.ok(start <= end)
  const service = new ProtoWallet(PrivateKey.fromHex('11'.repeat(32)))
  const serviceIdentity = (await service.getPublicKey({ identityKey: true })).publicKey
  const storageIdentity = report.settings.storageIdentityKey
  assert.equal(typeof storageIdentity, 'string'); assert.ok(storageIdentity.length >= 64)
  const endpoint = new URL(report.endpoint); assert.equal(endpoint.protocol, 'http:'); assert.equal(endpoint.hostname, '127.0.0.1')
  const requests: any[] = [], responses: any[] = []
  let handshakes = 0
  assert.ok(report.authTrace.length > 0)
  for (const [index, row] of report.authTrace.entries()) {
    assert.equal(row.sequence, index); assert.ok(allowed.includes(row.method)); assert.equal(row.error, undefined)
    assert.ok(time(row.startedAt) >= start && time(row.endedAt) >= time(row.startedAt) && time(row.endedAt) <= end)
    if (row.method === 'getPublicKey' && row.args.identityKey === true) assert.equal(row.result.publicKey, identity)
    if (!['createSignature', 'verifySignature'].includes(row.method)) continue
    assert.deepEqual(row.args.protocolID, [2, 'auth message signature']); assert.equal(row.args.counterparty, serviceIdentity)
    const outgoing = row.method === 'createSignature'
    const key = await service.getPublicKey({ protocolID: row.args.protocolID, keyID: row.args.keyID, counterparty: identity, forSelf: !outgoing })
    assert.ok(PublicKey.fromString(key.publicKey).verify(row.args.data, Signature.fromDER(outgoing ? row.result.signature : row.args.signature)), 'Invalid authenticated storage signature')
    if (!outgoing) assert.equal(row.result.valid, true)
    // Session nonces contain 16 random bytes and a 32-byte HMAC. Bind the
    // handshake to its exact two nonce values, not a guessed payload length.
    const nonceParts = String(row.args.keyID).split(' ').map(part => [...Buffer.from(part, 'base64')])
    if (!outgoing && nonceParts.length === 2 && nonceParts.every(part => part.length === 48)) {
      assert.deepEqual(row.args.data, nonceParts.flat()); assert.equal(requests.length, 0); handshakes++; continue
    }
    const reader = new Utils.Reader(row.args.data), nonce = Utils.toBase64(reader.read(32))
    if (outgoing) {
      assert.equal(textField(reader), 'POST'); assert.equal(textField(reader), endpoint.pathname); assert.equal(textField(reader), endpoint.search)
      const signedHeaders = headers(reader); assert.equal(signedHeaders['content-type'], 'application/json')
      const body = decodeWireJson(textField(reader)); assert.ok(reader.eof()); requests.push({ nonce, body })
    } else {
      assert.equal(reader.readVarIntNum(), 200); headers(reader)
      const body = decodeWireJson(textField(reader)); assert.ok(reader.eof()); responses.push({ nonce, body })
    }
  }
  assert.deepEqual(report.authTrace[0].args, { identityKey: true }); assert.equal(report.authTrace[0].method, 'getPublicKey')
  assert.equal(handshakes, 1)
  assert.equal(requests.length, report.storage.length); assert.equal(responses.length, requests.length)
  assert.equal(new Set(requests.map(r => r.nonce)).size, requests.length)
  const result: Dataset = Object.fromEntries(entities.map(entity => [entity, []]))
  let pageCount = 0, complete = false, settingsCount = 0
  for (const [index, row] of report.storage.entries()) {
    assert.equal(row.provider, provider); assert.ok(['makeAvailable', 'getSyncChunk'].includes(row.method)); assert.equal(row.error, undefined)
    const request = requests[index], response = responses[index]
    assert.equal(request.nonce, response.nonce); assert.equal(request.body.jsonrpc, '2.0'); assert.equal(response.body.jsonrpc, '2.0')
    assert.equal(request.body.id, response.body.id); assert.equal(request.body.method, row.method); assert.deepEqual(request.body.params, row.request)
    assert.equal(response.body.error, undefined)
    assert.deepEqual(normalizedChunk(response.body.result), normalizedChunk(row.response), 'Captured RPC differs from signed service response')
    if (row.method === 'makeAvailable') { assert.equal(pageCount, 0); assert.deepEqual(normalizeEntity(row.response), normalizeEntity(report.settings)); settingsCount++; continue }
    assert.equal(complete, false); pageCount++
    const args = row.request[0], chunk: any = canonicalSyncChunk(row.response, report.implementation)
    assert.equal(args.identityKey, identity); assert.equal(chunk.userIdentityKey, identity)
    assert.equal(args.fromStorageIdentityKey, storageIdentity); assert.equal(args.toStorageIdentityKey, storageIdentity); assert.equal(chunk.fromStorageIdentityKey, storageIdentity)
    assert.equal(args.maxItems, 1000); assert.equal(args.maxRoughSize, 10_000_000)
    assert.deepEqual([...args.offsets.map((r: any) => r.name)].sort(), entities.map(e => e.slice(0, -1)).sort())
    assert.deepEqual(row.canonicalResponse, chunk)
    if (chunk.user) { const user = normalizeEntity(chunk.user); if (result.user) assert.deepEqual(result.user, user); result.user = user }
    for (const entity of entities) {
      assert.equal(args.offsets.find((r: any) => r.name === entity.slice(0, -1)).offset, result[entity]!.length)
      if (chunk[entity] !== undefined) { assert.ok(Array.isArray(chunk[entity])); result[entity]!.push(...chunk[entity].map(normalizeEntity)) }
    }
    complete = entities.every(entity => Array.isArray(chunk[entity]) && chunk[entity].length === 0)
  }
  assert.equal(settingsCount, 1); assert.ok(pageCount >= 2); assert.equal(complete, true, 'Snapshot must end with an empty page for every entity')
  assert.deepEqual(report.dataset, result); assert.equal(result.user?.identityKey, identity)
  for (const entity of entities) for (const row of result[entity]!) if (row.userId !== undefined) assert.equal(row.userId, result.user?.userId, 'Foreign owner in storage snapshot')
  // Proof-request notify subscriptions can include another wallet's transaction
  // in the same service. Preserve that signed global metadata verbatim; owner
  // foreign keys and the actual reserve bytes are verified independently below.
  const ids: Record<string, string> = { provenTxs: 'provenTxId', provenTxReqs: 'provenTxReqId', outputBaskets: 'basketId', txLabels: 'txLabelId', outputTags: 'outputTagId', transactions: 'transactionId', outputs: 'outputId', certificates: 'certificateId', commissions: 'commissionId' }
  const relations: Record<string, string> = { transactionId: 'transactions', provenTxId: 'provenTxs', basketId: 'outputBaskets', txLabelId: 'txLabels', outputTagId: 'outputTags', outputId: 'outputs', certificateId: 'certificates', spentBy: 'transactions' }
  const indexes = Object.fromEntries(Object.entries(ids).map(([entity, field]) => { const rows = (result as any)[entity]; const ids = new Set(rows.map((row: any) => row[field])); assert.equal(ids.size, rows.length); return [entity, ids] }))
  for (const entity of entities) for (const row of result[entity]!) for (const [field, target] of Object.entries(relations)) {
    if (field !== ids[entity] && row[field] !== undefined) assert.ok(indexes[target]!.has(row[field]), `Dangling ${entity}.${field} relationship`)
  }
  const transactions = new Map<string, Transaction>()
  for (const row of [...result.provenTxs!, ...result.provenTxReqs!, ...result.transactions!]) if (Array.isArray(row.rawTx) && row.rawTx.length) {
    const tx = Transaction.fromBinary(row.rawTx as number[]); assert.equal(tx.id('hex'), row.txid)
    if (transactions.has(String(row.txid))) assert.equal(transactions.get(String(row.txid))!.toHex(), tx.toHex())
    transactions.set(String(row.txid), tx)
  }
  for (const output of result.outputs!) {
    assert.equal(typeof output.spendable, 'boolean'); assert.ok(Number.isSafeInteger(output.vout))
    const parent = result.transactions!.find(row => row.transactionId === output.transactionId); assert.equal(parent?.txid, output.txid)
    const tx = transactions.get(String(output.txid)); assert.ok(tx, 'Reserve output transaction bytes absent')
    const rawOutput = tx.outputs[Number(output.vout)]; assert.ok(rawOutput); assert.equal(output.satoshis, rawOutput.satoshis)
    if (output.lockingScript !== undefined) assert.deepEqual(output.lockingScript, rawOutput.lockingScript.toBinary())
    if (output.scriptLength !== undefined) assert.equal(output.scriptLength, rawOutput.lockingScript.toBinary().length)
  }
  return result.outputs!
}
