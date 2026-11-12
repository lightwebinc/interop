// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const directory = import.meta.dirname, root = path.resolve(directory, '../../../..')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
const provenance = read('provenance.json'), receipt = read('preflight-review.json')
for (const [name, entry] of Object.entries(provenance.files)) {
  const stored = fs.readFileSync(path.join(directory, name)), original = name.endsWith('.gz') ? gunzipSync(stored) : stored
  assert.equal(stored.length, entry.size); assert.equal(hash(stored), entry.sha256)
  assert.equal(original.length, entry.originalSize); assert.equal(hash(original), entry.originalSha256)
}
for (const [name, digest] of Object.entries(receipt.checkerSources)) assert.equal(hash(fs.readFileSync(path.join(root, name))), digest)
const { register } = await import(path.join(root, 'synthesis/node_modules/tsx/dist/esm/api/index.mjs')); register()
const { verifyNoSendChangeFixture } = await import(path.join(root, 'synthesis/src/wallet-lab/native/verify-conformance-nosend-change.ts'))
const { deriveClauseOutcomes } = await import(path.join(root, 'synthesis/src/wallet-lab/native/verify-conformance-clauses.ts'))
const { noSendChangeInputId, noSendChangeOutputId } = await import(path.join(root, 'synthesis/src/wallet-lab/native/conformance-nosend-change.ts'))
const results = []
for (const name of ['typescript-reference.json.gz', 'go-reference.json.gz', 'native-macos-engineering.json.gz']) {
  const report = JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, name))))
  const anchor = await verifyNoSendChangeFixture(report)
  const assertions = (await deriveClauseOutcomes(report)).filter(row => [noSendChangeInputId, noSendChangeOutputId].includes(row.id)).map(({ id, result }) => ({ id, result }))
  assert.deepEqual(assertions, report.assertions.map(({ id, result }) => ({ id, result })))
  results.push({ name, txid: anchor.txid, assertions })
}
console.log(JSON.stringify({ verified: true, claim: 'ENGINEERING_OBSERVATION_ONLY', nativeLinuxQualification: false, results }))
