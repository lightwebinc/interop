import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { Transaction } from '@bsv/sdk'
import { readyPortableRedemption } from '../src/wallet-lab/native/conformance-portability.js'
import { verifyNativePortability } from '../src/wallet-lab/native/verify-conformance-portability.js'

const archive = path.resolve(import.meta.dirname, '../../journals/integrated-native-attempts/2026-11-09/42690318194/native-integrated.zip')
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
expect(sha(fs.readFileSync(archive))).toBe('6e5171faf01d68f2ba0aa30cdfb78c102343e5a02d1aa24166194956d75d989b')
const read = (rep: number, name: string) => JSON.parse(execFileSync('unzip', ['-p', archive, `repetition-${rep}/evidence/${name}`], { maxBuffer: 16 * 1024 * 1024 }).toString())
for (const repetition of [1, 2]) it(`retains native6 repetition${repetition} unsigned-lock failure and rejects premature redemption`, async () => {
  const r = read(repetition, 'conformance/portability.json')
  expect(r.result).toBe('FAIL')
  await expect(verifyNativePortability(r)).rejects.toThrow('portability.native-mediated-sync')
  expect(await readyPortableRedemption(r.destinationAfter, r.outpoint)).toBeUndefined()
  const rows = read(repetition, 'native-transactions.json')
  const spend = rows.map((row: any) => Transaction.fromHex(row.rawTxHex)).find((tx: Transaction) => tx.inputs.some(input => `${input.sourceTXID}.${input.sourceOutputIndex}` === r.outpoint))!
  // Deliberate readiness-unit counterfactual, not a rewritten native report:
  // final storage's actual signed bytes are joined to the earlier unsigned row.
  const completed = structuredClone(r.destinationAfter)
  const locked = completed.outputs.find((row: any) => `${row.txid}.${row.vout}` === r.outpoint)
  const row = completed.transactions.find((row: any) => row.transactionId === locked.spentBy)
  Object.assign(row, { status: 'unmined', txid: spend.id('hex'), rawTx: spend.toBinary() })
  expect((await readyPortableRedemption(completed, r.outpoint))?.txid).toBe(spend.id('hex'))
  for (const mutate of [
    (r: any) => { r.transactions.find((x: any) => x.transactionId === locked.spentBy).status = 'unsigned' },
    (r: any) => { r.transactions.find((x: any) => x.transactionId === locked.spentBy).rawTx = [] },
    (r: any) => { r.transactions.find((x: any) => x.transactionId === locked.spentBy).txid = '00'.repeat(32) },
    (r: any) => { r.outputs.find((x: any) => `${x.txid}.${x.vout}` === read(repetition, 'conformance/portability.json').outpoint).spendable = true },
    (r: any) => { for (const row of [...r.transactions, ...r.provenTxReqs]) row.inputBEEF = [] },
    (r: any) => { r.transactions.find((x: any) => x.transactionId === locked.spentBy).rawTx = [0, 1, 2] }
  ]) {
    const changed = structuredClone(completed); mutate(changed)
    let result; try { result = await readyPortableRedemption(changed, r.outpoint) } catch { result = undefined }
    expect(result).toBeUndefined()
  }
})

it('waits for the native awaited-signAction success signal only in prospective controls', async () => {
  const { nativePortabilityControls } = await import('../src/wallet-lab/native/conformance-portability.js')
  for (const prospective of [false, true]) {
    const order: string[] = [], ui: any[] = []
    const application: any = {
      getByLabel: () => ({ click: async () => { order.push('select') } }),
      getByTestId: () => ({ click: async () => { order.push('submit') } }),
      getByText: (text: string, options: any) => ({ waitFor: async (wait: any) => { expect(text).toBe('Congrats! Task complete 🎉'); expect(options.exact).toBe(true); expect(wait.timeout).toBe(45000); order.push('completed') } }),
      locator: () => ({ innerText: async () => 'Congrats! Task complete 🎉' })
    }
    await nativePortabilityControls(application, {} as any, 'unused', ui, prospective).redeemTask()
    expect(order).toEqual(prospective ? ['select', 'submit', 'completed'] : ['select', 'submit'])
    expect(ui.length).toBe(prospective ? 1 : 0)
  }
})

