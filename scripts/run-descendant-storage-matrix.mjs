import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync, execFileSync } from 'node:child_process'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { verifyDescendantFundingReport } = await import('../synthesis/src/storage-sync/verify-descendant.ts')
const root = path.resolve(import.meta.dirname, '..')
const output = path.resolve(process.argv[2] ?? 'out/descendant-storage-sync')
if (fs.existsSync(output)) throw new Error('Matrix output already exists; each attempt requires a fresh directory')
fs.mkdirSync(output, { recursive: true })
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const { descendantInputs: files } = await import('../synthesis/src/storage-sync/descendant-inputs.ts')
const inputs = Object.fromEntries(files.map(file => { const bytes = fs.readFileSync(path.join(root, file)); const target = path.join(output, 'source-inputs', file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); return [file, { sha256: sha(bytes), bytes: bytes.length }] }))
const matrix = { schema: 'tpnil-descendant-storage-matrix@1', claim: 'ENGINEERING_REFERENCE_STORAGE_QUALIFICATION_ONLY', startedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '', runtime: { node: process.version, platform: process.platform, arch: process.arch }, inputs, runs: [] }
for (const [source, destination] of [['typescript', 'typescript'], ['typescript', 'go'], ['go', 'typescript'], ['go', 'go']]) {
  for (let repetition = 1; repetition <= 2; repetition++) {
    const name = `${source}-to-${destination}/rep-${repetition}`, directory = path.join(output, name)
    fs.mkdirSync(path.dirname(directory), { recursive: true })
    // A distinct public fixture identity for every fresh execution (not a secret).
    const fixtureOwnerKey = (0x90 + matrix.runs.length).toString(16).repeat(32)
    const startedAt = new Date().toISOString()
    const run = spawnSync(process.execPath, ['scripts/run-descendant-storage-sync.mjs', source, destination, directory], { cwd: root, env: { ...process.env, TPNIL_DESCENDANT_PORTABILITY_PATCH: '1', TPNIL_DESCENDANT_TS_ADAPTER: '1', TPNIL_DESCENDANT_OWNER_KEY: fixtureOwnerKey }, timeout: 180_000, maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' })
    fs.writeFileSync(`${directory}.log`, `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.stack}\n` : ''}`)
    const row = { name, source, destination, repetition, fixtureOwnerKey, startedAt, endedAt: new Date().toISOString(), status: run.status, signal: run.signal, result: 'FAIL' }
    const reportPath = path.join(directory, 'observations.json')
    if (fs.existsSync(reportPath)) {
      const bytes = fs.readFileSync(reportPath), report = JSON.parse(bytes)
      row.report = { file: `${name}/observations.json`, sha256: sha(bytes), bytes: bytes.length }
      try { row.verification = await verifyDescendantFundingReport(report); row.result = run.status === 0 ? 'PASS' : 'FAIL' }
      catch (error) { row.verificationError = String(error) }
    } else row.verificationError = 'Worker did not produce observations.json'
    row.log = { file: `${name}.log`, sha256: sha(fs.readFileSync(`${directory}.log`)), bytes: fs.statSync(`${directory}.log`).size }
    matrix.runs.push(row)
    fs.writeFileSync(path.join(output, 'matrix.json'), JSON.stringify(matrix, null, 2) + '\n')
    console.log(JSON.stringify({ name, result: row.result, verificationError: row.verificationError }))
  }
}
matrix.endedAt = new Date().toISOString(); matrix.result = matrix.runs.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL'
fs.writeFileSync(path.join(output, 'matrix.json'), JSON.stringify(matrix, null, 2) + '\n')
if (matrix.result !== 'PASS') process.exitCode = 1
