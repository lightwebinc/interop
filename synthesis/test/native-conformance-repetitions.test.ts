import { expect, it } from 'vitest'
import { canonicalJson } from '../src/determinism.js'
import { clauseAssertionIds } from '../src/wallet-lab/native/conformance-clauses-model.js'
import { verifyConformanceRepetitionAgreement } from '../src/wallet-lab/native/verify.js'

// LAB_SELF_TEST_ONLY: controlled projections isolate the publication comparison.
// Actual child verification still determines every outcome before this join.
const fixture = () => [
  ...[3, 3, 1, 1, 8, 6, 9].map((count, vector) => ({
    id: `ISI-4-V00${vector + 1}`, outcome: 'PASS',
    assertions: Array.from({ length: count }, (_, index) => ({ id: `fixture-${vector}-${index}`, outcome: 'PASS' }))
  })),
  { id: 'ISI-4-V008', outcome: 'FAIL', assertions: clauseAssertionIds.map(id => ({
    id, outcome: id === 'output.listActions' ? 'FAIL' : id === 'coverage.remaining-obligations' ? 'BLOCKED' : 'PASS'
  })) }
]
const counts = (vectors: ReturnType<typeof fixture>) => vectors.flatMap(vector => vector.assertions).reduce<Record<string, number>>((result, row) => {
  result[row.outcome] = (result[row.outcome] ?? 0) + 1; return result
}, {})

it('accepts two matching complete 263-assertion conformance projections', () => {
  const first = fixture(), second = structuredClone(first)
  expect(first.flatMap(vector => vector.assertions)).toHaveLength(263)
  expect(() => verifyConformanceRepetitionAgreement([canonicalJson(first), canonicalJson(second)])).not.toThrow()
})

it('rejects two changed clause outcomes despite identical vector outcomes and PASS/FAIL/BLOCKED counts', () => {
  const first = fixture(), second = structuredClone(first)
  const clauses = second[7]!.assertions
  clauses.find(row => row.id === 'output.createAction')!.outcome = 'FAIL'
  clauses.find(row => row.id === 'output.listActions')!.outcome = 'PASS'
  expect(second.map(vector => vector.outcome)).toEqual(first.map(vector => vector.outcome))
  expect(counts(second)).toEqual(counts(first))
  expect(() => verifyConformanceRepetitionAgreement([canonicalJson(first), canonicalJson(second)])).toThrow('per-assertion identities or outcomes')
})

it('rejects an omitted repetition or a rebound assertion identity', () => {
  const first = fixture(), second = structuredClone(first)
  expect(() => verifyConformanceRepetitionAgreement([canonicalJson(first)])).toThrow('two independently verified')
  second[7]!.assertions[0]!.id = 'unrelated-clause'
  expect(counts(second)).toEqual(counts(first))
  expect(() => verifyConformanceRepetitionAgreement([canonicalJson(first), canonicalJson(second)])).toThrow('per-assertion identities or outcomes')
})
