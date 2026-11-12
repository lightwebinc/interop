// Prospective1.5 read-only completion review; original artifact members never written.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { Beef, Transaction, ProtoWallet, PrivateKey, PublicKey, P2PKH, PushDrop, Utils } = await import('../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js')
const { ProtoWallet: IndependentWallet, PrivateKey: IndependentKey } = await import('../integrations/services/node_modules/@bsv/sdk/dist/esm/mod.js')
const { verifyEvidenceBundle } = await import('../synthesis/src/wallet-lab/evidence.ts')
const { verifyNativePermissionConformance } = await import('../synthesis/src/wallet-lab/native/verify-conformance-permissions.ts')
const { verifyConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts')
const { verifyNativeConformance } = await import('../synthesis/src/wallet-lab/native/verify-conformance.ts')
const { verifyTodoSubmissionBinding } = await import('../synthesis/src/wallet-lab/native/verify-todo-submission-binding.ts')
const { verifyLifecycleSubmissionBinding } = await import('../synthesis/src/wallet-lab/native/lifecycle-submission-binding.ts')
const { verifyRust } = await import('../scripts/verify-rust.mjs')
const { verifyCoverageNativeTransactions } = await import('../synthesis/src/wallet-lab/native/verify-conformance-coverage-transactions.ts')
const { verifyNoSendChangeFixture } = await import('../synthesis/src/wallet-lab/native/verify-conformance-nosend-change.ts')
const { verifyNativeClauseConformance } = await import('../synthesis/src/wallet-lab/native/verify-conformance-clauses.ts')
const { verifyHostReceipt, verifyConformanceRepetitionAgreement } = await import('../synthesis/src/wallet-lab/native/verify.ts')
const { verifyConformanceReserves, spendsOnlyDeclaredNativePayments, verifyBoundaryFundingRoot } = await import('../synthesis/src/wallet-lab/native/verify-conformance-reserves.ts')
const { verifyIntegratedWalletIdentity } = await import('../scripts/verify-native-integrated.mjs')
const { canonicalJson } = await import('../synthesis/src/determinism.ts')

const run = process.argv[2]
assert.match(run ?? '', /^\d+$/, 'Usage: node out/independent-native-completion-review.mjs RUN_ID')
const directory = path.resolve(import.meta.dirname, `native-ci-${run}`), output = path.resolve(import.meta.dirname, `native-review-${run}`)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
const counts = (rows, name = 'result') => Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(result => [result, rows.filter(row => row[name] === result).length]))
const lock = read('run-lock.json'), results = [], projections = [], integratedProjections = []
assert.equal(run, '42697283161'); assert.equal(lock.source, 'cc3cf756272b8d3826612d71e8f6356239fed6fa')
assert.equal(lock.plan.lifecycleOracle, 'tpnil-native-lifecycle-oracle@3.0.0')
assert.deepEqual(lock.plan, JSON.parse(fs.readFileSync(new URL('../infra/native/conformance/plan-coverage.json', import.meta.url), 'utf8')))
assert.equal(lock.planSha256, hash(Buffer.from(JSON.stringify(lock.plan, null, 2) + '\n')))
assert.equal(lock.image.os, 'linux'); assert.equal(lock.image.architecture, 'amd64')
assert.equal(lock.runner.platform, 'linux'); assert.equal(lock.runner.architecture, 'x64')
const checkerFiles=['synthesis/src/wallet-lab/native/verify.ts','synthesis/src/wallet-lab/native/verify-conformance.ts','synthesis/src/wallet-lab/native/verify-conformance-permissions.ts','synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts','synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts','synthesis/src/wallet-lab/native/verify-conformance-portability.ts','synthesis/src/wallet-lab/native/verify-conformance-clauses.ts','synthesis/src/wallet-lab/native/verify-conformance-nosend-change.ts','synthesis/src/wallet-lab/native/verify-conformance-coverage-transactions.ts','synthesis/src/wallet-lab/native/verify-conformance-reserves.ts','synthesis/src/wallet-lab/native/portability-proof.ts','synthesis/src/wallet-lab/go-services.ts','scripts/verify-native-integrated.mjs','scripts/verify-rust.mjs','scripts/rust-corpus.mjs']
const checkerBindings=checkerFiles.map(name=>{const bytes=fs.readFileSync(path.resolve(import.meta.dirname,'..',name)),expected=execFileSync('git',['show',`${lock.source}:${name}`],{maxBuffer:16*1024*1024});assert.equal(hash(bytes),hash(expected),`Checker source differs from frozen runtime revision: ${name}`);return {path:name,sha256:hash(bytes)}})
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
  const verified = await verifyNativeConformance(path.join(rep,'evidence'), evidence('conformance/baseline-vectors.json'), lock.plan.lifecycleOracle, lock.plan.portabilityOracle, lock.plan.clauseOracle, lock.plan.itcve)
  assert.deepEqual(verified.vectors, record.vectors); projections.push(verified.semanticProjection)
  assert.equal(verified.vectors.flatMap(row => row.assertions).length, 280)
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
  const todo = evidence('broadcast-lifecycle.json'), selectedTodo = verifyTodoSubmissionBinding(todo, submissions, lock.plan.task)
  verifyLifecycleSubmissionBinding(lifecycle, submissions)
  const verifiedReserve = await verifyConformanceReserves(reserve, { policy: lock.plan.fundingReserves, identity, initialFundingTxid: funding.id('hex'), scenarioStartedAt: scenario.startedAt, workerStartedAt: worker.startedAt, submissions, firstCustomerTxid: create.id('hex'), transactions, storageTransactions, fixture: source.fixture })
  const sender = new ProtoWallet(PrivateKey.fromHex('22'.repeat(32))), initialKey = await sender.getPublicKey({ protocolID: [2, '3241645161d8'], keyID: `${Buffer.from('tpnil-wallet-lab').toString('base64')} ${Buffer.from('funding-001').toString('base64')}`, counterparty: identity, forSelf: false })
  assert.equal(source.publicKey, initialKey.publicKey); assert.equal(funding.outputs[0].satoshis, 10000); assert.equal(funding.outputs[0].lockingScript.toHex(), new P2PKH().lock(PublicKey.fromString(initialKey.publicKey).toAddress()).toHex())
  const roots = [funding.id('hex'), ...verifiedReserve.roots].map(id => `${id}.0`), firstCustomer = submissions.findIndex(row => row.txid === create.id('hex')), recoveryIndex = submissions.findIndex(row => row.txid === lifecycle.cases[2].result?.txid)
  const tracker = { currentHeight: async () => source.fixture.fundingHeight + source.fixture.maturityDepth, isValidRootForHeight: async (root, height) => root === source.fixture.merkleRoot && height === source.fixture.fundingHeight }
  const header=Buffer.from(source.fixture.blockHeaderHex,'hex')
  assert.equal(header.length,80);assert.equal(Buffer.from(header.subarray(36,68)).reverse().toString('hex'),source.fixture.merkleRoot)
  assert.equal(createHash('sha256').update(createHash('sha256').update(header).digest()).digest().reverse().toString('hex'),source.fixture.fundingBlockHash)
  assert.equal(hash(Buffer.from(canonicalJson(source.fixture))),lock.plan.fundingFixtureCanonicalSha256)
  assert.ok(await funding.verify(tracker));assert.ok(await create.verify(tracker));assert.ok(spendsOnlyDeclaredNativePayments(create,roots))
  const created=evidence('created-output.json'),reload=evidence('cold-reload.json'),redeemed=evidence('redeem.json')
  const createdRow=created.created.outputs.find(row=>row.outpoint.startsWith(create.id('hex')))
  assert.ok(createdRow);const outputIndex=Number(createdRow.outpoint.split(/[._]/)[1]),taskOutpoint=`${create.id('hex')}.${outputIndex}`
  assert.equal(create.outputs[outputIndex].satoshis,lock.plan.amount);assert.equal(create.outputs[outputIndex].lockingScript.toHex(),created.lockingScript)
  assert.equal(Utils.toUTF8(PushDrop.decode(create.outputs[outputIndex].lockingScript).fields[0]),'1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG');assert.equal(created.plaintext,lock.plan.task)
  assert.equal(reload.localStorageCleared,true);assert.equal(reload.taskVisible,true)
  assert.ok(reload.afterReload.outputs.some(row=>row.outpoint.replace('_','.')===taskOutpoint));assert.ok(!redeemed.afterRedeem.outputs.some(row=>row.outpoint.replace('_','.')===taskOutpoint))
  const spent=[...transactions.values()].find(tx=>tx.inputs.some(input=>input.sourceTXID===create.id('hex')&&input.sourceOutputIndex===outputIndex))
  assert.ok(spent);assert.ok(await spent.verify(tracker));assert.equal(storageTransactions.get(spent.id('hex')).toHex(),spent.toHex())
  const spentInputs=spent.inputs.reduce((sum,input)=>sum+input.sourceTransaction.outputs[input.sourceOutputIndex].satoshis,0),spentOutputs=spent.outputs.reduce((sum,output)=>sum+output.satoshis,0)
  assert.ok(spentInputs>=spentOutputs)
  const baselineProof={create:create.id('hex'),taskOutpoint,redemption:spent.id('hex'),fee:spentInputs-spentOutputs,signaturesAndPinnedMinedRootVerified:true,coldReloadAndSpentAbsence:true}
  for (const txid of selectedTodo) { const tx = transactions.get(txid); assert.ok(tx); assert.equal(storageTransactions.get(txid)?.toHex(), tx.toHex()); assert.ok(spendsOnlyDeclaredNativePayments(tx, roots)); assert.ok(await tx.verify(tracker)) }
  const todoChecks = { accepted: todo.accepted.submission?.verdict === 'ACCEPTED_BY_NETWORK' && todo.accepted.body.includes('Task successfully created!'), rejected: todo.rejected.submission?.verdict === 'REJECTED' && todo.rejected.outputs?.totalOutputs === todo.accepted.outputs?.totalOutputs, recovered: todo.recovered.submission?.verdict === 'ACCEPTED_BY_NETWORK' && todo.recovered.outputs?.totalOutputs === todo.accepted.outputs?.totalOutputs + 1 }
  assert.deepEqual(evidence('conformance/baseline-vectors.json')[5].assertions.map(row => row.outcome), Object.values(todoChecks).map(passed => passed ? 'PASS' : 'FAIL'))
  const windows = { todo: Object.entries(todoChecks).map(([phase, passed]) => ({ phase, passed, selection: todo[phase].submissionWindow.selection, startIndex: todo[phase].submissionWindow.startIndex, endIndex: todo[phase].submissionWindow.endIndex, selectedTxid: todo[phase].submission?.txid, receiptCount: todo[phase].submissionWindow.receipts.length })), api: lifecycle.cases.map(row => ({ selection: row.submissionWindow.selection, startIndex: row.submissionWindow.startIndex, endIndex: row.submissionWindow.endIndex, selectedIndices: row.submissionWindow.selectedIndices, retainedSubmissions: row.submissionWindow.submissions.length, retainedStorageReceipts: row.submissionWindow.storageReceipts.length })) }
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
  const postRecoveryRejectedReuse = []
  for (let index = recoveryIndex + 1; recoveryIndex >= 0 && index < submissions.length; index++) {
    const row = submissions[index], tx = transactions.get(row.txid) ?? (() => { const bytes = [...Buffer.from(row.beefHex, 'hex')]; try { return Transaction.fromAtomicBEEF(bytes) } catch { return Transaction.fromBinary(bytes) } })()
    assert.equal(tx.id('hex'), row.txid)
    const reused = tx.inputs.map(input => `${input.sourceTXID ?? input.sourceTransaction?.id('hex')}.${input.sourceOutputIndex}`).filter(outpoint => quarantined.has(outpoint) || rejected.has(outpoint.split('.')[0]))
    if (reused.length) postRecoveryRejectedReuse.push({ index, txid: row.txid, inputs: reused })
  }
  assert.deepEqual(postRecoveryRejectedReuse, [], 'A later submitted transaction reuses a quarantined input or rejected output')

  const permissionLifecycle = evidence('conformance/permission-lifecycle.json'), clauses = evidence('conformance/clauses.json'), portability = evidence('conformance/portability.json')
  const lifecycleReturnedKeys=permissionLifecycle.steps.filter(row=>row.method==='getPublicKey'&&row.outcome.status==='fulfilled'&&!row.args.identityKey)
  for(const row of lifecycleReturnedKeys)assert.equal(row.outcome.value.publicKey,otherChild)
  const window = permissionLifecycle.submissionWindow
  assert.deepEqual(window.entries, submissions.slice(window.startIndex,window.endIndex).map((row,offset)=>({index:window.startIndex+offset,txid:row.txid,verdict:row.verdict,serializedHex:row.beefHex})))
  const approvedPayment = permissionLifecycle.transactions.find(row=>row.role==='spending-allow')?.txid
  const postModuleReceipts = submissions.slice(window.endIndex).map((row,offset)=>{
    const bytes=[...Buffer.from(row.beefHex,'hex')];let tx
    try{tx=Transaction.fromAtomicBEEF(bytes)}catch{tx=Transaction.fromBinary(bytes)}
    assert.equal(tx.id('hex'),row.txid)
    const matchingAmounts=tx.outputs.filter(output=>output.lockingScript.toHex()===permissionLifecycle.paymentScript&&[5,7].includes(output.satoshis)).map(output=>output.satoshis)
    return {index:window.endIndex+offset,txid:row.txid,verdict:row.verdict,matchingAmounts,alreadyApprovedPayment:row.txid===approvedPayment}
  })
  const unexpectedPostModulePayments=postModuleReceipts.filter(row=>row.matchingAmounts.includes(7)||row.matchingAmounts.includes(5)&&!row.alreadyApprovedPayment)
  if(unexpectedPostModulePayments.length)console.error(JSON.stringify({finding:'POST_MODULE_DENIED_PAYMENT',repetition,unexpectedPostModulePayments}))
  assert.equal(unexpectedPostModulePayments.length,0,'Final captured global ledger contains a delayed denied/unapproved customer payment')
  const metadata = clauses.trace.find(row=>row.id==='setup.metadata')
  const corpusRoot = typeof metadata?.result?.txid === 'string' ? await verifyBoundaryFundingRoot(boundary,{identity,fixture:source.fixture,storageTransactions,submissions,metadataTxid:metadata.result.txid}) : undefined
  const anchor = clauses.trace.find(row=>row.id==='setup.input.createAction.options.noSendChange.0')
  const coverageTransactions = [...permissionLifecycle.transactions]
  if(Array.isArray(anchor?.result?.tx)&&typeof anchor.result.txid==='string')coverageTransactions.push({role:'clause-nosend-anchor',txid:anchor.result.txid,atomicBeef:anchor.result.tx})
  const coverageBinding = await verifyCoverageNativeTransactions(coverageTransactions,{storageTransactions,declaredNativePayments:[...roots,...(corpusRoot?[corpusRoot]:[])],fixture:source.fixture})
  let noSendFixture
  try{noSendFixture={verified:true,...await verifyNoSendChangeFixture(clauses)}}catch(error){noSendFixture={verified:false,error:String(error)}}

  const rustDirectory = path.join(directory, `rust-repetition-${repetition}`), rustInputs = ['paid-http.json', 'messaging.json', 'synthesis-transactions.json', 'identity-trust.json'].map(name => path.join(rep, 'evidence/integrated', name))
  const rust = fs.existsSync(path.join(rustDirectory, 'result.json')) ? JSON.parse(fs.readFileSync(path.join(rustDirectory, 'result.json'))) : { assertions: [], outcome: 'NOT_EXECUTED_PARENT_VERIFICATION_STOPPED' }
  const rustVerification = rust.assertions.length ? verifyRust(rustDirectory, rustInputs) : { independentReplay: false, parentInputsBound: 0 }
  const integrationProjection = integrated.assertions.map(({ id, result }) => ({ id, result })).sort((a, b) => a.id.localeCompare(b.id)); integratedProjections.push(integrationProjection)
  results.push({ repetition, recordSha256: worker.recordSha256, identity, conformance: { result: verified.outcome, assertions: 280, counts: counts(verified.vectors.flatMap(row => row.assertions), 'outcome'), vectors: verified.vectors.map(({ id, outcome }) => ({ id, outcome })), projectionSha256: hash(verified.semanticProjection) }, baselineProof, causalSubmissionWindows: windows, permissionLifecycle: { counts: counts(permissionLifecycle.assertions), identityJoined: permissionLifecycle.identity === identity, independentSdk2And4KeyAgreement: true, joinedDerivedKeys:lifecycleReturnedKeys.length, globalSubmissionWindowBound: true, startIndex:window.startIndex,endIndex:window.endIndex, transactions:coverageBinding.transactions, postModuleGlobalLedger:{moduleEndedAt:permissionLifecycle.endedAt,recordEndedAt:record.endedAt,finalReceiptCount:submissions.length,receipts:postModuleReceipts,unexpectedPayments:unexpectedPostModulePayments,limitation:'Final native-submissions snapshot precedes context/services shutdown; no absence claim beyond that captured ledger.'} }, portability: { result:portability.result,counts:counts(portability.assertions),oracle:portability.oracle,outage:portability.outage,completion:portability.redemptionCompletion,finalRead:portability.trace.at(-1),finalSnapshotWindow:portability.readWindows.destinationAfter,readPolls:portability.redemptionObservations.length,rawRedemption:portability.redemption }, noSendChange: { fixture:noSendFixture, assertions:clauses.assertions.filter(row=>row.id.includes('noSendChange')) }, permissions: { counts: counts(permission.assertions), joinedPublicKeys: returnedKeys.length, independentSdk2And4Agreement: true }, lifecycle: { schema: lifecycle.schema, oracle: lifecycle.oracle, result: lifecycle.result, assertions: lifecycle.assertions }, reserves: { roots, startedAt: reserve.startedAt, completedAt: reserve.completedAt, scenarioStartedAt: scenario.startedAt, snapshotAuthenticated: true, scenarioGraph, rejectedChainsUnreusedThroughRecovery: recoveryIndex >= 0 ? true : null, postRecoverySubmissionsChecked: recoveryIndex >= 0 ? submissions.length - recoveryIndex - 1 : 0, postRecoveryRejectedReuse }, clauses: { counts: counts(evidence('conformance/clauses.json').assertions), nonPassing: evidence('conformance/clauses.json').assertions.filter(row => row.result !== 'PASS').map(({id,result}) => ({id,result})), completeBRC100Conformance: false }, integrated: { counts: counts(integrated.assertions), identityJoinsVerified: true }, rust: { counts: counts(rust.assertions), outcome: rust.outcome, parentInputsBound: rustVerification.parentInputsBound, semanticReplay: rustVerification.independentReplay ? 'All retained calls independently replayed with exact parent inputs' : 'No Rust artifact retained' }, admissionReceipts: { isolatedHost: true, exactInstalledArchives: true, kernelNetworkNone: true, sandbox: true, processShutdown: true, containerRemoved: true, mongoClean: true, usernsRestored: true }, worker: { startedAt: worker.startedAt, endedAt: worker.endedAt } })
}
let repetitionAgreement=true,agreementError;try{verifyConformanceRepetitionAgreement(projections)}catch(error){repetitionAgreement=false;agreementError=String(error).split('\n')[0]}
const firstProjection=JSON.parse(projections[0]),secondProjection=JSON.parse(projections[1]),differences=[]
for(let v=0;v<firstProjection.length;v++)for(let a=0;a<firstProjection[v].assertions.length;a++){const left=firstProjection[v].assertions[a],right=secondProjection[v].assertions[a];assert.equal(left.id,right.id);if(left.outcome!==right.outcome)differences.push({vector:firstProjection[v].id,id:left.id,repetition1:left.outcome,repetition2:right.outcome})}
assert.deepEqual(integratedProjections[0], integratedProjections[1]); assert.notEqual(results[0].identity, results[1].identity)
const receipt = { schema: 'tpnil-native-completion-independent-review@1', claim: 'FAILED_ATTEMPT_INDEPENDENT_CHILD_REVIEW_NOT_QUALIFICATION', run, runtimeSource: lock.source, checkerRevision: 'cc3cf756272b8d3826612d71e8f6356239fed6fa', checkerSourceMode: 'Exact frozen cc3 source; pinned dependencies reused; review helper separately hashed', reviewedAt: new Date().toISOString(), originalArchive: { size: fs.statSync(`${directory}.zip`).size, sha256: hash(fs.readFileSync(`${directory}.zip`)) }, reviewScriptSha256: hash(fs.readFileSync(import.meta.filename)), checkerBindings, all280IndependentlyVerifiedAssertionOutcomesMatch: repetitionAgreement, agreementError, differences, independentlyReplayedChildren: ['permissions','permission-lifecycle','lifecycle','portability3','clauses4','funding-reserves','todo-causal-windows','api-causal-windows','native-coverage-transaction-binding'], integratedCounts: 'Retained outcomes independently counted and identity joined; separate helper replays every child semantic oracle', integratedAssertionOutcomesMatch: true, results }
fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'independent-coverage.json'), JSON.stringify(receipt, null, 2) + '\n')
console.log(JSON.stringify({ receipt: path.join(output, 'independent-coverage.json'), all280Match: repetitionAgreement, differences, results: results.map(row => ({ repetition: row.repetition, conformance: row.conformance.counts, vectors: row.conformance.vectors, lifecycle: row.lifecycle.result, clauses: row.clauses.counts, integrated: row.integrated.counts, rust: row.rust.counts })) }))
