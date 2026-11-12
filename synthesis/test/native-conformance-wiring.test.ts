import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { nativeWalletBoundary } from '../src/wallet-lab/native/integrated.js'
import { permissionAssertionIds } from '../src/wallet-lab/native/conformance-permissions-model.js'
import { portabilityAssertions } from '../src/wallet-lab/native/conformance-portability.js'
import { clauseAssertionIds, clauseOracle4AssertionIds } from '../src/wallet-lab/native/conformance-clauses-model.js'

import { permissionLifecycleAssertionIds, permissionLifecycleOracle } from '../src/wallet-lab/native/conformance-permission-lifecycle-model.js'

const root = path.resolve(import.meta.dirname, '../..')
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))

it('freezes the new native inputs and every scenario assertion without altering the previous plan', () => {
  const plan = read('infra/native/conformance/plan.json')
  expect(plan.itcve).toBe('ITCVE-1@1.4.0'); expect(plan.program).toBe('ISI-4@2.0.0')
  expect(plan.fixtureSubmissionPolicy).toBe('terminal-rejection-v1')
  expect(Object.keys(plan.conformanceInputs).sort()).toEqual(['itcves/ITCVE-1/1.4.0/profile.json', 'programs/ISI-4/2.0.0/catalog.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/brc100-contract.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/oracle-3.0.0.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/lifecycle-oracle-3.0.0.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/portability-oracle-2.0.0.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/todo-submission-binding-1.0.0.json'].sort())
  expect(plan.clauseOracle).toBe('tpnil-brc100-clause-oracle@3.0.0')
  expect(plan.lifecycleOracle).toBe('tpnil-native-lifecycle-oracle@3.0.0')
  expect(plan.portabilityOracle).toBe('tpnil-native-portability-oracle@2.0.0')
  expect(plan.todoSubmissionBinding).toBe('tpnil-native-todo-submission-binding@1.0.0')
  expect(plan.compatibilityPatch).toBe('infra/adapters/storage-portability/patch.lock.json')
  expect(createHash('sha256').update(fs.readFileSync(path.join(root, plan.compatibilityPatch))).digest('hex')).toBe(plan.compatibilityPatchSha256)
  expect(fs.readFileSync(path.join(root, 'synthesis/src/wallet-lab/native/worker.ts'), 'utf8')).toContain("binary: '/opt/tpnil/itcve-go-storage-portability', storagePortabilityPatch: true")
  const lifecycle = read('programs/ISI-4/profiles/native-conformance-2.0.0/lifecycle-oracle-3.0.0.json')
  expect(lifecycle.id).toBe(plan.lifecycleOracle)
  expect(lifecycle.unorderedFields).toEqual(['listOutputs.outputs[].labels', 'listOutputs.outputs[].tags'])
  expect(lifecycle.source.sha256).toBe(read('programs/ISI-4/profiles/native-conformance-2.0.0/brc100-contract.json').source.sha256)
  expect(read('itcves/ITCVE-1/1.4.0/profile.json').nativeConformance.lifecycleOracle).toBe(plan.lifecycleOracle)
  for (const [file, digest] of Object.entries(plan.conformanceInputs)) expect(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).toBe(digest)
  const profile = read('itcves/ITCVE-1/1.4.0/profile.json')
  expect(profile.nativeConformance.assertions['ISI-4-V005']).toEqual(permissionAssertionIds)
  expect(profile.nativeConformance.assertions['ISI-4-V006']).toEqual(['accepted-service-verdict-observed', 'rejection-preserves-wallet-state', 'post-rejection-recovery'])
  expect(profile.nativeConformance.assertions['ISI-4-V007']).toEqual(portabilityAssertions)
  expect(profile.nativeConformance.assertions['ISI-4-V008']).toEqual(clauseAssertionIds)
  const historical = read('infra/native/integrated/plan-trusted.json')
  expect(historical.itcve).toBe('ITCVE-1@1.3.0'); expect(historical.program).toBe('ISI-4@1.0.0')
  expect(historical.fixtureSubmissionPolicy).toBeUndefined(); expect(historical.conformanceInputs).toBeUndefined()
})

// The page callback runs in an isolated JS realm with a structured JSON boundary,
// so this checks the actual serialization code, not a second error implementation.
const page = (CWI: any) => ({ evaluate: async (callback: Function, args: unknown) => {
  const value = await runInNewContext(`(${callback.toString()})(input)`, { window: { CWI }, input: structuredClone(args) })
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
} }) as any

it('preserves public transaction and typed errors across the native page boundary', async () => {
  const expected = { name: 'WERR_REVIEW_ACTIONS', message: 'Review terminal action', code: 'WERR_REVIEW_ACTIONS', txid: 'ab'.repeat(32), tx: [1, 2, 3], reviewActionResults: [{ txid: 'ab'.repeat(32), status: 'invalidTx' }], sendWithResults: [{ txid: 'ab'.repeat(32), status: 'failed' }] }
  const wallet = nativeWalletBoundary(page({ createAction: async () => { throw Object.assign(new Error(expected.message), expected) } }), true)
  await expect(wallet.createAction({ description: 'fixture operation' })).rejects.toMatchObject(expected)
})

it('keeps legacy success values and prospective success values identical', async () => {
  const application = page({ listOutputs: async (args: any) => ({ totalOutputs: 1, outputs: [{ outpoint: `${'ab'.repeat(32)}.0`, basket: args.basket }] }) })
  const legacy = await nativeWalletBoundary(application).listOutputs({ basket: 'observed' })
  expect(await nativeWalletBoundary(application, true).listOutputs({ basket: 'observed' })).toEqual(legacy)
})

