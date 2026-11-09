import type { PermissionClickReceipt } from './permission-click.js'
export const permissionLifecycleOracleV2 = 'tpnil-native-permission-lifecycle-oracle@2.0.0' as const
export const permissionLifecycleOracle = 'tpnil-native-permission-lifecycle-oracle@1.0.0' as const
export const permissionLifecycleAssertionIds = [
  'basket-denial', 'basket-grant', 'basket-cache',
  'certificate-denial', 'certificate-grant', 'certificate-cache',
  'spending-denial', 'spending-grant', 'spending-one-shot',
  'single-revocation-ui', 'single-revocation-enforcement', 'single-revocation-isolation',
  'origin-revocation-ui', 'origin-revocation-enforcement', 'origin-isolation', 'cleanup'
].map(id => `permission-lifecycle.${id}`)
export const lifecyclePermissionConfig = {
  primary: 'https://deny.itcve.test', alternate: 'https://alternate.itcve.test', application: 'https://todo.itcve.test',
  basket: 'tpnil permission lifecycle v1', basketAmount: 3,
  certificateType: Buffer.alloc(32, 42).toString('base64'), certificateSerial: Buffer.alloc(32, 43).toString('base64'),
  fields: { name: 'TPNIL permission lifecycle subject', private: 'This field remains undisclosed' },
  verifierKeyHex: '55'.repeat(32), issuerKeyHex: '44'.repeat(32), paymentRecipientKeyHex: '33'.repeat(32),
  paymentSatoshis: 5, secondPaymentSatoshis: 7, requestTimeoutMs: 30_000
} as const
export type LifecyclePermissionDecision = 'allow' | 'deny'
export interface LifecyclePermissionStep {
  id: string; requestNonce?: string; origin: string; pageUrl: string; method: string; args: any; startedAt: string; endedAt: string
  outcome: { requestNonce?: string; status: 'fulfilled' | 'rejected' | 'timeout' | 'observer-error'; value?: any; error?: { name: string; message: string }; message?: string; settledAt?: string }
  prompts: Array<{ url: string; body: string; observedAt: string; pendingBeforeDecision: boolean; decision: LifecyclePermissionDecision; button: string; clickedAt: string; clickCompletedAt: string; screenshot: { name: string; sha256: string; size: number }; trustedClick?: PermissionClickReceipt }>
  submissionStart: number; submissionEnd: number
}
export interface NativePermissionLifecycleReport {
  schema: 'tpnil-native-permission-lifecycle@1.0.0' | 'tpnil-native-permission-lifecycle@2.0.0'; oracle: typeof permissionLifecycleOracle | typeof permissionLifecycleOracleV2
  claim: 'ENGINEERING_OBSERVATION_ONLY'; interface: 'unchanged native CWI and visible Settings Permissions UI'
  extensionId: string; identity: string; startedAt: string; endedAt: string; configuration: typeof lifecyclePermissionConfig
  certificate?: any; paymentScript?: string; setupOutpoint?: string; steps: LifecyclePermissionStep[]; ui: any[]
  submissions: Array<{ txid: string; verdict: string; beefHex: string }>; errors: string[]
  transactions: Array<{ role: 'setup-basket' | 'spending-allow'; txid: string; atomicBeef: number[] }>
  submissionWindow: { startIndex: number; endIndex: number; entries: Array<{ index: number; txid: string; verdict: string; serializedHex: string }> }
  assertions: Array<{ id: string; result: 'PASS' | 'FAIL'; detail: string }>; result: 'PASS' | 'FAIL'
  cleanup: { applicationPagesClosed: boolean; ownedPromptsClosed: boolean; settingsPageClosed: boolean }
}
