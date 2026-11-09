import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Beef, PushDrop, Transaction, Utils, type WalletInterface } from '@bsv/sdk'
import type { Page } from 'playwright'
import { ControlledWalletServices } from '../services.js'
import type { EvidenceBundle } from '../evidence.js'
import { nativeWalletBoundary } from './integrated.js'
import { ObservedStorageClient, readDataset, type Transcript } from '../../storage-sync/run.js'
import { projectDataset } from '../../storage-sync/projection.js'
import { canonicalJson } from '../../determinism.js'

export const portabilityAssertions = ['same-identity', 'distinct-counterparts', 'native-mediated-sync', 'complete-logical-dataset', 'source-unavailable', 'cold-wallet-reload', 'cold-task-recovery', 'replacement-redemption', 'cleanup'].map(id => `portability.${id}`)
const replacementHost = 'replacement-wallet.itcve.test'
const replacementUrl = `https://${replacementHost}`
export const portableTask = 'TPNIL native storage replacement'
const amount = 3
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value))
async function until<T>(operation: () => Promise<T>, accept: (value: T) => boolean, timeout = 45_000): Promise<T> {
  const end = Date.now() + timeout
  do { const value = await operation(); if (accept(value)) return value; await new Promise(resolve => setTimeout(resolve, 200)) } while (Date.now() < end)
  throw new Error('Portability observation deadline exceeded')
}

export interface PortabilityControls {
  createTask(): Promise<void>
  addAndSync(url: string): Promise<void>
  activateAndRemoveSource(url: string): Promise<void>
  coldReload(): Promise<Record<string, unknown>>
  redeemTask(): Promise<void>
  /** Reference engineering only; native evidence comes from the browser proxy. */
  referenceTranscript?(): Transcript[]
}

/** Core operations are public wallet calls and authenticated RPC reads. Only the
 * wallet's own supported settings UI performs synchronization and replacement. */
