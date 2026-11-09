// Read-only clause outcome inventory; original evidence is never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from '../../synthesis/node_modules/tsx/dist/esm/api/index.mjs';
register();
const repository = path.resolve(import.meta.dirname, '../..');
const frozen = path.join(repository, 'out/frozen-native-source-c338a93');
const { clauseContract, invalidClauses, conforms } = await import(path.join(frozen, 'synthesis/src/wallet-lab/native/conformance-clauses-model.ts'));
const { verifyNativeClauseConformance } = await import(path.join(frozen, 'synthesis/src/wallet-lab/native/verify-conformance-clauses.ts'));
const { verifyNoSendChangeFixture } = await import(path.join(frozen, 'synthesis/src/wallet-lab/native/verify-conformance-nosend-change.ts'));
const { canonicalJson } = await import(path.join(frozen, 'synthesis/src/determinism.ts'));
const sha = data => createHash('sha256').update(data).digest('hex');
const entries = [];
function category(assertion, trace) {
  if (assertion.result === 'BLOCKED') return assertion.id === 'coverage.remaining-obligations' ? 'remaining-coverage-obligations' : 'positive-control-or-fixture-unavailable';
  if (assertion.id === 'output.createAction.noSendChange-final-outpoints') return 'returned-noSendChange-does-not-match-final-signed-transaction';
  if (assertion.id === 'errors.structured') return 'public-error-structure-missing';
  if (assertion.id.startsWith('namespace.')) return 'reserved-or-uppercase-namespace-not-rejected';
  if (assertion.id.startsWith('output.')) return 'output-contract-shape-or-alias';
  if (trace && trace.result !== undefined) return 'malformed-input-accepted';
  const message = trace?.error?.message ?? '';
  if (/network error 500/.test(message)) return 'public-storage-rpc-500';
  if (/not implemented|not yet implemented/i.test(message)) return 'not-implemented';
  if (/cannot read (?:properties|property)|cannot (?:convert|set|destructure).*?(?:null|undefined)|(?:object null|undefined|null).*?not iterable|is not a function/i.test(message)) return 'wrapped-javascript-exception';
  return 'other-specified-rejection-mismatch';
}
function violations(shape, value, location = [], result = []) {
  if (conforms(shape, value)) return result;
  if (shape.kind === 'object' && value !== null && typeof value === 'object') for (const [name, child] of Object.entries(shape.fields)) violations(child, value[name], [...location, name], result);
  else if (shape.kind === 'array' && Array.isArray(value)) value.forEach((item, index) => violations(shape.item, item, [...location, index], result));
  else result.push({ path: location, contractKind: shape.kind, alias: shape.name, standardLine: shape.line, observedValue: typeof value === 'number' || typeof value === 'string' || value == null ? value : undefined });
  return result;
}
for (const repetition of [1, 2]) {
  const prefix = `out/native-ci-42711700295/repetition-${repetition}/evidence`;
  const file = `${prefix}/conformance/clauses.json`, bytes = fs.readFileSync(path.join(repository, file)), report = JSON.parse(bytes);
  const boundary = JSON.parse(fs.readFileSync(path.join(repository, prefix, 'integrated/boundary.json')));
  const verified = await verifyNativeClauseConformance(report, boundary);
  const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(result => [result, report.assertions.filter(row => row.result === result).length]));
  const ref = row => { const index = report.trace.indexOf(row); return { id: row.id, method: row.method, pointer: `/trace/${index}`, resultPresent: row.result !== undefined, error: row.error ?? null, recordSha256: sha(canonicalJson(row)) }; };
  const nonPassing = report.assertions.filter(row => row.result !== 'PASS').map(assertion => {
    const row = report.trace.find(row => row.id === assertion.id), spec = invalidClauses.find(row => row.id === assertion.id);
    const method = row?.method ?? (assertion.id.startsWith('output.') ? assertion.id.split('.')[1] : null);
    const relevant = row ? [row] : assertion.id === 'output.createAction.noSendChange-final-outpoints' ? report.trace.filter(row => ['setup.input.createAction.options.noSendChange.0', 'setup.noSendChange.public-actions'].includes(row.id)) : assertion.id === 'errors.structured' ? report.trace.filter(row => row.error && !row.id.startsWith('cleanup.') && (row.error.status !== 'error' || typeof row.error.code !== 'string' || row.error.code.length < 10 || row.error.code.length > 40 || typeof row.error.description !== 'string' || Buffer.byteLength(row.error.description) < 20 || Buffer.byteLength(row.error.description) > 200)) : [];
    const control = row?.controlId ? report.trace.find(other => other.id === row.controlId) : undefined;
    const result = { id: assertion.id, result: assertion.result, category: category(assertion, row), detail: assertion.detail, assertionPointer: `/assertions/${report.assertions.indexOf(assertion)}`, method, standardLine: spec?.line ?? clauseContract.methods[method]?.line ?? (assertion.id === 'errors.structured' ? 288 : undefined), fieldPath: spec?.path, traceReferences: relevant.map(ref), positiveControl: control ? ref(control) : row?.controlId ? { id: row.controlId, missing: true } : null };
    if (assertion.id.startsWith('output.') && clauseContract.methods[method]) {
      const index = report.positives.findIndex(item => item.method === method), positive = report.positives[index];
      result.positiveReferences = (positive?.observations ?? []).map((item, observation) => ({ pointer: `/positives/${index}/observations/${observation}`, recordSha256: sha(canonicalJson(item)), violations: violations(clauseContract.methods[method].output, item.result) })).filter(item => item.violations.length);
    }
    return result;
  });
  let noSendChange;
  try { const item = await verifyNoSendChangeFixture(report); noSendChange = { verifiedFixture: true, signedTxid: item.txid, rawTransactionSha256: sha(Buffer.from(item.rawHex, 'hex')), finalOutpoints: item.outpoints, returnedOutpoints: item.returned, inputPredicate: report.assertions.find(row => row.id === 'input.createAction.options.noSendChange.0'), outputPredicate: report.assertions.find(row => row.id === 'output.createAction.noSendChange-final-outpoints') }; }
  catch (error) { noSendChange = { verifiedFixture: false, error: String(error) }; }
  const categories = Object.fromEntries([...new Set(nonPassing.filter(row => row.result === 'FAIL').map(row => row.category))].map(category => [category, nonPassing.filter(row => row.result === 'FAIL' && row.category === category).length]));
  entries.push({ repetition, evidence: { path: file, bytes: bytes.length, sha256: sha(bytes) }, oracle: report.oracle, verifiedResult: verified.result, counts, executedPredicateDenominator: report.assertions.length, source: report.source, categories, nonPassing, failedPositiveControls: report.trace.filter(row => row.id.startsWith('control.') && (row.error !== undefined || row.result === undefined)).map(ref), noSendChange, broaderCoverageObligations: report.coverageGaps, coverageAccounting: 'coverage.remaining-obligations is one BLOCKED predicate in the executed denominator; its five broader obligations are separate coverage limits, not five additional executed predicates.', interpretation: 'These are observations under the pinned contract and oracle. Public CWI results alone do not identify a faulty internal layer. Public-storage-rpc-500 identifies the reported transport boundary, not independently the upstream cause. Namespace and alias findings retain their contract interpretation limits.' });
}
const projection = row => row.nonPassing.map(({id,result,category}) => ({id,result,category}));
assert.deepEqual(projection(entries[0]), projection(entries[1]), 'Per-predicate nonpassing outcome/category differs across repetitions');
assert.deepEqual(entries[0].counts, entries[1].counts);
assert.deepEqual(entries[0].broaderCoverageObligations, entries[1].broaderCoverageObligations);
const report = { schema: 'tpnil-native-clause-findings-independent-review@1', claim: 'PINNED_CONTRACT_FINDINGS_NOT_COMPLETE_BRC100_QUALIFICATION', run: '42711700295', source: 'c338a93c97ffebeeef318e679ff82b7dbf309dd5', reviewedAt: new Date().toISOString(), scriptSha256: sha(fs.readFileSync(import.meta.filename)), repeatedOutcomeAndCategoryAgreement: true, repetitions: entries };
fs.writeFileSync(path.join(import.meta.dirname, 'clauses-findings.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ repeatedOutcomeAndCategoryAgreement: true, repetitions: entries.map(({repetition,counts,categories,executedPredicateDenominator,failedPositiveControls,broaderCoverageObligations}) => ({ repetition, counts, categories, executedPredicateDenominator, failedPositiveControlIds: failedPositiveControls.map(row=>row.id), broaderCoverageObligationIds: broaderCoverageObligations.map(row=>row.id) })) }));
