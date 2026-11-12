import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { Beef, Transaction, UnlockingScript } from '@bsv/sdk'
import { expect, it } from 'vitest'
import { verifyCoverageNativeTransactions } from '../src/wallet-lab/native/verify-conformance-coverage-transactions.js'

const root = path.resolve(import.meta.dirname, '../..')
const archive = path.join(root, 'journals/integrated-native-attempts/2026-11-09/42680240116/native-integrated.zip')
expect(createHash('sha256').update(fs.readFileSync(archive)).digest('hex')).toBe('264ba858b5618574c3aea189425d22c5cbb47c91a1ae361b618609cc17d38e49')
const bytes = (name: string) => execFileSync('unzip', ['-p', archive, `repetition-1/evidence/${name}`], { maxBuffer: 16 * 1024 * 1024 })
const read = (name: string) => JSON.parse(bytes(name).toString())
const report = read('conformance/portability.json'), reserves = read('conformance/funding-reserves.json')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/teranode/wab-funding-v1.json'), 'utf8'))
const funding = Transaction.fromAtomicBEEF([...bytes('funding.atomicbeef')])
const rows = [{ role: 'setup-basket', txid: report.task.txid, atomicBeef: [...Buffer.from(report.task.beefHex, 'hex')] }]
const storageTransactions = new Map<string, Transaction>(read('native-transactions.json').map((row: any) => [row.txid, Transaction.fromHex(row.rawTxHex)]))
const binding = { storageTransactions, fixture, declaredNativePayments: [`${funding.id('hex')}.0`, ...reserves.payments.map((row: any) => row.outpoint)] }

it('binds a real signed native transaction to independent storage bytes and all declared native funding branches', async () => {
  expect(await verifyCoverageNativeTransactions(rows, binding)).toEqual({ verified: true, transactions: [{ role: rows[0]!.role, txid: rows[0]!.txid }] })
  expect(await verifyCoverageNativeTransactions([], binding)).toEqual({ verified: true, transactions: [] })
})
it('rejects duplicate or unsafe roles, duplicate txids and malformed Atomic BEEF', async () => {
  for (const role of ['', '../escape', 'a//b', 'a..b', '/absolute', 'a\u0000b', 'A', 'a'.repeat(129)]) await expect(verifyCoverageNativeTransactions([{ ...rows[0]!, role }], binding)).rejects.toThrow()
  await expect(verifyCoverageNativeTransactions([rows[0]!, { ...rows[0]!, role: 'other' }], binding)).rejects.toThrow('Duplicate coverage transaction identity')
  await expect(verifyCoverageNativeTransactions([rows[0]!, { ...rows[0]!, txid: 'ab'.repeat(32) }], binding)).rejects.toThrow('Duplicate coverage transaction role')
  for (const atomicBeef of [[], [1, 2, 3], [...rows[0]!.atomicBeef, 0], [-1, ...rows[0]!.atomicBeef], new Array(4)]) await expect(verifyCoverageNativeTransactions([{ ...rows[0]!, atomicBeef }], binding)).rejects.toThrow()
})
it('rejects missing or rebound storage bytes and any undeclared/faucet funding root', async () => {
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, storageTransactions: new Map() })).rejects.toThrow('storage transaction bytes')
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, storageTransactions: new Map([[rows[0]!.txid, funding]]) })).rejects.toThrow()
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, declaredNativePayments: [] })).rejects.toThrow('outside independently declared')
  // This is a valid signed faucet-to-native payment, not an invented invalid input.
  // Its ancestry belongs to the faucet before the admitted native payment boundary.
  await expect(verifyCoverageNativeTransactions([{ role: 'faucet-extra', txid: funding.id('hex'), atomicBeef: funding.toAtomicBEEF() }], binding)).rejects.toThrow('outside independently declared')
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, declaredNativePayments: [`${'ab'.repeat(32)}.0`] })).rejects.toThrow('outside independently declared')
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, declaredNativePayments: [`${fixture.txid}.0`] })).rejects.toThrow('mined faucet')
  await expect(verifyCoverageNativeTransactions(rows, { ...binding, fixture: { ...fixture, txid: 'ab'.repeat(32) } })).rejects.toThrow('admitted mined root')
})
it('rejects forged proof heights and invalid signatures even after txid/storage bindings are rebound', async () => {
  const graph = Beef.fromBinary(rows[0]!.atomicBeef); graph.bumps[0]!.blockHeight++
  await expect(verifyCoverageNativeTransactions([{ ...rows[0]!, atomicBeef: graph.toBinaryAtomic(rows[0]!.txid) }], binding)).rejects.toThrow()
  const tx = Transaction.fromAtomicBEEF(rows[0]!.atomicBeef)
  const changed = new Transaction(tx.version, tx.inputs.map((input, index) => ({ ...input, ...(index === 0 ? { unlockingScript: UnlockingScript.fromHex('00') } : {}) })), tx.outputs, tx.lockTime)
  const txid = changed.id('hex'), atomicBeef = changed.toAtomicBEEF()
  const storage = new Map(storageTransactions); storage.set(txid, Transaction.fromHex(changed.toHex()))
  await expect(verifyCoverageNativeTransactions([{ role: 'setup-basket', txid, atomicBeef }], { ...binding, storageTransactions: storage })).rejects.toThrow()
})
