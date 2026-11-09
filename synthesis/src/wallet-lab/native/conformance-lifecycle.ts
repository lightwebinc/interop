import { Beef, P2PKH, PublicKey, Transaction } from '@bsv/sdk'
import { canonicalJson, sha256Hex } from '../../determinism.js'
import type { ControlledWalletServices } from '../services.js'

export const lifecycleAssertionIds = ['accepted-service-verdict-observed', 'rejection-preserves-wallet-state', 'post-rejection-recovery']
export const lifecycleBasket = 'tpnil conformance lifecycle'
export const lifecycleOracleId = 'tpnil-native-lifecycle-oracle@3.0.0'
const label = 'tpnil-conformance-lifecycle'
const snapshot = (value: any): any => JSON.parse(JSON.stringify(value))
const errorSnapshot = (error: unknown): any => error instanceof Error
  ? snapshot({ ...error, name: error.name, message: error.message }) : { message: String(error) }
const metadataValid = (value: any) => (value?.outputs ?? []).every((row: any) => ['labels', 'tags'].every(field => row[field] === undefined || Array.isArray(row[field]) && row[field].every((item: any) => typeof item === 'string') && new Set(row[field]).size === row[field].length))
const projection = (value: any, metadataSets: boolean) => canonicalJson((value?.outputs ?? []).map((row: any) => {
  const normalized = { ...row, outpoint: row.outpoint.replace('_', '.') }
  // BRC100 line29 defines only transaction labels and output tags as sets.
  // Preserve every raw value; ordering of all other arrays remains significant.
  if (metadataSets) for (const field of ['labels', 'tags']) if (Array.isArray(row[field])) normalized[field] = [...row[field]].sort()
  return normalized
}).sort((a: any, b: any) => a.outpoint.localeCompare(b.outpoint)))

/** Public wallet operations and controlled service responses are retained separately.
 * No storage mutation, action abort or output relinquishment repairs the rejection. */
