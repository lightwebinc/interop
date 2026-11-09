import { describe, expect, it } from 'vitest'
import { PrivateKey } from '@bsv/sdk'
import { clauseAssertionIds, clauseContract, conforms, invalidClauses, validAlias } from '../src/wallet-lab/native/conformance-clauses-model.js'
import { deriveClauseOutcomes, verifyNativeClauseConformance } from '../src/wallet-lab/native/verify-conformance-clauses.js'

const id = 'input.createHmac.keyID'
function report() {
  const base = { data: [1, 2, 3], protocolID: [0, 'tpnil input oracle'], keyID: 'valid key', counterparty: 'self' }
  return { identity: PrivateKey.fromHex('73'.repeat(32)).toPublicKey().toString(), positives: [], trace: [
    { id: `control.${id}`, method: 'createHmac', args: structuredClone(base), result: { hmac: Array(32).fill(0) } },
    { id, method: 'createHmac', base, args: { ...base, keyID: '' }, controlId: `control.${id}`, error: { name: 'Error', message: 'keyID must contain at least one byte', code: 'ERR_INVALID_PARAMETER_VALUE', status: 'error', description: 'keyID must contain at least one byte' } }
  ] }
}
const outcome = async (r: any) => (await deriveClauseOutcomes(r)).find(a => a.id === id)!.result
describe('Native BRC100 independent input oracle', () => {
  it('freezes the exact method and unique assertion inventory', () => {
    expect(Object.keys(clauseContract.methods)).toHaveLength(28)
    expect(clauseAssertionIds).toHaveLength(232)
    expect(new Set(clauseAssertionIds).size).toBe(232)
    expect(invalidClauses.every(c => c.line > 600)).toBe(true)
  })
  it('checks byte ranges, UTF8 limits, compressed points, numeric bounds and optional-field types', () => {
    expect(validAlias('Byte', 256)).toBe(false)
    expect(validAlias('PositiveIntegerOrZero', 0xffffffff + 1)).toBe(false)
    expect(validAlias('PositiveIntegerOrZero', 0.5)).toBe(false)
    expect(validAlias('DescriptionString5to50Characters', 'é'.repeat(26))).toBe(false)
    expect(validAlias('PubKeyHex', `02${'ff'.repeat(32)}`)).toBe(false)
    expect(validAlias('VersionString7To30Characters', 'wallet-brc100-1.0.0')).toBe(true)
    expect(validAlias('VersionString7To30Characters', '1.0.0')).toBe(false)
    expect(conforms({ kind: 'alias', name: 'BooleanDefaultTrue', optional: true }, undefined)).toBe(true)
    expect(conforms({ kind: 'alias', name: 'BooleanDefaultTrue', optional: true }, null)).toBe(false)
  })
  it('accepts a single invalid field only with a successful exact positive control', async () => expect(await outcome(report())).toBe('PASS'))
  it('rejects unrelated extra argument changes', async () => { const r = report(); r.trace[1]!.args!.data = [9]; expect(await outcome(r)).toBe('FAIL') })
  it('blocks stale or failing positive controls', async () => { const r: any = report(); delete r.trace[0].result; r.trace[0].error = { message: 'Certificate unavailable' }; expect(await outcome(r)).toBe('BLOCKED') })
  it('rejects network errors, timeouts and raw engine exceptions as specified rejections', async () => {
    for (const error of [{ message: 'Network fetch failed', name: 'Error' }, { message: 'Request timed out', name: 'Error' }, { message: 'Permission denied', name: 'Error' }, { message: 'Cannot read properties of null', name: 'TypeError' }]) { const r: any = report(); r.trace[1].error = error; expect(await outcome(r)).toBe('FAIL') }
  })
  it('rejects accepted malformed values and duplicate trace IDs', async () => {
    const accepted: any = report(); accepted.trace[1].result = { hmac: [] }; delete accepted.trace[1].error; expect(await outcome(accepted)).toBe('FAIL')
    const duplicated: any = report(); duplicated.trace.push(duplicated.trace[1]); expect(await outcome(duplicated)).toBe('FAIL')
  })
  it('does not accept a complete-conformance claim from a partial report', async () => {
    await expect(verifyNativeClauseConformance({ schema: 'tpnil-native-brc100-clauses@2.0.0', claim: 'EXPERIMENTAL_CONFORMANCE_RESULT' })).rejects.toThrow()
  })
})
