import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { WalletSettingsManager } from '@bsv/wallet-toolbox'
import { Beef, PrivateKey, Transaction } from '@bsv/sdk'
import { canonicalJson } from '../../determinism.js'

export const trustAssertionIds = ['initial-exclusion', 'public-settings-token', 'cache-expiry', 'positive-discovery', 'settings-restored', 'temporary-token-spent', 'public-boundary-only', 'cleanup'].map(id => `identity-trust.${id}`)
const issuer = PrivateKey.fromHex('36'.repeat(32)).toPublicKey().toString()
const isFixture = (row: any, certificate: any) => row.certifier === certificate.certifier && row.serialNumber === certificate.serialNumber && row.subject === certificate.subject

/** Public settings tokens are the only configuration surface used here.
 * The unchanged native wallet's private objects and cache are never accessed. */
export class PublicSettingsTrust {
  readonly report: any = { schema: 'tpnil-native-identity-trust@1', profile: 'native-public-settings-token@1.0.0', claim: 'ENGINEERING_OBSERVATION_ONLY', trace: [], assertions: [], cleanup: { attempted: false, restored: false } }
  private readonly boundary: any
  private readonly manager: WalletSettingsManager
  private writeAttempted = false
  constructor(wallet: any) {
    this.boundary = new Proxy({}, { get: (_target, name) => {
      if (typeof name !== 'string' || name === 'then') return undefined
      return async (...args: any[]) => {
        const entry: any = { method: name, args: structuredClone(args), startedAt: new Date().toISOString() }; this.report.trace.push(entry)
        try { const result = await wallet[name](...args); entry.result = structuredClone(result); return result }
        catch (error) { entry.error = error instanceof Error ? { name: error.name, message: error.message } : String(error); throw error }
        finally { entry.endedAt = new Date().toISOString() }
      }
    } })
    this.manager = new WalletSettingsManager(this.boundary)
  }
  private outputs() { return this.boundary.listOutputs({ basket: 'wallet settings', tags: ['settings'], tagQueryMode: 'all', include: 'entire transactions' }) }
  private record(id: string, pass: boolean, detail: string) { this.report.assertions.push({ id: `identity-trust.${id}`, result: pass ? 'PASS' : 'FAIL', detail }) }
  async enable(certificate: any): Promise<void> {
    this.report.certificate = certificate
    try {
      assert.equal(certificate.certifier, issuer)
      this.report.originalSettings = await this.manager.get()
      this.report.originalOutputs = await this.outputs()
      assert.ok(this.report.originalOutputs.totalOutputs <= 1, 'Ambiguous original settings tokens')
      assert.ok(!this.report.originalSettings.trustSettings.trustedCertifiers.some((c: any) => c.identityKey === issuer), 'Fixture issuer was already trusted')
      this.report.initialIdentity = await this.boundary.discoverByIdentityKey({ identityKey: certificate.subject, forceRefresh: true })
      this.report.initialAttributes = await this.boundary.discoverByAttributes({ attributes: { name: 'TPNIL boundary identity' }, forceRefresh: true })
      const excluded = [this.report.initialIdentity, this.report.initialAttributes].every(r => !r.certificates.some((c: any) => isFixture(c, certificate)))
      this.record('initial-exclusion', excluded, 'Both public discovery methods exclude the published, initially untrusted fixture issuer.')
      assert.ok(excluded)
      const settings = structuredClone(this.report.originalSettings)
      settings.trustSettings.trustedCertifiers.push({ identityKey: issuer, name: 'TPNIL scoped fixture issuer', description: 'Temporary qualification-only trust', trust: 4 })
      this.report.temporarySettings = settings
      this.writeAttempted = true
      await this.manager.set(settings)
      this.report.temporaryOutputs = await this.outputs()
      this.report.temporaryReadback = await this.manager.get()
      const written = this.report.temporaryOutputs.totalOutputs === 1 && canonicalJson(this.report.temporaryReadback) === canonicalJson(settings)
      this.record('public-settings-token', written, 'An encrypted settings PushDrop token was signed through public wallet methods and read back.')
      assert.ok(written)
      const started = performance.now(), startedAt = new Date().toISOString()
      // forceRefresh does not invalidate the unchanged wallet's 120s trust cache.
      // Real elapsed time is required; the timer is never injected or advanced.
      while (performance.now() - started < 121_000) await new Promise(resolve => setTimeout(resolve, Math.min(10_000, 121_000 - (performance.now() - started))))
      this.report.wait = { startedAt, endedAt: new Date().toISOString(), monotonicElapsedMs: Math.floor(performance.now() - started), requiredMs: 120_000 }
      this.record('cache-expiry', this.report.wait.monotonicElapsedMs >= 120_000, 'Waited for the native trust cache to expire without modifying its clock or private state.')
    } catch (error) { this.report.enableError = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) }
  }
  async finish(corpus: any): Promise<void> {
    const certificate = this.report.certificate
    const discovery = ['discoverByIdentityKey', 'discoverByAttributes'].map(method => corpus?.trace?.find((r: any) => r.method === method))
    this.report.positiveDiscovery = discovery
    this.record('positive-discovery', Boolean(certificate && discovery.every(r => r?.result?.certificates?.some((c: any) => isFixture(c, certificate)))), 'The unchanged native wallet discovers the published fixture through both public methods after trust-cache expiry.')
    this.report.cleanup.attempted = true
    try {
      if (!this.report.originalSettings || !this.report.originalOutputs) throw new Error('Original settings snapshot unavailable')
      if (this.writeAttempted) {
        if (this.report.originalOutputs.totalOutputs === 0) await this.manager.delete()
        else await this.manager.set(this.report.originalSettings)
      }
      this.report.restoredSettings = await this.manager.get()
      this.report.restoredOutputs = await this.outputs()
      this.report.cleanup.restored = canonicalJson(this.report.restoredSettings) === canonicalJson(this.report.originalSettings) && this.report.restoredOutputs.totalOutputs === this.report.originalOutputs.totalOutputs
      this.record('settings-restored', this.report.cleanup.restored, 'Restored the exact original settings; an originally absent token remains absent.')
      const outpoint = this.report.temporaryOutputs?.outputs?.[0]?.outpoint
      const [txid, vout] = String(outpoint).split('.')
      const transactions = this.report.trace.filter((r: any) => ['signAction', 'createAction'].includes(r.method) && r.result?.tx).map((r: any) => Transaction.fromAtomicBEEF(r.result.tx))
      const spend = transactions.find((tx: Transaction) => tx.inputs.some(i => i.sourceTXID === txid && i.sourceOutputIndex === Number(vout)))
      if (spend) this.report.retirementTransaction = { txid: spend.id('hex'), raw: spend.toHex(), beef: spend.toAtomicBEEF() }
      this.record('temporary-token-spent', Boolean(outpoint && spend && !this.report.restoredOutputs.outputs.some((r: any) => r.outpoint === outpoint)), 'A serialized signed transaction spends the temporary trust token; it is absent from the restored basket.')
    } catch (error) { this.report.cleanup.error = String(error) }
    const allowed = ['getPublicKey', 'createAction', 'signAction', 'listOutputs', 'encrypt', 'decrypt', 'createSignature', 'discoverByIdentityKey', 'discoverByAttributes']
    this.record('public-boundary-only', this.report.trace.length > 0 && this.report.trace.every((r: any) => allowed.includes(r.method)), 'All settings reads, writes, signatures and discovery calls use public wallet methods.')
    this.record('cleanup', Boolean(this.report.cleanup.restored && this.report.retirementTransaction), 'Durable temporary trust is retired; the enclosing isolated native container retires any residual in-memory cache.')
    const transactions = new Map<string, Transaction>()
    for (const row of this.report.trace) if (['createAction', 'signAction'].includes(row.method) && row.result?.tx) {
      const tx = Transaction.fromAtomicBEEF(row.result.tx); transactions.set(tx.id('hex'), tx)
    }
    for (const state of [this.report.temporaryOutputs, this.report.restoredOutputs]) if (state?.BEEF) for (const output of state.outputs) {
      const txid = output.outpoint.split('.')[0], tx = Transaction.fromAtomicBEEF(Beef.fromBinary(state.BEEF).toBinaryAtomic(txid)); transactions.set(txid, tx)
    }
    this.report.transactions = [...transactions.values()].map(tx => ({ txid: tx.id('hex'), rawHex: tx.toHex(), beefHex: Buffer.from(tx.toAtomicBEEF()).toString('hex') }))
    for (const id of trustAssertionIds) if (!this.report.assertions.some((r: any) => r.id === id)) this.report.assertions.push({ id, result: 'FAIL', detail: 'A preceding operation prevented this observation.' })
    this.report.result = this.report.assertions.every((r: any) => r.result === 'PASS') ? 'PASS' : 'FAIL'
  }
}
