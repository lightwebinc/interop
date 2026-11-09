import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { verifyDescendantFundingReport } = await import('../synthesis/src/storage-sync/verify-descendant.ts')
const { descendantInputs } = await import('../synthesis/src/storage-sync/descendant-inputs.ts')
const { validateComponentIdentity } = await import('../synthesis/src/wallet-lab/go-services.ts')
const { PrivateKey } = await import('../synthesis/node_modules/@bsv/sdk/dist/esm/mod.js')
const root = path.resolve(import.meta.dirname, '..'), output = path.resolve(process.argv[2] ?? 'out/descendant-storage-sync')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const matrix = JSON.parse(fs.readFileSync(path.join(output, 'matrix.json')))
assert.equal(matrix.schema, 'tpnil-descendant-storage-matrix@1'); assert.equal(matrix.claim, 'ENGINEERING_REFERENCE_STORAGE_QUALIFICATION_ONLY')
assert.deepEqual(Object.keys(matrix.inputs).sort(), [...descendantInputs].sort())
assert.equal(matrix.result, 'PASS'); assert.equal(matrix.runs.length, 8)
for (const [file, expected] of Object.entries(matrix.inputs)) {
  assert.ok(!file.includes('..') && !path.isAbsolute(file))
  const bytes = fs.readFileSync(path.join(output, 'source-inputs', file))
  assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256)
  assert.equal(sha(fs.readFileSync(path.join(root, file))), expected.sha256, `Replay requires the recorded source revision: ${file}`)
}
const tsManifestPath = 'infra/adapters/storage-portability/typescript-descendant-export.json', goManifestPath = 'infra/adapters/storage-portability/patch.lock.json'
const tsManifest = JSON.parse(fs.readFileSync(path.join(output, 'source-inputs', tsManifestPath)))
const goManifest = JSON.parse(fs.readFileSync(path.join(output, 'source-inputs', goManifestPath)))
const seen = new Set(), identities = new Set(), transactions = new Set(), groups = new Map()
let binarySha
for (const row of matrix.runs) {
  assert.equal(row.name, `${row.source}-to-${row.destination}/rep-${row.repetition}`); assert.ok(!seen.has(row.name)); seen.add(row.name)
  assert.ok(['typescript', 'go'].includes(row.source) && ['typescript', 'go'].includes(row.destination) && [1, 2].includes(row.repetition))
  assert.equal(row.status, 0); assert.equal(row.signal, null); assert.equal(row.result, 'PASS')
  assert.equal(row.report.file, `${row.name}/observations.json`); assert.equal(row.log.file, `${row.name}.log`)
  for (const item of [row.report, row.log]) { const bytes = fs.readFileSync(path.join(output, item.file)); assert.equal(bytes.length, item.bytes); assert.equal(sha(bytes), item.sha256) }
  const report = JSON.parse(fs.readFileSync(path.join(output, row.report.file)))
  assert.equal(report.configuration.source, row.source); assert.equal(report.configuration.destination, row.destination)
  assert.equal(report.identity, PrivateKey.fromHex(row.fixtureOwnerKey).toPublicKey().toString())
  assert.ok(!identities.has(report.identity)); identities.add(report.identity)
  for (const [role, implementation] of [['source', row.source], ['destination', row.destination]]) {
    const component = report.components[role]; assert.equal(component.components.storage, implementation)
    if (implementation === 'typescript') {
      assert.equal(component.typescriptStorageAdapter.id, tsManifest.id)
      assert.equal(component.typescriptStorageAdapter.manifestSha256, matrix.inputs[tsManifestPath].sha256)
      assert.deepEqual(component.typescriptStorageAdapter.adapter, tsManifest.adapter)
      assert.deepEqual(component.typescriptStorageAdapter.upstream, tsManifest.upstream)
    } else {
      validateComponentIdentity(component, 'ITCVE-1@1.4.0')
      const build = component.go.compatibilityPatch
      assert.equal(build.schema, 'tpnil-storage-portability-go-build@1.0.0')
      assert.equal(build.patchLockSha256, matrix.inputs[goManifestPath].sha256); assert.equal(build.patchSha256, goManifest.patchSha256)
      assert.equal(component.go.binarySha256, build.binarySha256)
      binarySha ??= build.binarySha256; assert.equal(build.binarySha256, binarySha)
    }
  }
  const verified = await verifyDescendantFundingReport(report)
  assert.deepEqual(verified, row.verification)
  for (const txid of verified.transactions) { assert.ok(!transactions.has(txid), 'Fresh runs reused a transaction'); transactions.add(txid) }
  const key = `${row.source}-to-${row.destination}`, projection = verified.assertions
  if (groups.has(key)) assert.deepEqual(groups.get(key), projection, 'Independent repetitions differ semantically')
  else groups.set(key, projection)
}
assert.equal(groups.size, 4)
console.log(JSON.stringify({ verified: true, result: 'PASS', directions: 4, freshExecutions: 8, independentIdentities: identities.size, assertions: 80, binarySha256: binarySha, sourceCommit: matrix.sourceCommit, claim: matrix.claim }, null, 2))