export async function qualifyStoragePortability(options: {
  wallet: WalletInterface; source: ControlledWalletServices; destination: ControlledWalletServices
  controls: PortabilityControls; mode: 'native-ui' | 'reference-engineering'
}) {
  const { wallet, source, destination, controls } = options
  const report: any = { schema: 'tpnil-native-storage-portability@1', claim: 'ENGINEERING_OBSERVATION_ONLY', mode: options.mode, assertions: [], trace: [], storage: [], ui: [], cleanup: { sourceRestored: false } }
  const check = (id: string, pass: boolean, detail: string) => report.assertions.push({ id: `portability.${id}`, result: pass ? 'PASS' : 'FAIL', detail })
  const call = async (method: string, args: any): Promise<any> => {
    const row: any = { method, args, startedAt: new Date().toISOString() }; report.trace.push(row)
    try { const result = await (wallet as any)[method](args); row.result = clean(result); return result }
    catch (error) { row.error = String(error); throw error } finally { row.endedAt = new Date().toISOString() }
  }
  let unavailable = false
  try {
    const identity = (await call('getPublicKey', { identityKey: true })).publicKey
    report.identity = identity
    const beforeTask = await call('listOutputs', { basket: 'todo tokens', include: 'entire transactions', includeTags: true, includeCustomInstructions: true, limit: 1000 })
    await controls.createTask()
    report.created = await until(() => call('listOutputs', { basket: 'todo tokens', include: 'entire transactions', includeTags: true, includeCustomInstructions: true, limit: 1000 }), r => r.outputs.some((o: any) => o.satoshis === amount && !beforeTask.outputs.some((old: any) => old.outpoint === o.outpoint)))
    const output = report.created.outputs.find((o: any) => o.satoshis === amount && !beforeTask.outputs.some((old: any) => old.outpoint === o.outpoint))
    report.outpoint = output.outpoint
    const [txid, index] = output.outpoint.split('.')
    const tx = Transaction.fromAtomicBEEF(Beef.fromBinary(report.created.BEEF).toBinaryAtomic(txid))
    const token = PushDrop.decode(tx.outputs[Number(index)]!.lockingScript)
    report.task = { text: portableTask, amount, protocolAddress: Utils.toUTF8(token.fields[0]!), ciphertext: token.fields[1], txid, vout: Number(index), rawHex: tx.toHex(), beefHex: Buffer.from(tx.toAtomicBEEF()).toString('hex') }
    report.beforeDecryption = await call('decrypt', { ciphertext: token.fields[1], protocolID: [0, 'todo list'], keyID: '1', counterparty: 'self' })
    assert.equal(Utils.toUTF8(report.beforeDecryption.plaintext), portableTask)
    const transcript = report.storage as Transcript[]
    const reader = new ObservedStorageClient(wallet, source.storageUrl, 'source-observer', transcript, source.components.storage)
    const target = new ObservedStorageClient(wallet, destination.storageUrl, 'destination-observer', transcript, destination.components.storage)
    report.counterparts = { source: await reader.makeAvailable(), destination: await target.makeAvailable(), url: replacementUrl }
    check('distinct-counterparts', report.counterparts.source.storageIdentityKey !== report.counterparts.destination.storageIdentityKey, 'Independent storage identities and temporary databases back the two counterparts.')
    await controls.addAndSync(replacementUrl)
    // Read after the native mediator completes; the harness never writes chunks.
    report.source = await readDataset(reader, identity)
    report.destination = await readDataset(target, identity)
    check('complete-logical-dataset', canonicalJson(projectDataset(report.source)) === canonicalJson(projectDataset(report.destination)), 'All logical records, bytes, metadata and foreign-key relationships match after native-mediated synchronization.')
    report.nativeRpc = clean(source.storageRpcObservations)
    if (options.mode === 'reference-engineering') report.referenceMediator = clean(controls.referenceTranscript?.() ?? [])
    check('native-mediated-sync', options.mode === 'native-ui' ? report.nativeRpc.some((r: any) => r.host === replacementHost && r.method === 'processSyncChunk' && r.completed && r.status === 200) : report.referenceMediator.some((r: any) => r.method === 'processSyncChunk' && r.response && !r.error), 'The declared wallet mediator sends authenticated processSyncChunk requests; reference mode is not native qualification.')
    await controls.activateAndRemoveSource(replacementUrl)
    await source.setStorageEndpointAvailable(false); unavailable = true
    report.outage = { startedAt: new Date().toISOString(), events: clean(source.storageEndpointEvents) }
    try { await fetch(source.storageUrl, { signal: AbortSignal.timeout(2000) }); report.outage.probe = { reachable: true } }
    catch (error) { report.outage.probe = { reachable: false, error: String(error) } }
    check('source-unavailable', report.outage.probe.reachable === false, 'The source storage TCP listener is stopped while chain, overlay and replacement services remain running.')
    const replacementStart = source.storageRpcObservations.length
    report.coldReload = await controls.coldReload()
    check('cold-wallet-reload', report.coldReload.locked === true && report.coldReload.unlocked === true && report.coldReload.applicationCacheCleared === true && report.coldReload.contextDropped === true, 'Supported Lock/Unlock retires the native live wallet context; the ToDo client cache is cleared and reloaded.')
    report.identityAfter = (await call('getPublicKey', { identityKey: true })).publicKey
    check('same-identity', report.identityAfter === identity, 'Native wallet identity is unchanged after counterpart replacement and cold reconstruction.')
    report.recovered = await call('listOutputs', { basket: 'todo tokens', include: 'entire transactions', includeTags: true, includeCustomInstructions: true, limit: 1000 })
    report.afterDecryption = await call('decrypt', { ciphertext: token.fields[1], protocolID: [0, 'todo list'], keyID: '1', counterparty: 'self' })
    const recovered = report.recovered.outputs.filter((o: any) => o.outpoint === report.outpoint)
    check('cold-task-recovery', recovered.length === 1 && recovered[0].spendable === true && Utils.toUTF8(report.afterDecryption.plaintext) === portableTask && report.coldReload.taskVisible === true, 'The same unspent encrypted ToDo outpoint is reconstructed and decrypted from the replacement.')
    await controls.redeemTask()
    report.redeemed = await until(() => call('listOutputs', { basket: 'todo tokens', include: 'entire transactions', limit: 1000 }), r => !r.outputs.some((o: any) => o.outpoint === report.outpoint))
    report.destinationAfter = await readDataset(target, identity)
    report.replacementRpc = clean(source.storageRpcObservations.slice(replacementStart))
    if (options.mode === 'reference-engineering') report.referenceMediatorAfter = clean(controls.referenceTranscript?.() ?? [])
    const spent = report.destinationAfter.outputs.find((o: any) => o.txid === txid && Number(o.vout) === Number(index))
    const spending = report.destinationAfter.transactions.find((t: any) => t.transactionId === spent?.spentBy)
    const raw = spending?.rawTx ?? report.destinationAfter.provenTxReqs.find((t: any) => t.txid === spending?.txid)?.rawTx
    if (raw) {
      const redemption = Transaction.fromBinary(raw)
      report.redemption = { txid: redemption.id('hex'), rawHex: redemption.toHex(), transaction: spending }
    }
    check('replacement-redemption', spent?.spendable === false && Boolean(report.redemption) && (options.mode === 'native-ui' ? report.replacementRpc.some((r: any) => r.host === replacementHost && r.method === 'processAction' && r.status === 200) : report.referenceMediatorAfter.some((r: any) => r.provider === 'replacement-active' && r.method === 'processAction' && r.response && !r.error)), 'A ToDo redemption is serialized and stored by the replacement while the source listener remains unavailable.')
  } catch (error) { report.error = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) }
  finally {
    if (unavailable) { await source.setStorageEndpointAvailable(true); report.outage.endedAt = new Date().toISOString() }
    report.cleanup.sourceRestored = true
    check('cleanup', true, 'The source listener is restored; caller retires the isolated replacement after evidence collection.')
  }
  for (const id of portabilityAssertions) if (!report.assertions.some((a: any) => a.id === id)) report.assertions.push({ id, result: 'FAIL', detail: 'A preceding operation prevented this observation.' })
  report.result = report.assertions.every((a: any) => a.result === 'PASS') ? 'PASS' : 'FAIL'
  return clean(report)
}

