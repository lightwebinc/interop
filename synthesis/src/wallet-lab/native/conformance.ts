import type { NativeScenarioContext } from '../yours-driver.js'
import { aggregateOutcome, type VectorResult, type VectorOutcome } from '../model.js'
import { runNativePermissionConformance } from './conformance-permissions.js'
import { runConformanceLifecycle } from './conformance-lifecycle.js'
import { runNativePortability } from './conformance-portability.js'
import { nativeWalletBoundary, runNativeIntegration } from './integrated.js'
import { runNativeClauseConformance } from './conformance-clauses.js'

function vector(id: VectorResult['id'], report: any, file: string, limitations: string[] = []): VectorResult {
  const assertions = report.assertions.map((row: any) => ({ id: row.id, outcome: row.result as VectorOutcome, detail: row.detail ?? 'Independent predicate is retained with its raw observations.', evidence: [file] }))
  const outcome: VectorOutcome = assertions.some((row: any) => row.outcome === 'FAIL') ? 'FAIL' : assertions.some((row: any) => row.outcome === 'BLOCKED') ? 'BLOCKED' : assertions.length > 0 && assertions.every((row: any) => row.outcome === 'PASS') ? 'PASS' : 'INCONCLUSIVE'
  return { id, outcome, assertions, limitations }
}

export async function runNativeConformance(context: NativeScenarioContext): Promise<{ vectors: VectorResult[] }> {
  const { application, services, evidence, baselineVectors } = context
  const wallet = nativeWalletBoundary(application, true)
  const permission = await context.manualPrompt(() => runNativePermissionConformance({ context: context.context, evidence, extensionId: context.extensionId }))
  const lifecycle = await runConformanceLifecycle(wallet, services, { receiptMode: 'storage-rpc' })
  evidence.addJson('conformance/lifecycle.json', lifecycle)
  const portability = await runNativePortability({ application, services, evidence, password: context.password })
  let clauses: any
  await runNativeIntegration({ application, services, evidence, profile: 'ITCVE-1@1.4.0', beforeTrustRestore: async boundaryReport => {
    clauses = await runNativeClauseConformance({ wallet, evidence, boundaryReport })
  } })
  if (!clauses) throw new Error('Native clause scenario did not execute')
  const vectors = structuredClone(baselineVectors)
  vectors[4] = vector('ISI-4-V005', permission, 'conformance/permissions.json', ['Visible native permission UI and public CWI; other wallet substrates retain separate admission.'])
  const stronger = vector('ISI-4-V006', lifecycle, 'conformance/lifecycle.json')
  vectors[5] = { ...vectors[5]!, assertions: [...vectors[5]!.assertions, ...stronger.assertions.map(row => ({ ...row, id: `public-api/${row.id}` }))], outcome: aggregateOutcome([vectors[5]!, stronger]) }
  vectors[6] = vector('ISI-4-V007', portability, 'conformance/portability.json', ['Native configured counterpart replacement; portable file formats and other wallets are separate profiles.'])
  vectors[7] = vector('ISI-4-V008', clauses, 'conformance/clauses.json', ['The clause coverage inventory retains unexecuted obligations as BLOCKED; method execution alone cannot establish complete BRC-100 conformance.'])
  evidence.addJson('conformance/result.json', { schema: 'tpnil-native-conformance@2.0.0', profile: 'ITCVE-1@1.4.0', program: 'ISI-4@2.0.0', claim: 'ENGINEERING_OBSERVATION_ONLY', vectors, outcome: aggregateOutcome(vectors) })
  return { vectors }
}
