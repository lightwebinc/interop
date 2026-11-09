import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { canonicalJson } from '../../determinism.js'
import { aggregateOutcome, type VectorResult } from '../model.js'
import { verifyNativePermissionConformance } from './verify-conformance-permissions.js'
import { verifyConformanceLifecycle } from './verify-conformance-lifecycle.js'
import { verifyNativePortability } from './verify-conformance-portability.js'
import { verifyNativeClauseConformance } from './verify-conformance-clauses.js'
import { validateComponentIdentity } from '../go-services.js'

export async function verifyNativeConformance(evidenceDirectory: string, baselineVectors: VectorResult[]) {
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'conformance', `${name}.json`), 'utf8'))
  const report = read('result')
  assert.equal(report.schema, 'tpnil-native-conformance@2.0.0'); assert.equal(report.profile, 'ITCVE-1@1.4.0'); assert.equal(report.program, 'ISI-4@2.0.0')
  assert.deepEqual(read('baseline-vectors'), baselineVectors, 'Original ToDo observations were altered by the prospective scenario')
  const integrated = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'integrated/result.json'), 'utf8'))
  assert.equal(typeof integrated.walletIdentity, 'string', 'Native conformance requires the joined wallet identity')
  const permission = verifyNativePermissionConformance(read('permissions'), name => fs.readFileSync(path.join(evidenceDirectory, name)), integrated.walletIdentity)
  const lifecycle = await verifyConformanceLifecycle(read('lifecycle'))
  assert.equal(read('lifecycle').schema, 'tpnil-native-conformance-lifecycle@2')
  assert.deepEqual(read('lifecycle').serviceIdentity, JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'service-components.json'), 'utf8')))
  const portability = await verifyNativePortability(read('portability'))
  assert.equal(read('clauses').substrate, 'unchanged-native-window.CWI', 'Reference clauses cannot qualify a native wallet')
  const clauses = await verifyNativeClauseConformance(read('clauses'), JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'integrated/boundary.json'), 'utf8')))
  const identities = read('service-counterparts')
  assert.deepEqual(Object.keys(identities), ['replacement-wallet.itcve.test'])
  for (const identity of Object.values(identities) as Record<string, unknown>[]) validateComponentIdentity(identity, 'ITCVE-1@1.4.0')
  const baseline = baselineVectors.map(vector => ({ id: vector.id, outcome: vector.outcome, assertions: vector.assertions.map(row => ({ id: row.id, outcome: row.outcome })) }))
  const actual = report.vectors.map((vector: any) => ({ id: vector.id, outcome: vector.outcome, assertions: vector.assertions.map((row: any) => ({ id: row.id, outcome: row.outcome })) }))
  assert.deepEqual(actual.slice(0, 4), baseline.slice(0, 4))
  const verified = [permission, lifecycle, portability, clauses]
  for (const [offset, item] of verified.entries()) {
    const expected = item.assertions.map((row: any) => ({ id: offset === 1 ? `public-api/${row.id}` : row.id, outcome: row.result }))
    if (offset === 1) expected.unshift(...baseline[5]!.assertions)
    const outcome = expected.some((row: any) => row.outcome === 'FAIL') ? 'FAIL' : expected.some((row: any) => row.outcome === 'BLOCKED') ? 'BLOCKED' : expected.length > 0 && expected.every((row: any) => row.outcome === 'PASS') ? 'PASS' : 'INCONCLUSIVE'
    assert.deepEqual(actual[offset + 4], { id: `ISI-4-V00${offset + 5}`, outcome, assertions: expected })
  }
  assert.equal(report.outcome, aggregateOutcome(report.vectors))
  for (const name of ['lifecycle', 'portability', 'clauses']) assert.equal(read(name).identity, integrated.walletIdentity, `${name} belongs to the joined native wallet`)
  assert.deepEqual(read('portability').components.replacement, identities['replacement-wallet.itcve.test'])
  // All vectors retain their evidence references and raw per-predicate outcomes.
  for (const vector of report.vectors) for (const assertion of vector.assertions) {
    assert.ok(Array.isArray(assertion.evidence) && assertion.evidence.length > 0)
    for (const name of assertion.evidence) { assert.match(name, /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/); assert.ok(!name.includes('..')); assert.ok(fs.statSync(path.join(evidenceDirectory, name)).isFile()) }
  }
  return { verified: true, outcome: report.outcome, vectors: report.vectors, semanticProjection: canonicalJson(actual) }
}