/** Real settings UI controls; no extension messaging or private wallet access. */
export function nativePortabilityControls(application: Page, walletPage: Page, password: string, ui: any[]): PortabilityControls {
  const snapshot = async (stage: string) => ui.push({ stage, at: new Date().toISOString(), text: await walletPage.locator('body').innerText() })
  const settings = async () => { await walletPage.reload(); await walletPage.getByText('Settings', { exact: true }).last().click(); await walletPage.getByText('Lock Wallet', { exact: true }).waitFor() }
  const backups = async () => { await settings(); await walletPage.getByText('Wallet Backup', { exact: true }).first().click(); await walletPage.getByText('Remote Backup', { exact: true }).click(); await walletPage.getByText('Sync Now', { exact: true }).waitFor() }
  return {
    async createTask() {
      const url = new URL('https://todo.itcve.test/'); url.searchParams.set('p0Task', portableTask); url.searchParams.set('p0Amount', String(amount)); url.searchParams.set('p0OpenCreate', '1')
      await application.goto(url.href); await application.getByTestId('p0-todo-create-submit').click()
    },
    async addAndSync(url) {
      await backups(); await snapshot('before-add')
      await walletPage.getByRole('button', { name: 'Add', exact: true }).click()
      await walletPage.getByText('Custom Provider', { exact: true }).click()
      await walletPage.getByPlaceholder('https://your-server.com/storage').fill(url)
      await walletPage.getByRole('button', { name: 'Add Custom Remote', exact: true }).click()
      await walletPage.getByText('Remote added', { exact: true }).waitFor({ timeout: 45_000 })
      await walletPage.getByText('Sync Now', { exact: true }).click()
      await walletPage.getByText('Sync complete', { exact: true }).waitFor({ timeout: 60_000 }); await snapshot('native-sync-complete')
    },
    async activateAndRemoveSource(url) {
      await walletPage.getByRole('button').filter({ hasText: new URL(url).host }).first().click()
      await walletPage.getByRole('button', { name: 'Make Active', exact: true }).click()
      await walletPage.getByText(`Active: ${new URL(url).host}`, { exact: true }).waitFor({ timeout: 60_000 }); await snapshot('replacement-active')
      await backups()
      await walletPage.getByRole('button').filter({ hasText: 'wallet.1sat.app' }).first().click()
      await walletPage.getByRole('button', { name: 'Remove', exact: true }).click()
      await walletPage.getByText('Remote removed', { exact: true }).waitFor(); await snapshot('source-removed-from-config')
    },
    async coldReload() {
      const consoleMessages: string[] = []
      const workers = application.context().serviceWorkers()
      const listener = (message: any) => { if (/dropWalletContext \(WALLET_LOCKED\): gone immediately/.test(message.text())) consoleMessages.push(message.text()) }
      for (const worker of workers) worker.on('console', listener)
      try {
        await settings(); await walletPage.getByText('Lock Wallet', { exact: true }).click()
        await walletPage.getByPlaceholder('Password', { exact: true }).waitFor({ timeout: 30_000 })
        await until(async () => consoleMessages.length, n => n > 0, 10_000)
        await walletPage.getByPlaceholder('Password', { exact: true }).fill(password)
        await walletPage.getByRole('button', { name: 'Unlock', exact: true }).click()
        await walletPage.getByText('Settings', { exact: true }).last().waitFor({ timeout: 60_000 })
        await application.evaluate(() => localStorage.clear()); await application.goto('https://todo.itcve.test/')
        await application.getByText(portableTask, { exact: true }).waitFor({ timeout: 45_000 })
        return { mechanism: 'native-settings-lock-unlock', locked: true, unlocked: true, contextDropped: consoleMessages.length > 0, consoleMessages, applicationCacheCleared: true, taskVisible: true, at: new Date().toISOString() }
      } finally { for (const worker of workers) worker.off('console', listener) }
    },
    async redeemTask() { await application.getByLabel(`${portableTask} ${amount} satoshis`).click(); await application.getByTestId('p0-todo-complete-submit').click() }
  }
}

