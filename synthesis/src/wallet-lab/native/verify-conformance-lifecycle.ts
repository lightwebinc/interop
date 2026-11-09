import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { P2PKH, PublicKey, Transaction } from '@bsv/sdk'
import { canonicalJson, sha256Hex } from '../../determinism.js'

const fixture = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../../fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const tracker = { currentHeight: async () => fixture.fundingHeight + fixture.maturityDepth, isValidRootForHeight: async (root: string, height: number) => root === fixture.merkleRoot && height === fixture.fundingHeight }
const normalize = (row: any) => ({ ...row, outpoint: row.outpoint.replace('_', '.') })
const projection = (rows: any[]) => rows.map(normalize).sort((a, b) => a.outpoint.localeCompare(b.outpoint))
const errorIsRejection = (error: any) => typeof error?.message === 'string' && /review|reject|invalid|broadcast/i.test(error.message) && !/timeout|fetch failed|network error|HTTP 50[023]/i.test(error.message)

/** Recompute every outcome from trace, exact outpoints, action status and signed
 * transactions; asserted booleans and output counts alone cannot establish PASS. */
export async function verifyConformanceLifecycle(report: any): Promise<any> {
  assert.equal(report.schema, 'tpnil-native-conformance-lifecycle@1')
  assert.equal(report.claim, 'ENGINEERING_OBSERVATION_ONLY')
  assert.equal(report.basket, 'tpnil conformance lifecycle'); assert.equal(report.label, 'tpnil-conformance-lifecycle')
  assert.deepEqual(report.cases.map((row: any) => row.phase), ['accepted', 'rejected', 'recovered'])
  assert.deepEqual(report.cases.map((row: any) => row.scheduledVerdict), ['ACCEPTED_BY_NETWORK', 'REJECTED', 'ACCEPTED_BY_NETWORK'])
  assert.deepEqual(report.trace.map((row: any) => row.sequence), report.trace.map((_: any, i: number) => i))
  assert.deepEqual(report.trace.map((row: any) => row.method), ['getPublicKey', 'listOutputs', 'listActions', ...Array(3).fill(['getPublicKey', 'createAction', 'listOutputs', 'listActions']).flat()])
  assert.equal(report.trace[0].result.publicKey, report.identity)
  assert.deepEqual(report.initial.outputs, report.trace[1].result); assert.deepEqual(report.initial.actions, report.trace[2].result)
  assert.equal(report.initial.outputs.totalOutputs, 0); assert.deepEqual(report.initial.outputs.outputs, [])
  assert.equal(report.initial.actions.totalActions, 0); assert.deepEqual(report.initial.actions.actions, [])
  const states: any[] = [], transactions: Transaction[] = []
  for (const [index, entry] of report.cases.entries()) {
    const key = report.trace[3 + index * 4], write = report.trace[4 + index * 4], outputs = report.trace[5 + index * 4], actions = report.trace[6 + index * 4]
    assert.deepEqual(key.args, { protocolID: [2, 'tpnil lifecycle'], keyID: entry.phase, counterparty: 'self', forSelf: true })
    assert.equal(key.result.publicKey, entry.publicKey)
    const lockingScript = new P2PKH().lock(PublicKey.fromString(entry.publicKey).toAddress()).toHex()
    assert.deepEqual(entry.args, { description: `TPNIL lifecycle ${entry.phase}`, labels: [report.label, `${report.label}-${entry.phase}`], outputs: [{ satoshis: 2, lockingScript, basket: report.basket, tags: [entry.phase], customInstructions: `tpnil-lifecycle:${entry.phase}`, outputDescription: `Lifecycle ${entry.phase} output` }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } })
    assert.deepEqual(write.args, entry.args); assert.equal(write.sequence, entry.traceSequence)
    assert.deepEqual(write.result, entry.result); assert.deepEqual(write.error, entry.error)
    assert.deepEqual(outputs.args, { basket: report.basket, include: 'entire transactions', includeCustomInstructions: true, includeTags: true, includeLabels: true, limit: 1000 })
    assert.deepEqual(actions.args, { labels: [report.label], labelQueryMode: 'all', includeOutputs: true, includeInputs: true, limit: 1000 })
    assert.deepEqual(outputs.result, entry.outputs); assert.deepEqual(actions.result, entry.actions)
    assert.equal(entry.outputs.outputs.length, entry.outputs.totalOutputs); assert.ok(entry.outputs.totalOutputs < 1000)
    assert.equal(entry.actions.actions.length, entry.actions.totalActions); assert.ok(entry.actions.totalActions < 1000)
    const rows = projection(entry.outputs.outputs); assert.equal(new Set(rows.map(row => row.outpoint)).size, rows.length)
    states.push(rows)
    assert.equal(entry.submissions.length, 1, 'Exactly one causal submission is required for each scheduled verdict')
    const submission = entry.submissions[0]
    assert.equal(submission.verdict, entry.scheduledVerdict); assert.equal(sha256Hex(Uint8Array.from(submission.bytes)), submission.sha256)
    let submitted: Transaction
    try { submitted = Transaction.fromAtomicBEEF(submission.bytes) } catch { submitted = Transaction.fromBinary(submission.bytes) }
    assert.equal(submitted.id('hex'), submission.txid)
    const proof = report.transactions.filter((row: any) => row.phase === entry.phase)
    assert.equal(proof.length, 1); assert.equal(proof[0].txid, submission.txid)
    const tx = Transaction.fromAtomicBEEF(proof[0].beef)
    assert.equal(tx.toHex(), submitted.toHex()); assert.equal(tx.outputs[0]?.lockingScript.toHex(), lockingScript); assert.equal(tx.outputs[0]?.satoshis, 2)
    assert.ok(await tx.verify(tracker), 'Transaction scripts and pinned mined ancestry must verify, including the controlled policy-rejected transaction')
    assert.ok(tx.inputs.length > 0)
    const inputValue = tx.inputs.reduce((n, input) => n + (input.sourceTransaction?.outputs[input.sourceOutputIndex!]?.satoshis ?? -Number.MAX_SAFE_INTEGER), 0)
    assert.ok(inputValue >= tx.outputs.reduce((n, output) => n + (output.satoshis ?? Number.MAX_SAFE_INTEGER), 0), 'Value conservation failed')
    transactions.push(tx)
  }
  assert.equal(new Set(transactions.map(tx => tx.id('hex'))).size, 3)
  const [accepted, rejected, recovered] = report.cases
  const acceptedOutpoint = `${transactions[0]!.id('hex')}.0`, rejectedTxid = transactions[1]!.id('hex'), recoveredOutpoint = `${transactions[2]!.id('hex')}.0`
  const usable = (row: any) => row?.spendable === true && row.satoshis === 2
  const acceptedPass = !accepted.error && accepted.result?.txid === transactions[0]!.id('hex') && states[0].length === 1 && states[0][0].outpoint === acceptedOutpoint && usable(states[0][0])
  const rejectedActionAbsent = !rejected.actions.actions.some((row: any) => row.txid === rejectedTxid)
  const terminalError = rejected.error?.txid === rejectedTxid && rejected.error?.reviewActionResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'invalidTx') && rejected.error?.sendWithResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'failed')
  const rejectedPass = errorIsRejection(rejected.error) && terminalError && rejectedActionAbsent && canonicalJson(states[1]) === canonicalJson(states[0])
  const recoveredRow = states[2].find((row: any) => row.outpoint === recoveredOutpoint)
  const recoveredPass = !recovered.error && recovered.result?.txid === transactions[2]!.id('hex') && states[2].length === states[0].length + 1 && usable(recoveredRow) && canonicalJson(states[2].filter((row: any) => row.outpoint !== recoveredOutpoint)) === canonicalJson(states[0]) && !transactions[2]!.inputs.some(input => input.sourceTXID === rejectedTxid)
  const assertions = ['accepted-service-verdict-observed', 'rejection-preserves-wallet-state', 'post-rejection-recovery'].map((id, i) => ({ id, result: [acceptedPass, rejectedPass, recoveredPass][i] ? 'PASS' : 'FAIL' }))
  assert.deepEqual(report.assertions, assertions, 'Reported lifecycle verdicts differ from independent observations')
  assert.equal(report.result, assertions.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL')
  return { verified: true, result: report.result, assertions, transactions: transactions.map(tx => tx.id('hex')) }
}
