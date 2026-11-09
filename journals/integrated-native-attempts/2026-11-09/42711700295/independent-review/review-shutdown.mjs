import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { register } from '../../synthesis/node_modules/tsx/dist/esm/api/index.mjs';
register();
const root = path.resolve(import.meta.dirname, '../..');
const source = path.join(root, 'out/frozen-native-source-c338a93');
const { Transaction } = await import(path.join(root, 'synthesis/node_modules/@bsv/sdk/dist/esm/mod.js'));
const { lifecyclePermissionConfig } = await import(path.join(source, 'synthesis/src/wallet-lab/native/conformance-permission-lifecycle-model.ts'));
const { verifyNativeShutdownSubmissions } = await import(path.join(source, 'synthesis/src/wallet-lab/native/verify-shutdown-submissions.ts'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { schema: 'tpnil-native-shutdown-independent-review@1', runId: 42711700295, source: 'c338a93c97ffebeeef318e679ff82b7dbf309dd5', claim: 'INDEPENDENT_RETAINED_EVIDENCE_REVIEW', repetitions: [] };
for (const repetition of [1, 2]) {
 const prefix = path.join(root, `out/native-ci-42711700295/repetition-${repetition}`);
 const read = name => fs.readFileSync(path.join(prefix, name));
 const json = name => JSON.parse(read(name));
 const item = { repetition };
 try {
  const receiptBytes = read('shutdown-submissions.json'), receipt = JSON.parse(receiptBytes);
  const worker = json('worker.json');
  const storageTransactions = new Map(json('evidence/native-transactions.json').map(row => [row.txid, Transaction.fromHex(row.rawTxHex)]));
  item.evidence = { path: path.relative(root, path.join(prefix, 'shutdown-submissions.json')), bytes: receiptBytes.length, sha256: sha(receiptBytes), workerHash: worker.shutdownSubmissionsSha256 };
  item.times = { workerStartedAt: worker.startedAt, initialCapturedAt: receipt.initialCapturedAt, recordEndedAt: json('record.json').endedAt, closureStartedAt: receipt.closureStartedAt, cleanup: receipt.cleanup, capturedAt: receipt.capturedAt, workerEndedAt: worker.endedAt };
  item.providerCounts = receipt.providers.map((provider, index) => ({ id: provider.id, initial: receipt.initialProviders[index].submissions.length, final: provider.submissions.length, tail: provider.submissions.length - receipt.initialProviders[index].submissions.length }));
  item.independent = await verifyNativeShutdownSubmissions(receiptBytes, { worker, recordBytes: read('record.json'), globalSubmissionsBytes: read('evidence/native-submissions.json'), permissionReportBytes: read('evidence/conformance/permission-lifecycle.json'), counterpartsBytes: read('evidence/conformance/service-counterparts.json'), expectedIdentity: json('evidence/integrated/result.json').walletIdentity, readEvidence: name => read(`evidence/${name}`), storageTransactions });
  const permission = json('evidence/conformance/permission-lifecycle.json');
  const grant = permission.steps.find(row => row.id === 'spending-allow');
  const approved = permission.transactions.find(row => row.role === 'spending-allow');
  const matchedPayments = [];
  for (const [index, row] of receipt.submissions.entries()) {
    const bytes = [...Buffer.from(row.beefHex, 'hex')]; let tx;
    try { tx = Transaction.fromAtomicBEEF(bytes); } catch { tx = Transaction.fromBinary(bytes); }
    for (const [vout, output] of tx.outputs.entries()) {
      if (![lifecyclePermissionConfig.paymentSatoshis, lifecyclePermissionConfig.secondPaymentSatoshis].includes(output.satoshis) || output.lockingScript.toHex() !== permission.paymentScript) continue;
      const withinModuleScope = index >= permission.submissionWindow.startIndex;
      const permittedGrant = withinModuleScope && grant?.outcome.status === 'fulfilled' && row.txid === approved?.txid && index >= grant.submissionStart && index < grant.submissionEnd && tx.toHex() === storageTransactions.get(row.txid)?.toHex();
      matchedPayments.push({ index, provenance: receipt.provenance[index], txid: row.txid, vout, satoshis: output.satoshis, verdict: row.verdict, withinModuleScope, permittedGrant, isPostInitialSnapshotTail: index >= receipt.initialCount });
    }
  }
  item.completeLedgerScan = { originalModuleStart: permission.submissionWindow.startIndex, finalCount: receipt.submissions.length, matchedPayments, unapprovedScopedMatches: matchedPayments.filter(row => row.withinModuleScope && !row.permittedGrant), postInitialSnapshotMatches: matchedPayments.filter(row => row.isPostInitialSnapshotTail), boundary: 'Complete retained provider arrays after awaited browser, services and profile cleanup; provider-local sequence only, no cross-provider chronology inferred.' };
  if (item.completeLedgerScan.unapprovedScopedMatches.length) throw Error('Independent final ledger scan found an unapproved matching payment');
  item.result = 'PASS';
 } catch (error) { item.result = 'FAIL'; item.error = String(error); }
 report.repetitions.push(item);
}
report.result = report.repetitions.every(item => item.result === 'PASS') ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(import.meta.dirname, 'shutdown.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