export async function runNativePortability({ application, services, evidence, password }: {
  application: Page; services: ControlledWalletServices; evidence: EvidenceBundle; password: string
}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-native-portability-'))
  fs.writeFileSync(path.join(directory, 'index.html'), '<title>Isolated storage counterpart</title>')
  const replacement = services.createStorageCounterpart(directory, '12'.repeat(32))
  let report: any
  let retained = false
  try {
    for (const header of services.headers.values()) replacement.registerHeader(header)
    await replacement.start()
    services.registerStorageCounterpart(replacementHost, replacement.storageUrl, replacement)
    retained = true
    const walletPage = application.context().pages().find(page => /^chrome-extension:\/\/.+\/index.html/.test(page.url()))
    if (!walletPage) throw new Error('Native wallet settings page is absent')
    const ui: any[] = []
    report = await qualifyStoragePortability({ wallet: nativeWalletBoundary(application), source: services, destination: replacement, controls: nativePortabilityControls(application, walletPage, password, ui), mode: 'native-ui' })
    report.ui = ui
    report.components = { source: services.componentIdentity, replacement: replacement.componentIdentity }
    report.cleanup.replacementOwnedByServiceGraph = true
    report.cleanup.retirement = 'ControlledWalletServices.close after the complete native scenario'
    evidence.addJson('conformance/portability.json', report)
  } finally {
    if (!retained) await replacement.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
  return report
}
