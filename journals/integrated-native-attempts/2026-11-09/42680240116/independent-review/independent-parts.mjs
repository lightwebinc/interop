// Read-only completion review; writes only to a separate diagnostic directory.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { Beef, Transaction, ProtoWallet, PrivateKey, PublicKey, P2PKH } = await import('../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js')
const { ProtoWallet: IndependentWallet, PrivateKey: IndependentKey } = await import('../integrations/services/node_modules/@bsv/sdk/dist/esm/mod.js')
const { verifyEvidenceBundle } = await import('../synthesis/src/wallet-lab/evidence.ts')
const { verifyNativePermissionConformance } = await import('../synthesis/src/wallet-lab/native/verify-conformance-permissions.ts')
const { verifyConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts')
const { verifyNativeClauseConformance } = await import('../synthesis/src/wallet-lab/native/verify-conformance-clauses.ts')
const { verifyHostReceipt, verifyConformanceRepetitionAgreement } = await import('../synthesis/src/wallet-lab/native/verify.ts')
const { verifyConformanceReserves, spendsOnlyDeclaredNativePayments } = await import('../synthesis/src/wallet-lab/native/verify-conformance-reserves.ts')
const { verifyIntegratedWalletIdentity } = await import('../scripts/verify-native-integrated.mjs')
const { canonicalJson } = await import('../synthesis/src/determinism.ts')

const run = process.argv[2]
assert.match(run ?? '', /^\d+$/, 'Usage: node out/independent-native-completion-review.mjs RUN_ID')
const directory = path.resolve(import.meta.dirname, `native-ci-${run}`), output = path.resolve(import.meta.dirname, `native-review-${run}`)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
const counts = (rows, name = 'result') => Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(result => [result, rows.filter(row => row[name] === result).length]))
const lock = read('run-lock.json'), results = [], projections = [], integratedProjections = []
if (run === '42680240116') assert.equal(lock.source, '3f9cbead7c05a17b663f9c2c52b93abdf04eac69')
assert.equal(lock.plan.lifecycleOracle, 'tpnil-native-lifecycle-oracle@3.0.0')
assert.deepEqual(lock.plan, JSON.parse(fs.readFileSync(new URL('../infra/native/conformance/plan.json', import.meta.url), 'utf8')))
assert.equal(lock.planSha256, hash(Buffer.from(JSON.stringify(lock.plan, null, 2) + '\n')))
assert.equal(lock.image.os, 'linux'); assert.equal(lock.image.architecture, 'amd64')
assert.equal(lock.runner.platform, 'linux'); assert.equal(lock.runner.architecture, 'x64')
const userns = read('host-userns.json'); assert.equal(userns.active, '0'); assert.equal(userns.restored, userns.before); assert.equal(userns.restoredSuccessfully, true)
const containerIds = new Set()
for (const repetition of [1, 2]) {
  const relative = `repetition-${repetition}`, rep = path.join(directory, relative), evidence = name => read(`${relative}/evidence/${name}`)
  const record = verifyEvidenceBundle(rep), worker = read(`${relative}/worker.json`)
  assert.equal(worker.completed, true); assert.equal(worker.cleanWalletAndServiceShutdown, true)
  assert.equal(worker.recordSha256, hash(fs.readFileSync(path.join(rep, 'record.json'))))
  assert.equal(worker.planSha256, lock.planSha256)
  const elapsed = Date.parse(worker.endedAt) - Date.parse(worker.startedAt)
  assert.ok(Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= lock.plan.timeoutSecondsPerRepetition * 1000)
  const before = read(`host-repetition-${repetition}-before.json`), after = read(`host-repetition-${repetition}-after.json`), cleanup = read(`host-repetition-${repetition}-cleanup.json`)
  for (const row of [before, after]) verifyHostReceipt(row, lock.image.id)
  assert.equal(before.id, after.id); assert.equal(after.id, cleanup.id); assert.equal(cleanup.removed, true)
  assert.ok(!containerIds.has(before.id)); containerIds.add(before.id)
  assert.equal(after.state.Running, false); assert.equal(after.state.ExitCode, 0); assert.equal(after.state.OOMKilled, false)
  const mongo = read(`${relative}/mongo-cleanup.json`); assert.equal(mongo.clean, true); assert.equal(mongo.forced, false); assert.equal(mongo.code, 0)
  const installed = read(`${relative}/installed-artifacts.json`); assert.equal(installed.exactArchiveContents, true)
  assert.deepEqual(record.artifacts.wallet, lock.plan.wallet); assert.deepEqual(record.artifacts.application, lock.plan.application)
  for (const phase of ['before', 'after']) {
    const network = read(`${relative}/network-${phase}.json`)
    assert.ok(Object.values(network.interfaces).flat().every(address => address.internal))
    assert.match(network.capabilities, /^CapEff:\s+0+$/)
    assert.equal(network.probes.length, 2); assert.ok(network.probes.every(probe => ['ENETUNREACH', 'EHOSTUNREACH', 'EPERM', 'EACCES'].includes(probe.code)))
  }
  const sandbox = fs.readFileSync(path.join(rep, 'evidence/native-sandbox.txt'), 'utf8')
  assert.match(sandbox, /PID namespaces\s+Yes/); assert.match(sandbox, /Seccomp-BPF sandbox\s+Yes/); assert.equal(hash(sandbox), worker.sandboxSha256)
  assert.match(fs.readFileSync(path.join(rep, 'evidence/native-trust.txt'), 'utf8'), /ITCVE controlled CA/)

  const integrated = evidence('integrated/result.json'), identity = integrated.walletIdentity, boundary = evidence('integrated/boundary.json'), trust = evidence('integrated/identity-trust.json')
  assert.equal(evidence('integrated/relay.json').trace.find(row => row.method === 'getPublicKey' && row.status === 200).body.result.publicKey, identity)
  assert.equal(evidence('integrated/messaging.json').nativeIdentity, identity)
  verifyIntegratedWalletIdentity(identity, boundary, trust)
  verifyNativePermissionConformance(evidence('conformance/permissions.json'), name => fs.readFileSync(path.join(rep, 'evidence', name)), identity)
  await verifyConformanceLifecycle(evidence('conformance/lifecycle.json'))
  await verifyNativeClauseConformance(evidence('conformance/clauses.json'), boundary)
  const verified = evidence('conformance/result.json'); verified.semanticProjection = canonicalJson(verified.vectors.map(({id,outcome,assertions})=>({id,outcome,assertions:assertions.map(({id,outcome})=>({id,outcome}))})))
  assert.deepEqual(verified.vectors, record.vectors); projections.push(verified.semanticProjection)
  assert.equal(verified.vectors.flatMap(row => row.assertions).length, 263)
  const permission = evidence('conformance/permissions.json')
  const child = new ProtoWallet(PrivateKey.fromHex('01')).keyDeriver.derivePublicKey([2, 'tpnil native permission v1'], 'origin-isolation', identity, false).toString()
  const otherChild = new IndependentWallet(IndependentKey.fromHex('01')).keyDeriver.derivePublicKey([2, 'tpnil native permission v1'], 'origin-isolation', identity, false).toString()
  assert.equal(child, otherChild)
  const returnedKeys = permission.steps.filter(row => row.outcome.status === 'fulfilled')
  for (const row of returnedKeys) assert.equal(row.outcome.value.publicKey, child)

  const reserve = evidence('conformance/funding-reserves.json'), lifecycle = evidence('conformance/lifecycle.json'), source = evidence('mined-funding-source.json'), scenario = evidence('conformance/scenario-start.json'), submissions = evidence('native-submissions.json')
  assert.equal(reserve.storageSnapshot.implementation, 'go'); assert.equal(lifecycle.identity, identity)
  const funding = Transaction.fromAtomicBEEF([...fs.readFileSync(path.join(rep, 'evidence/funding.atomicbeef'))]), transactions = new Map(), storageTransactions = new Map()
  function add(tx) { if (transactions.has(tx.id('hex'))) return; transactions.set(tx.id('hex'), tx); for (const input of tx.inputs) if (input.sourceTransaction) add(input.sourceTransaction) }
  add(funding); for (const payment of reserve.payments) add(Transaction.fromAtomicBEEF(payment.beef))
  const create = Transaction.fromAtomicBEEF(Beef.fromBinary([...fs.readFileSync(path.join(rep, 'evidence/create.beef'))]).toBinaryAtomic(record.observations.createTxid)); add(create)
  for (const row of evidence('native-transactions.json')) { const tx = Transaction.fromHex(row.rawTxHex); assert.equal(tx.id('hex'), row.txid); storageTransactions.set(row.txid, tx); if (!transactions.has(row.txid)) transactions.set(row.txid, tx); else assert.equal(transactions.get(row.txid).toHex(), tx.toHex()) }
  for (const tx of transactions.values()) for (const input of tx.inputs) if (!input.sourceTransaction) input.sourceTransaction = transactions.get(input.sourceTXID)
  const verifiedReserve = await verifyConformanceReserves(reserve, { policy: lock.plan.fundingReserves, identity, initialFundingTxid: funding.id('hex'), scenarioStartedAt: scenario.startedAt, workerStartedAt: worker.startedAt, submissions, firstCustomerTxid: create.id('hex'), transactions, storageTransactions, fixture: source.fixture })
  const sender = new ProtoWallet(PrivateKey.fromHex('22'.repeat(32))), initialKey = await sender.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${Buffer.from('tpnil-wallet-lab').toString('base64')} ${Buffer.from('funding-001').toString('base64')}`, counterparty: identity, forSelf: false })
  assert.equal(source.publicKey, initialKey.publicKey); assert.equal(funding.outputs[0].satoshis, 10000); assert.equal(funding.outputs[0].lockingScript.toHex(), new P2PKH().lock(PublicKey.fromString(initialKey.publicKey).toAddress()).toHex())
  const roots = [funding.id('hex'), ...verifiedReserve.roots].map(id => `${id}.0`), firstCustomer = submissions.findIndex(row => row.txid === create.id('hex')), recoveryIndex = submissions.findIndex(row => row.txid === lifecycle.cases[2].result?.txid)
  const scenarioGraph = [], quarantined = new Set(), rejected = new Set()
  if (recoveryIndex >= firstCustomer && firstCustomer >= 0) for (let index = firstCustomer; index <= recoveryIndex; index++) {
    const row = submissions[index], tx = transactions.get(row.txid); assert.ok(tx)
    assert.ok(spendsOnlyDeclaredNativePayments(tx, roots), 'Scenario input outside the declared upfront native payments')
    const inputs = tx.inputs.map(input => `${input.sourceTXID ?? input.sourceTransaction.id('hex')}.${input.sourceOutputIndex}`)
    assert.ok(inputs.every(outpoint => !quarantined.has(outpoint)))
    assert.ok(tx.inputs.every(input => !rejected.has(input.sourceTXID)))
    if (row.verdict === 'REJECTED') { for (const outpoint of inputs) quarantined.add(outpoint); rejected.add(tx.id('hex')) }
    scenarioGraph.push({ index, txid: tx.id('hex'), verdict: row.verdict, inputs })
  }
  if (recoveryIndex >= 0) assert.equal(rejected.size, 2)

  const rust = { assertions: [], outcome: 'NOT_EXECUTED_PARENT_VERIFICATION_STOPPED' }
  const integrationProjection = integrated.assertions.map(({ id, result }) => ({ id, result })).sort((a, b) => a.id.localeCompare(b.id)); integratedProjections.push(integrationProjection)
  results.push({ repetition, recordSha256: worker.recordSha256, identity, conformance: { result: verified.outcome, assertions: 263, counts: counts(verified.vectors.flatMap(row => row.assertions), 'outcome'), vectors: verified.vectors.map(({ id, outcome }) => ({ id, outcome })), projectionSha256: hash(verified.semanticProjection) }, permissions: { counts: counts(permission.assertions), joinedPublicKeys: returnedKeys.length, independentSdk2And4Agreement: true }, lifecycle: { schema: lifecycle.schema, oracle: lifecycle.oracle, result: lifecycle.result, assertions: lifecycle.assertions }, reserves: { roots, startedAt: reserve.startedAt, completedAt: reserve.completedAt, scenarioStartedAt: scenario.startedAt, snapshotAuthenticated: true, scenarioGraph, rejectedChainsUnreusedThroughRecovery: recoveryIndex >= 0 ? true : null }, clauses: { counts: counts(evidence('conformance/clauses.json').assertions), completeBRC100Conformance: false }, integrated: { counts: counts(integrated.assertions), identityJoinsVerified: true }, rust: { counts: counts(rust.assertions), outcome: rust.outcome, parentInputsBound: 0, semanticReplay: 'Not executed; native parent verifier stopped at portability predicate disagreement' }, admissionReceipts: { isolatedHost: true, exactInstalledArchives: true, kernelNetworkNone: true, sandbox: true, processShutdown: true, containerRemoved: true, mongoClean: true, usernsRestored: true }, worker: { startedAt: worker.startedAt, endedAt: worker.endedAt } })
}
verifyConformanceRepetitionAgreement(projections); assert.deepEqual(integratedProjections[0], integratedProjections[1]); assert.notEqual(results[0].identity, results[1].identity)
const receipt = { schema: 'tpnil-native-completion-independent-review@1', claim: 'FAILED_ATTEMPT_PARTIAL_INDEPENDENT_REVIEW_NOT_QUALIFICATION', run, runtimeSource: lock.source, checkerRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), reviewedAt: new Date().toISOString(), originalArchive: { size: fs.statSync(`${directory}.zip`).size, sha256: hash(fs.readFileSync(`${directory}.zip`)) }, reviewScriptSha256: hash(fs.readFileSync(import.meta.filename)), all263ReportedAssertionOutcomesMatch: true, independentlyReplayedChildren: ['permissions','lifecycle','clauses','funding-reserves'], portabilityQualification: 'REJECTED_PRODUCER_ORACLE_DISAGREEMENT', integratedCounts: 'Raw retained outcomes only; full semantic replay stopped at portability', integratedAssertionOutcomesMatch: true, results }
fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'independent-parts.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ receipt: path.join(output, 'independent-parts.json'), all263Match: true, results: results.map(row => ({ repetition: row.repetition, conformance: row.conformance.counts, vectors: row.conformance.vectors, lifecycle: row.lifecycle.result, clauses: row.clauses.counts, integrated: row.integrated.counts, rust: row.rust.counts })) }))
