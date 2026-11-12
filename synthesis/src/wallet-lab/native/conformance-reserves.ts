import { PrivateKey, ProtoWallet } from '@bsv/sdk'
import type { EvidenceBundle } from '../evidence.js'
import type { ControlledWalletServices } from '../services.js'
import type { NativeScenarioContext } from '../yours-driver.js'
import { nativeWalletBoundary } from './integrated.js'
import { readNativeReserveStorage } from './conformance-reserve-storage.js'

export const conformanceReservePolicy = {
  schema: 'tpnil-native-funding-reserves@1', count: 2, satoshisEach: 10_000,
  stage: 'before-all-customer-scenarios', recoveryScope: 'unaffected-preexisting-funds'
} as const
const snapshot = (value: any) => JSON.parse(JSON.stringify(value))

/** Declared initial funding topology, completed before any customer operation.
 * Invalid posted transactions keep their input chains quarantined. Recovery uses
 * unaffected pre-existing funds; no post-rejection refill or input release occurs. */
export async function prepareConformanceReserves({ wallet, services, evidence }: {
  wallet: any; services: ControlledWalletServices; evidence: EvidenceBundle
}): Promise<any> {
  const report: any = { schema: conformanceReservePolicy.schema, policy: conformanceReservePolicy,
    startedAt: new Date().toISOString(), trace: [], payments: [] }
  const call = async (method: string, args: any) => {
    const entry: any = { sequence: report.trace.length, method, args: snapshot(args) }; report.trace.push(entry)
    entry.result = snapshot(await wallet[method](args)); return entry.result
  }
  report.identity = (await call('getPublicKey', { identityKey: true })).publicKey
  const sender = new ProtoWallet(PrivateKey.fromHex('22'.repeat(32)))
  report.senderIdentity = (await sender.getPublicKey({ identityKey: true })).publicKey
  for (let index = 0; index < conformanceReservePolicy.count; index++) {
    const derivationPrefix = Buffer.from('tpnil-conformance-reserves').toString('base64')
    const derivationSuffix = Buffer.from(`initial-${index + 1}`).toString('base64')
    const args = { protocolID: [2, '3241645161d8'], keyID: `${derivationPrefix} ${derivationSuffix}`, counterparty: report.senderIdentity, forSelf: true }
    const publicKey = (await call('getPublicKey', args)).publicKey
    const submissionIndex = services.submissions.length
    const payment = await services.payNativeWallet(publicKey, conformanceReservePolicy.satoshisEach)
    const internalized = await call('internalizeAction', { tx: payment.tx, outputs: [{ outputIndex: 0, protocol: 'wallet payment', paymentRemittance: { derivationPrefix, derivationSuffix, senderIdentityKey: report.senderIdentity } }], description: `TPNIL initial conformance reserve ${index + 1}`, labels: ['tpnil-initial-conformance-reserve'] })
    report.payments.push({ index, publicKey, derivationPrefix, derivationSuffix, txid: payment.txid, beef: payment.tx, outpoint: `${payment.txid}.0`, submissionIndex, internalized })
  }
  report.storageSnapshot = await readNativeReserveStorage(wallet, services)
  report.completedAt = new Date().toISOString()
  evidence.addJson('conformance/funding-reserves.json', report)
  return report
}

export async function prepareNativeConformanceReserves(context: NativeScenarioContext): Promise<void> {
  await prepareConformanceReserves({ wallet: nativeWalletBoundary(context.application, true), services: context.services, evidence: context.evidence })
}