it('binds the additional native profile to its complete inventory and separate acceptance inputs', () => {
  const plan = read('infra/native/conformance/plan-coverage.json'), profile = read('itcves/ITCVE-1/1.5.0/profile.json')
  expect(plan.itcve).toBe('ITCVE-1@1.5.0'); expect(plan.program).toBe('ISI-4@3.0.0')
  expect(plan.clauseOracle).toBe('tpnil-brc100-clause-oracle@4.0.0')
  expect(plan.permissionLifecycleOracle).toBe(permissionLifecycleOracle)
  expect(plan.portabilityOracle).toBe('tpnil-native-portability-oracle@3.0.0')
  expect(profile.nativeConformance.portabilityOracle).toBe(plan.portabilityOracle)
  expect(Object.keys(plan.conformanceInputs)).toHaveLength(8)
  for (const [file, digest] of Object.entries(plan.conformanceInputs)) expect(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).toBe(digest)
  expect(profile.nativeConformance.assertions['ISI-4-V005']).toEqual([...permissionAssertionIds, ...permissionLifecycleAssertionIds])
  expect(profile.nativeConformance.assertions['ISI-4-V008']).toEqual(clauseOracle4AssertionIds)
  expect(clauseOracle4AssertionIds).toHaveLength(233)
  expect(profile.completeBRC100Conformance).toBe(false)
  const inherited = read('infra/native/conformance/plan.json')
  expect(plan.wallet).toEqual(inherited.wallet); expect(plan.application).toEqual(inherited.application)
  expect(plan.fundingReserves).toEqual(inherited.fundingReserves)
  expect(plan.compatibilityPatchSha256).toBe(inherited.compatibilityPatchSha256)
  expect(inherited.clauseOracle).toBe('tpnil-brc100-clause-oracle@3.0.0')
  expect(inherited.permissionLifecycleOracle).toBeUndefined()
})

it('requires a separate closure profile and preserves the executed 1.5 compatibility set', () => {
  const plan = read('infra/native/conformance/plan-coverage-closure.json'), profile = read('itcves/ITCVE-1/2.0.0/profile.json')
  expect(plan.id).toBe('YOURS-5.1.0-GO-ITCVE-1-V2.0.0-CONFORMANCE-CLOSURE')
  expect(plan.itcve).toBe('ITCVE-1@2.0.0'); expect(plan.program).toBe('ISI-4@4.0.0')
  expect(plan.permissionOracle).toBe('tpnil-native-permission-oracle@2.0.0')
  expect(plan.permissionLifecycleOracle).toBe('tpnil-native-permission-lifecycle-oracle@2.0.0')
  expect(plan.shutdownSubmissionPolicy).toBe('tpnil-native-shutdown-submissions@1.0.0')
  expect(plan.clauseOracle).toBe('tpnil-brc100-clause-oracle@4.0.0'); expect(plan.portabilityOracle).toBe('tpnil-native-portability-oracle@3.0.0')
  expect(Object.keys(plan.conformanceInputs)).toHaveLength(10)
  for (const [file, digest] of Object.entries(plan.conformanceInputs)) expect(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).toBe(digest)
  for (const key of ['permissionOracle', 'permissionLifecycleOracle', 'shutdownSubmissionPolicy', 'clauseOracle', 'portabilityOracle']) expect(profile.nativeConformance[key]).toBe(plan[key])
  for (const name of ['permission-oracle-2.0.0.json', 'permission-lifecycle-oracle-2.0.0.json', 'shutdown-submissions-1.0.0.json']) expect(Object.keys(plan.conformanceInputs)).toContain(`programs/ISI-4/profiles/native-conformance-4.0.0/${name}`)
  const historical = read('itcves/ITCVE-1/1.5.0/profile.json'), oldPlan = read('infra/native/conformance/plan-coverage.json')
  expect(profile.nativeConformance.assertions).toEqual(historical.nativeConformance.assertions)
  expect(plan.wallet).toEqual(oldPlan.wallet); expect(plan.application).toEqual(oldPlan.application); expect(plan.fundingReserves).toEqual(oldPlan.fundingReserves)
  expect(oldPlan.permissionOracle).toBeUndefined(); expect(oldPlan.permissionLifecycleOracle).toBe('tpnil-native-permission-lifecycle-oracle@1.0.0'); expect(oldPlan.shutdownSubmissionPolicy).toBeUndefined()
  expect(Object.keys(oldPlan.conformanceInputs)).toHaveLength(8)
  const catalog = read('programs/ISI-4/4.0.0/catalog.json'), oldCatalog = read('programs/ISI-4/3.0.0/catalog.json')
  expect(catalog.itcve.version).toBe('2.0.0'); expect(catalog.vectors[4].version).toBe('4.0.0')
  for (const index of [0, 1, 2, 3, 5, 6, 7]) expect(catalog.vectors[index].version).toBe(oldCatalog.vectors[index].version)
  const executedHashes: Record<string, string> = {
    "infra/native/conformance/plan-coverage.json": "ec37b83e25592af662b382cc5cc5da5e2238ffbdb7b4f00442d9b2bcfe229755",
    "itcves/ITCVE-1/1.5.0/profile.json": "1fe3565488a3745c9985bf273d8e59ab1890e651059b84d31fe15f152374f1c4",
    "programs/ISI-4/3.0.0/catalog.json": "b9ef1df78f846901df2782265bacfdf0bfc888bd666090ded68b540a4b257b0a"
  }
  for (const [file, digest] of Object.entries(executedHashes)) expect(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).toBe(digest)
})
