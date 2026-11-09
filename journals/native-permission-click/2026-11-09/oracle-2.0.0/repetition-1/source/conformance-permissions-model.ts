import type { PermissionClickReceipt } from './permission-click.js'
export const permissionOracleV2 = 'tpnil-native-permission-oracle@2.0.0' as const
// SPDX-License-Identifier: Apache-2.0
export const permissionProtocol = [2, 'tpnil native permission v1'] as const
export const permissionOrigins = { primary: 'https://deny.itcve.test', alternate: 'https://alternate.itcve.test' } as const
export const permissionSteps = [
  { id: 'primary-unapproved', origin: permissionOrigins.primary, seekPermission: false },
  { id: 'primary-approve', origin: permissionOrigins.primary, seekPermission: true, decision: 'allow' },
  { id: 'primary-cached', origin: permissionOrigins.primary, seekPermission: false },
  { id: 'alternate-unapproved', origin: permissionOrigins.alternate, seekPermission: false },
  { id: 'alternate-deny', origin: permissionOrigins.alternate, seekPermission: true, decision: 'deny' },
  { id: 'alternate-after-denial', origin: permissionOrigins.alternate, seekPermission: false },
  { id: 'primary-after-denial', origin: permissionOrigins.primary, seekPermission: false },
  { id: 'alternate-approve', origin: permissionOrigins.alternate, seekPermission: true, decision: 'allow' },
  { id: 'alternate-cached', origin: permissionOrigins.alternate, seekPermission: false }
] as const
export const permissionAssertionIds = [
  'fresh-consent-required', 'approve-pending-request', 'origin-grant-isolation',
  'deny-pending-request', 'denial-does-not-grant', 'existing-grant-preserved',
  'approval-recovery', 'cleanup'
].map(id => `permissions.${id}`)
export type PermissionDecision = 'allow' | 'deny'
export function permissionArgs(seekPermission: boolean) {
  return { protocolID: [...permissionProtocol], keyID: 'origin-isolation', counterparty: 'anyone', forSelf: true, seekPermission }
}
export interface PermissionStepObservation {
  id: string
  origin: string
  pageUrl: string
  method: 'getPublicKey'
  args: ReturnType<typeof permissionArgs>
  requestNonce?: string
  startedAt: string
  endedAt: string
  outcome: ({ status: 'fulfilled'; value: { publicKey: string }; settledAt: string } | { status: 'rejected'; error: { name: string; message: string }; settledAt: string } | { status: 'timeout' | 'observer-error'; message: string }) & { requestNonce?: string }
  prompts: Array<{
    url: string; body: string; observedAt: string; pendingBeforeDecision: boolean
    decision: PermissionDecision; button: string; clickedAt: string; clickCompletedAt: string
    screenshot: { name: string; sha256: string; size: number }; trustedClick?: PermissionClickReceipt
  }>
}
export interface PermissionConformanceReport {
  schema: 'tpnil-native-permission-conformance@1' | 'tpnil-native-permission-conformance@2'
  oracle?: typeof permissionOracleV2
  claim: 'ENGINEERING_OBSERVATION_ONLY'
  vector: 'ISI-4-V005'
  interface: 'unchanged native wallet public CWI and visible permission UI'
  extensionId: string
  steps: PermissionStepObservation[]
  assertions: Array<{ id: string; result: 'PASS' | 'FAIL'; detail: string }>
  result: 'PASS' | 'FAIL'
  cleanup: { applicationPagesClosed: boolean; ownedPromptsClosed: boolean }
}
