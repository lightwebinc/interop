import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
import { nativeWalletBoundary } from '../src/wallet-lab/native/integrated.js'
import { permissionAssertionIds } from '../src/wallet-lab/native/conformance-permissions-model.js'
import { portabilityAssertions } from '../src/wallet-lab/native/conformance-portability.js'
import { clauseAssertionIds } from '../src/wallet-lab/native/conformance-clauses-model.js'

const root = path.resolve(import.meta.dirname, '../..')
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))

it('freezes the new native inputs and every scenario assertion without altering the previous plan', () => {
  const plan = read('infra/native/conformance/plan.json')
  expect(plan.itcve).toBe('ITCVE-1@1.4.0'); expect(plan.program).toBe('ISI-4@2.0.0')
  expect(plan.fixtureSubmissionPolicy).toBe('terminal-rejection-v1')
  expect(Object.keys(plan.conformanceInputs).sort()).toEqual(['itcves/ITCVE-1/1.4.0/profile.json', 'programs/ISI-4/2.0.0/catalog.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/brc100-contract.json', 'programs/ISI-4/profiles/native-conformance-2.0.0/oracle-3.0.0.json'].sort())
  expect(plan.clauseOracle).toBe('tpnil-brc100-clause-oracle@3.0.0')
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
