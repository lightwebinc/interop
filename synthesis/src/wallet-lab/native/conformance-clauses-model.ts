import fs from 'node:fs'
import path from 'node:path'
import { PublicKey } from '@bsv/sdk'
import { noSendChangeOutputId } from './conformance-nosend-change.js'

export type Shape = { kind: string; name?: string; value?: unknown; fields?: Record<string, Shape>; item?: Shape; items?: Shape[]; variants?: Shape[]; key?: Shape; optional?: boolean; line?: number }
export const clauseContract = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../../programs/ISI-4/profiles/native-conformance-2.0.0/brc100-contract.json'), 'utf8')) as { source: unknown; methods: Record<string, { line: number; input: Shape; output: Shape }> }
export const clauseCrypto = { protocolID: [0, 'tpnil native clauses'] as [0, string], keyID: 'native clause key', data: [...Buffer.from('TPNIL independent primitive check\u0000é')], peerKey: '61'.repeat(32) }
export const clauseOracleId = 'tpnil-brc100-clause-oracle@3.0.0'
const bytes = (v: unknown): boolean => (Array.isArray(v) || v instanceof Uint8Array) && [...v].every(n => Number.isInteger(n) && n >= 0 && n <= 255)
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const stringLength = (v: unknown, min: number, max: number) => typeof v === 'string' && Buffer.byteLength(v, 'utf8') >= min && Buffer.byteLength(v, 'utf8') <= max
export function validAlias(name: string, v: any): boolean {
  switch (name) {
    case 'BooleanDefaultFalse': case 'BooleanDefaultTrue': return typeof v === 'boolean'
    case 'Byte': return integer(v, 0, 255)
    case 'PositiveIntegerOrZero': return integer(v, 0, 0xffffffff)
    case 'PositiveInteger': return integer(v, 1, 0xffffffff)
    case 'PositiveIntegerMax10': return integer(v, 1, 10)
    case 'PositiveIntegerDefault10Max10000': return integer(v, 1, 10000)
    case 'SatoshiValue': return integer(v, 1, 2100000000000000)
    case 'BEEF': case 'AtomicBEEF': return bytes(v)
    case 'HexString': return typeof v === 'string' && /^(?:[0-9a-fA-F]{2})*$/.test(v)
    case 'TXIDHexString': return typeof v === 'string' && /^[0-9a-fA-F]{64}$/.test(v)
    case 'OutpointString': return typeof v === 'string' && /^[0-9a-fA-F]{64}\.(?:0|[1-9][0-9]*)$/.test(v) && integer(Number(v.split('.')[1]), 0, 0xffffffff)
    case 'PubKeyHex': try { return typeof v === 'string' && /^(02|03)[0-9a-fA-F]{64}$/.test(v) && BigInt(`0x${v.slice(2)}`) < BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f') && PublicKey.fromString(v).validate() } catch { return false }
    case 'Base64String': return typeof v === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)
    case 'ISOTimestampString': return typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v))
    case 'DescriptionString5to50Characters': return stringLength(v, 5, 50)
    case 'ActionDescriptionString5to2000Characters': return stringLength(v, 5, 2000)
    case 'KeyIDStringUnder800Characters': return stringLength(v, 1, 800)
    case 'ProtocolString5To400Characters': return stringLength(v, 5, typeof v === 'string' && v.startsWith('specific linkage revelation ') ? 430 : 400) && /^[a-z0-9 ]+$/.test(v) && !/  | protocol$|^p /.test(v)
    case 'BasketStringUnder300Characters': return typeof v === 'string' && stringLength(v.trim().toLowerCase(), 0, 300)
    case 'OutputTagStringUnder300Characters': case 'LabelStringUnder300Characters': return typeof v === 'string' && stringLength(v.trim().toLowerCase(), 0, 300)
    case 'CertificateFieldNameUnder50Characters': return stringLength(v, 0, 50)
    case 'EntityNameStringMax100Characters': return stringLength(v, 0, 100)
    case 'EntityIconURLStringMax500Characters': return stringLength(v, 0, 500)
    case 'VersionString7To30Characters': return stringLength(v, 7, 30) && /^.+-\d+\.\d+\.\d+$/.test(v)
    default: throw Error(`Unregistered standard alias ${name}`)
  }
}
/** Independent contract checks. Optional means absent, never an arbitrary malformed value. */
export function conforms(shape: Shape, value: any): boolean {
  if (value === undefined && shape.optional) return true
  switch (shape.kind) {
    case 'alias': return validAlias(shape.name!, value)
    case 'string': case 'boolean': return typeof value === shape.kind
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'literal': return value === shape.value
    case 'union': return shape.variants!.some(s => conforms(s, value))
    case 'array': return (Array.isArray(value) || value instanceof Uint8Array) && [...value].every(v => conforms(shape.item!, v))
    case 'tuple': return Array.isArray(value) && value.length === shape.items!.length && shape.items!.every((s, i) => conforms(s, value[i]))
    case 'record': return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([k, v]) => conforms(shape.key!, shape.key!.name?.startsWith('PositiveInteger') ? Number(k) : k) && conforms(shape.value as Shape, v))
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.entries(shape.fields!).every(([k, s]) => conforms(s, value[k]))
    default: throw Error(`Unregistered shape ${shape.kind}`)
  }
}
export interface InvalidClause { id: string; method: string; path: (string | number)[]; line: number; invalid: unknown; token: string }
export const invalidClauses: InvalidClause[] = []
function visit(method: string, shape: Shape, parts: (string | number)[], line: number) {
  if (shape.kind === 'object') { for (const [key, field] of Object.entries(shape.fields!)) visit(method, field, [...parts, key], field.line ?? line); return }
  if (shape.kind === 'array') { visit(method, shape.item!, [...parts, 0], line); return }
  if (shape.kind === 'tuple') { shape.items!.forEach((s, i) => visit(method, s, [...parts, i], line)); return }
  // One explicit wrong-type/range fixture per leaf; separate semantic fixtures test namespace and crypto rules.
  let invalid: unknown = null
  if (shape.kind === 'alias' && /PositiveInteger|SatoshiValue|Byte/.test(shape.name!)) invalid = -1
  if (shape.kind === 'alias' && /Description/.test(shape.name!)) invalid = 'x'
  if (shape.kind === 'alias' && /Hex|Outpoint|Base64/.test(shape.name!)) invalid = '!invalid!'
  if (shape.kind === 'alias' && shape.name === 'ProtocolString5To400Characters') invalid = 'x'
  if (shape.kind === 'alias' && shape.name === 'KeyIDStringUnder800Characters') invalid = ''
  const token = [...parts].reverse().find(p => typeof p === 'string' && p !== 'fixture') as string
  invalidClauses.push({ id: `input.${method}.${parts.join('.')}`, method, path: parts, line, invalid, token })
}
for (const [method, contract] of Object.entries(clauseContract.methods)) visit(method, contract.input, [], contract.line)
export const semanticClauseIds = [
  'crypto.brc42.self-child', 'crypto.brc42.peer-child', 'crypto.brc42.context-separation',
  'crypto.aes.peer-decrypt', 'crypto.aes.independent-encrypt', 'crypto.aes.tamper-rejected', 'crypto.aes.wrong-key-rejected',
  'crypto.hmac.independent', 'crypto.hmac.wrong-context-rejected', 'crypto.ecdsa.direct-hash', 'crypto.ecdsa.peer-signature',
  'namespace.protocol.double-space', 'namespace.protocol.suffix', 'namespace.protocol.reserved', 'namespace.protocol.uppercase',
  'namespace.basket.default', 'namespace.basket.admin', 'namespace.basket.reserved',
  'metadata.tags-instructions', 'metadata.labels-outputs', 'metadata.pagination',
  'errors.structured', 'coverage.remaining-obligations'
]
export const clauseAssertionIds = [...Object.keys(clauseContract.methods).map(m => `output.${m}`), ...invalidClauses.map(c => c.id), ...semanticClauseIds]
export const clauseOracle4AssertionIds = [...clauseAssertionIds, noSendChangeOutputId]
export const clauseCoverageGaps = [
  { id: 'privileged-secondary-keyring', sourceLines: [322, 324], reason: 'Optional privileged mode requires artifact-specific admission and a distinct supported user-presence fixture; normal-key execution does not prove it.' },
  { id: 'all-permission-categories', sourceLines: [326, 326], reason: 'The native permission scenario proves real protocol approval, denial and origin isolation; basket, spending, certificate and linkage revocation/expiry policies require additional category-specific UI scenarios.' },
  { id: 'abi-substrate', sourceLines: [1524, 2506], reason: 'The admitted native substrate is window.CWI injection. This artifact does not expose a laboratory-admitted BRC100 byte-wire endpoint; a client-side encoder would test the adapter rather than a native endpoint.' },
  { id: 'basket-length-interpretation', sourceLines: [518, 356], reason: 'The interface alias limits baskets to300 bytes while namespace prose permits400. This profile tests the unambiguous common subset and does not qualify301–400.' },
  { id: 'optional-transaction-and-certificate-paths', sourceLines: [630, 1428], reason: 'The input/output contract corpus does not prove every batching, default, pagination, certificate issuance and conflicting-parameter combination. Coverage remains explicit until corresponding native stateful fixtures execute.' }
]
export const clauseOracle4CoverageGaps = clauseCoverageGaps.map(gap => gap.id === 'all-permission-categories' ? { ...gap, reason: 'Supported basket, certificate, one-shot spending and visible revocation cases have separately frozen mandatory scenarios in this profile. Additional linkage semantics and finite-expiry admission remain separate obligations; no private permission-state mutation is permitted.' } : { ...gap })
export function specifiedError(error: any, token?: string, includeRequired = true): boolean {
  if (!error || error.name === 'TypeError' || typeof error.message !== 'string' || /timed? ?out|timeout|unsupported|not implemented|not yet implemented|network|fetch failed|closed|detached|context.*destroyed|target.*closed|connection|insufficient funds|unique constraint|permission denied|permission required|not authori[sz]ed|unauthorized/i.test(error.message)) return false
  if (includeRequired && /cannot read (?:properties|property)|cannot (?:convert|set|destructure).*?(?:null|undefined)|(?:object null|undefined|null).*?not iterable|is not a function/i.test(error.message)) return false
  if (!token) return /invalid|incorrect|authenticat|permission|not valid|must|parameter|cannot|failed|malformed|ciphertext|decrypt|signature|hmac/i.test(error.message) || includeRequired && /required/i.test(error.message)
  const normalized = error.message.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized.includes(token.toLowerCase().replace(/[^a-z0-9]/g, ''))
}