const evidenceDirectory = path.resolve(import.meta.dirname, '../../journals/native-portability-reference/2026-11-09/signed-completion-v3')
const summary = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'summary.json'), 'utf8'))
const archived = fs.readFileSync(path.join(evidenceDirectory, summary.artifact.path))
expect(archived.length).toBe(summary.artifact.bytes); expect(sha(archived)).toBe(summary.artifact.sha256)
const { gunzipSync } = await import('node:zlib')
const files = new Map<string, string>()
for (const file of JSON.parse(gunzipSync(archived, { maxOutputLength: 128 * 1024 * 1024 }).toString()).files) {
  const bytes = Buffer.from(file.content)
  expect(bytes.length).toBe(file.size); expect(sha(bytes)).toBe(file.sha256)
  expect(files.has(file.path)).toBe(false); files.set(file.path, file.content)
}
const finalRun = summary.runs.find((run: any) => run.result === 'PASS')
const native = () => JSON.parse(files.get(`${finalRun.directory}/evidence/conformance/portability.json`)!)
it('replays the actual native oracle3 completion and rejects altered activation, receipt, proof and causal windows', async () => {
  expect((await verifyNativePortability(native())).assertions).toHaveLength(9)
  const normalized = native(); normalized.ui.find((row: any) => row.stage === 'replacement-active').text = normalized.ui.find((row: any) => row.stage === 'replacement-active').text.replace('IN USE', '  in\tuse  ')
  expect((await verifyNativePortability(normalized)).result).toBe('PASS')
  const rewriteReceipt = (r: any, side: string, change: (value: any) => void) => {
    const receipt = r.redemptionObservations.at(-1).processActionReceipts[0]
    const value = JSON.parse(Buffer.from(receipt[`${side}Hex`], 'hex').toString()); change(value)
    const bytes = Buffer.from(JSON.stringify(value)); receipt[`${side}Hex`] = bytes.toString('hex'); receipt[`${side}Sha256`] = sha(bytes)
  }
  const mutations: Array<(r: any) => void> = [
    r => { r.schema = 'tpnil-native-storage-portability@2'; r.oracle = 'tpnil-native-portability-oracle@2.0.0' },
    r => { r.ui.find((row: any) => row.stage === 'replacement-active').text = 'replacement-wallet.itcve.test\nNOT IN USE' },
    r => { r.ui.find((row: any) => row.stage === 'native-task-complete').text = 'Task disappeared' },
    r => { r.ui.find((row: any) => row.stage === 'native-task-complete').at = r.outage.endedAt },
    r => { r.redemptionObservations = [] },
    r => { r.redemptionCompletion.at = new Date(Date.parse(r.outage.endedAt) + 1).toISOString() },
    r => { r.readWindows.redemptionPoll0.endedAt = new Date(Date.parse(r.outage.endedAt) + 1).toISOString() },
    r => { r.readWindows.redemptionPoll0.storageEnd += 0.1 },
    r => { r.storage[r.readWindows.redemptionPoll0.storageStart].error = 'unacknowledged failed page' },
    r => { r.redemptionObservations.at(-1).processActionReceipts = [] },
    r => rewriteReceipt(r, 'response', value => { value.error = { code: -32603, message: 'failed' }; delete value.result }),
    r => rewriteReceipt(r, 'response', value => { value.result.sendWithResults[0].status = 'failed' }),
    r => rewriteReceipt(r, 'response', value => { value.id++ }),
    r => rewriteReceipt(r, 'request', value => { value.params[1].txid = '00'.repeat(32) }),
    r => rewriteReceipt(r, 'request', value => { value.params[1].rawTx[0] ^= 1 }),
    r => rewriteReceipt(r, 'request', value => { value.params[0].identityKey = '02' + '00'.repeat(32) }),
    r => { r.redemptionObservations.at(-1).capturedAt = new Date(Date.parse(r.outage.endedAt) + 1).toISOString() },
    r => { r.redemption.rawHex = r.task.rawHex }
  ]
  for (const [index, mutate] of mutations.entries()) {
    const changed = native(); mutate(changed)
    await expect(verifyNativePortability(changed), `mutation ${index}`).rejects.toThrow('Independent portability predicate differs')
  }
})
