import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from '../../synthesis/node_modules/tsx/dist/esm/api/index.mjs';
register();
const root = path.resolve(import.meta.dirname, '../..');
const sourceRoot = path.join(root, 'out/frozen-native-source-cc3cf756');
const { verifyNativePortability } = await import(path.join(sourceRoot, 'synthesis/src/wallet-lab/native/verify-conformance-portability.ts'));
const { verifyPortableProofClosure } = await import(path.join(sourceRoot, 'synthesis/src/wallet-lab/native/portability-proof.ts'));
const pack = path.join(root, 'out/native-ci-42697283161');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const patchBytes = fs.readFileSync(path.join(sourceRoot, 'infra/adapters/storage-portability/patch.lock.json'));
const patch = JSON.parse(patchBytes);
const review = { schema: 'tpnil-native-portability-independent-review@2', runId: 42697283161,
  sourceRevision: 'cc3cf756272b8d3826612d71e8f6356239fed6fa', oracleSource: 'out/frozen-native-source-cc3cf756 exact git archive', claim: 'INDEPENDENT_NATIVE_EVIDENCE_REVIEW', repetitions: [] };
for (const repetition of [1, 2]) {
  const file = path.join(pack, `repetition-${repetition}/evidence/conformance/portability.json`);
  if (!fs.existsSync(file)) { review.repetitions.push({ repetition, result: 'MISSING', path: path.relative(root, file) }); continue; }
  const bytes = fs.readFileSync(file), report = JSON.parse(bytes);
  const item = { repetition, evidence: { path: path.relative(root, file), bytes: bytes.length, sha256: hash(bytes) }, schema: report.schema,
    oracle: report.oracle, producerResult: report.result, assertions: report.assertions, ui: report.ui?.map(row => ({ stage: row.stage, at: row.at, text: row.text })),
    counterparts: report.counterparts, components: report.components, coldReload: report.coldReload, outage: report.outage,
    readWindows: report.readWindows, redemptionCompletion: report.redemptionCompletion, redemptionPolls: report.redemptionObservations?.map(row => ({name: row.name, ready: row.ready, capturedAt: row.capturedAt, txid: row.txid, receiptCount: row.processActionReceipts?.length})), outpoint: report.outpoint, redemption: report.redemption, error: report.error, cleanup: report.cleanup };
  try {
    assert.equal(report.schema, 'tpnil-native-storage-portability@3');
    assert.equal(report.oracle, 'tpnil-native-portability-oracle@3.0.0');
    item.independent = await verifyNativePortability(report);
    item.proofs = [];
    for (const name of ['source', 'destination', 'destinationAfter']) {
      assert.ok(report[name], `Missing ${name} dataset`);
      const closure = await verifyPortableProofClosure(report[name]);
      item.proofs.push({ dataset: name, counts: Object.fromEntries(Object.entries(report[name]).filter(([, value]) => Array.isArray(value)).map(([name, value]) => [name, value.length])),
        verifiedTxids: closure.verifiedTxids, transactionsInClosure: closure.beef.txs.length, bumps: closure.beef.bumps.length });
    }
    const sourceIdentity = report.components?.source, replacementIdentity = report.components?.replacement;
    for (const component of [sourceIdentity, replacementIdentity]) {
      assert.ok(component, 'Missing admitted component identity');
      const manifest = component.go.compatibilityPatch;
      assert.equal(manifest.schema, 'tpnil-storage-portability-go-build@1.0.0');
      assert.equal(manifest.patchLockSha256, hash(patchBytes));
      assert.equal(manifest.patchSha256, patch.patchSha256);
      assert.equal(manifest.parentPatchLockSha256, patch.parentSha256);
      assert.equal(component.go.fixtureSubmissionPolicy, 'terminal-rejection-v1');
    }
    assert.notEqual(report.counterparts.source.storageIdentityKey, report.counterparts.destination.storageIdentityKey);
    item.result = item.independent.result;
  } catch (error) { item.result = 'FAIL'; item.independentError = String(error); }
  review.repetitions.push(item);
}
review.result = review.repetitions.length === 2 && review.repetitions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(import.meta.dirname, 'portability.json'), JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify({ result: review.result, repetitions: review.repetitions.map(row => ({ repetition: row.repetition, result: row.result, producerResult: row.producerResult, error: row.independentError, assertions: row.independent?.assertions })) }));