export async function runConformanceLifecycle(wallet: any, services: ControlledWalletServices, options: { receiptMode?: 'storage-rpc'; oracle?: typeof lifecycleOracleId } = {}): Promise<any> {
  if (options.oracle !== undefined && (options.oracle !== lifecycleOracleId || options.receiptMode !== 'storage-rpc')) throw new Error('Lifecycle v3 requires its explicit oracle and public storage receipt mode')
  const metadataSets = options.oracle === lifecycleOracleId
  const report: any = { schema: metadataSets ? 'tpnil-native-conformance-lifecycle@3' : options.receiptMode ? 'tpnil-native-conformance-lifecycle@2' : 'tpnil-native-conformance-lifecycle@1', ...(metadataSets ? { oracle: lifecycleOracleId } : {}), ...(options.receiptMode ? { terminalReceiptSource: 'authenticated-public-go-storage-rpc' } : {}), claim: 'ENGINEERING_OBSERVATION_ONLY', basket: lifecycleBasket, label, trace: [], cases: [], assertions: [] }
  if (options.receiptMode) report.serviceIdentity = snapshot(services.componentIdentity)
  const call = async (method: string, args: any) => {
    const entry: any = { sequence: report.trace.length, method, args: snapshot(args) }; report.trace.push(entry)
    try { entry.result = snapshot(await wallet[method](args)); return entry.result }
    catch (error) { entry.error = errorSnapshot(error); throw error }
  }
  const outputs = () => call('listOutputs', { basket: lifecycleBasket, include: 'entire transactions', includeCustomInstructions: true, includeTags: true, includeLabels: true, limit: 1000 })
  const actions = () => call('listActions', { labels: [label], labelQueryMode: 'all', includeOutputs: true, includeInputs: true, limit: 1000 })
  report.identity = (await call('getPublicKey', { identityKey: true })).publicKey
  report.initial = { outputs: await outputs(), actions: await actions() }
  if (report.initial.outputs.totalOutputs !== 0 || report.initial.actions.totalActions !== 0) throw new Error('Lifecycle requires fresh basket and action-label state')
  for (const [phase, verdict] of [['accepted', 'ACCEPTED_BY_NETWORK'], ['rejected', 'REJECTED'], ['recovered', 'ACCEPTED_BY_NETWORK']] as const) {
    const publicKey = (await call('getPublicKey', { protocolID: [2, 'tpnil lifecycle'], keyID: phase, counterparty: 'self', forSelf: true })).publicKey
    const lockingScript = new P2PKH().lock(PublicKey.fromString(publicKey).toAddress()).toHex()
    const args = { description: `TPNIL lifecycle ${phase}`, labels: [label, `${label}-${phase}`], outputs: [{ satoshis: 2, lockingScript, basket: lifecycleBasket, tags: [phase], customInstructions: `tpnil-lifecycle:${phase}`, outputDescription: `Lifecycle ${phase} output` }], options: { randomizeOutputs: false, acceptDelayedBroadcast: false } }
    const observation: any = { phase, scheduledVerdict: verdict, publicKey, args: snapshot(args), traceSequence: report.trace.length }
    const before = services.submissions.length
    const receiptsBefore = services.storageProcessActionReceipts.length
    services.enqueueVerdict(verdict, metadataSets ? { kind: 'exact-output', lockingScript, amount: 2 } : undefined)
    try { observation.result = await call('createAction', args) }
    catch (error) { observation.error = errorSnapshot(error) }
    observation.submissions = services.submissions.slice(before).map(row => ({ txid: row.txid, verdict: row.verdict, bytes: [...row.bytes], sha256: sha256Hex(row.bytes) }))
    if (options.receiptMode) observation.storageReceipts = snapshot(services.storageProcessActionReceipts.slice(receiptsBefore))
    const targetObserved = metadataSets && observation.submissions.some((row: any) => {
      let tx: Transaction
      try { tx = Transaction.fromAtomicBEEF(row.bytes) } catch { tx = Transaction.fromBinary(row.bytes) }
      return tx.outputs.some(output => output.satoshis === 2 && output.lockingScript.toHex() === lockingScript)
        && !services.submissions.slice(0, before).some(previous => previous.txid === row.txid)
    })
    const unusedTargetRemoved = metadataSets && !targetObserved ? services.discardQueuedVerdict(verdict) : false
    if (unusedTargetRemoved) observation.unusedTargetRemoved = true
    if (observation.submissions.length === 0) observation.unconsumedVerdictRemoved = metadataSets ? unusedTargetRemoved : services.discardQueuedVerdict(verdict)
    observation.outputs = await outputs()
    observation.actions = await actions()
    report.cases.push(observation)
  }
  // Merge independently observed proof material so even the rejected raw Go
  // submission remains verifiable after its output has disappeared from queries.
  const beef = new Beef()
  for (const entry of report.trace) {
    if (Array.isArray(entry.result?.BEEF)) beef.mergeBeef(entry.result.BEEF)
    if (Array.isArray(entry.result?.tx)) beef.mergeBeef(entry.result.tx)
    if (Array.isArray(entry.error?.tx)) beef.mergeBeef(entry.error.tx)
  }
  for (const entry of report.cases) for (const submission of entry.submissions) {
    try { beef.mergeBeef(submission.bytes) } catch { beef.mergeRawTx(submission.bytes) }
  }
  report.transactions = report.cases.flatMap((entry: any) => entry.submissions.map((submission: any) => {
    try { return { phase: entry.phase, txid: submission.txid, beef: beef.toBinaryAtomic(submission.txid) } }
    catch (error) { return { phase: entry.phase, txid: submission.txid, error: errorSnapshot(error) } }
  }))
  const [accepted, rejected, recovered] = report.cases
  const verdictMatches = (entry: any) => entry.submissions.length === 1 && entry.submissions[0].verdict === entry.scheduledVerdict
  const output = (entry: any) => `${entry.submissions[0]?.txid}.0`
  const rejectedTxid = rejected.submissions[0]?.txid
  const rejectedActionAbsent = !rejected.actions.actions.some((row: any) => row.txid === rejectedTxid)
  const serviceResult = options.receiptMode && rejected.storageReceipts.length === 1 ? JSON.parse(Buffer.from(rejected.storageReceipts[0].responseHex, 'hex').toString()).result : undefined
  const terminalError = options.receiptMode
    ? Boolean(rejected.error && /review|reject|invalid|broadcast/i.test(rejected.error.message) && !/timeout|fetch failed|network error|HTTP 50[023]/i.test(rejected.error.message) && serviceResult?.notDelayedResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'invalidTx') && serviceResult?.sendWithResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'failed'))
    : rejected.error?.txid === rejectedTxid && rejected.error?.reviewActionResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'invalidTx') && rejected.error?.sendWithResults?.some((row: any) => row.txid === rejectedTxid && row.status === 'failed')
  const acceptedPass = verdictMatches(accepted) && !accepted.error && accepted.result?.txid === accepted.submissions[0]?.txid && accepted.outputs.totalOutputs === 1 && accepted.outputs.outputs[0]?.outpoint.replace('_', '.') === output(accepted) && (!metadataSets || metadataValid(accepted.outputs))
  const rejectedPass = verdictMatches(rejected) && terminalError && rejectedActionAbsent && rejected.outputs.totalOutputs === accepted.outputs.totalOutputs && projection(rejected.outputs, metadataSets) === projection(accepted.outputs, metadataSets) && (!metadataSets || metadataValid(accepted.outputs) && metadataValid(rejected.outputs))
  const recoveredPass = verdictMatches(recovered) && !recovered.error && recovered.result?.txid === recovered.submissions[0]?.txid && recovered.outputs.totalOutputs === accepted.outputs.totalOutputs + 1 && projection({ outputs: recovered.outputs.outputs.filter((row: any) => row.outpoint.replace('_', '.') !== output(recovered)) }, metadataSets) === projection(accepted.outputs, metadataSets) && (!metadataSets || metadataValid(accepted.outputs) && metadataValid(recovered.outputs))
  report.assertions = lifecycleAssertionIds.map((id, index) => ({ id, result: [acceptedPass, rejectedPass, recoveredPass][index] ? 'PASS' : 'FAIL' }))
  report.result = report.assertions.every((row: any) => row.result === 'PASS') ? 'PASS' : 'FAIL'
  return report
}
