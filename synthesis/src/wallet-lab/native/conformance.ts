import type { NativeScenarioContext } from '../yours-driver.js'
import { aggregateOutcome, type VectorResult, type VectorOutcome } from '../model.js'
import { runNativePermissionConformance } from './conformance-permissions.js'
import { lifecycleOracleId, runConformanceLifecycle } from './conformance-lifecycle.js'
import { runNativePortability } from './conformance-portability.js'
import { nativeWalletBoundary, runNativeIntegration } from './integrated.js'
import { runNativeClauseConformance } from './conformance-clauses.js'
import { todoSubmissionBinding } from './todo-submission-binding.js'

function vector(id: VectorResult['id'], report: any, file: string, limitations: string[] = []): VectorResult {
  const assertions = report.assertions.map((row: any) => ({ id: row.id, outcome: row.result as VectorOutcome, detail: row.detail ?? 'Independent predicate is retained with its raw observations.', evidence: [file] }))
  const outcome: VectorOutcome = assertions.some((row: any) => row.outcome === 'FAIL') ? 'FAIL' : assertions.some((row: any) => row.outcome === 'BLOCKED') ? 'BLOCKED' : assertions.length > 0 && assertions.every((row: any) => row.outcome === 'PASS') ? 'PASS' : 'INCONCLUSIVE'
  return { id, outcome, assertions, limitations }
}

export async function runNativeConformance(context: NativeScenarioContext, coverage = false, closure = false): Promise<{ vectors: VectorResult[] }> {
  coverage = coverage || closure
  const { application, services, evidence, baselineVectors } = context
  const profile = closure ? 'ITCVE-1@2.0.0' : coverage ? 'ITCVE-1@1.5.0' : 'ITCVE-1@1.4.0'
  const program = closure ? 'ISI-4@4.0.0' : coverage ? 'ISI-4@3.0.0' : 'ISI-4@2.0.0'
  const wallet = nativeWalletBoundary(application, true)
  const permission = await context.manualPrompt(() => runNativePermissionConformance({ context: context.context, evidence, extensionId: context.extensionId, trustedClick: closure }))
  const lifecycle = await runConformanceLifecycle(wallet, services, { receiptMode: 'storage-rpc', oracle: lifecycleOracleId, submissionBinding: todoSubmissionBinding })
  evidence.addJson('conformance/lifecycle.json', lifecycle)
  const portability = await runNativePortability({ application, services, evidence, password: context.password, oracle: coverage ? 'tpnil-native-portability-oracle@3.0.0' : 'tpnil-native-portability-oracle@2.0.0' })
  let clauses: any
  await runNativeIntegration({ application, services, evidence, profile, beforeTrustRestore: async boundaryReport => {
    clauses = await runNativeClauseConformance({ wallet, evidence, boundaryReport, ...(coverage ? { oracle: 'tpnil-brc100-clause-oracle@4.0.0' as const } : {}) })
  } })
  if (!clauses) throw new Error('Native clause scenario did not execute')
  const permissionLifecycle = coverage ? await context.manualPrompt(async () => (await import('./conformance-permission-lifecycle.js')).runNativePermissionLifecycle(context, { trustedClick: closure })) : undefined
  if (permissionLifecycle) evidence.addJson('conformance/permission-lifecycle.json', permissionLifecycle)
  const vectors = structuredClone(baselineVectors)
  vectors[4] = vector('ISI-4-V005', permission, 'conformance/permissions.json', ['Visible native permission UI and public CWI; other wallet substrates retain separate admission.'])
  if (permissionLifecycle) {
    const added = vector('ISI-4-V005', permissionLifecycle, 'conformance/permission-lifecycle.json')
    vectors[4] = { ...vectors[4]!, assertions: [...vectors[4]!.assertions, ...added.assertions], outcome: aggregateOutcome([vectors[4]!, added]) }
  }
  const stronger = vector('ISI-4-V006', lifecycle, 'conformance/lifecycle.json')
  vectors[5] = { ...vectors[5]!, assertions: [...vectors[5]!.assertions, ...stronger.assertions.map(row => ({ ...row, id: `public-api/${row.id}` }))], outcome: aggregateOutcome([vectors[5]!, stronger]) }
  vectors[6] = vector('ISI-4-V007', portability, 'conformance/portability.json', ['Native configured counterpart replacement; portable file formats and other wallets are separate profiles.'])
  vectors[7] = vector('ISI-4-V008', clauses, 'conformance/clauses.json', ['The clause coverage inventory retains unexecuted obligations as BLOCKED; method execution alone cannot establish complete BRC-100 conformance.'])
  evidence.addJson('conformance/result.json', { schema: closure ? 'tpnil-native-conformance@4.0.0' : coverage ? 'tpnil-native-conformance@3.0.0' : 'tpnil-native-conformance@2.0.0', profile, program, claim: 'ENGINEERING_OBSERVATION_ONLY', vectors, outcome: aggregateOutcome(vectors) })
  return { vectors }
}
