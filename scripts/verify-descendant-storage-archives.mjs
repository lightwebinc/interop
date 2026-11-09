import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { extractZipSafely } from './verify-published-integrations.mjs'

const repository = path.resolve(import.meta.dirname, '..')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
function files(directory) {
  assert(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink())
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Archive inventory cannot contain symlinks')
    if (entry.isDirectory()) result.push(...files(path.join(directory, entry.name)).map(name => `${entry.name}/${name}`))
    else { assert(entry.isFile()); result.push(entry.name) }
  }
  return result.sort()
}
function safe(name) {
  assert.equal(typeof name, 'string')
  assert(/^[A-Za-z0-9_.@/-]+$/.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe retained path')
  return name
}
function member(directory, name) {
  const bytes = fs.readFileSync(path.join(directory, safe(name)))
  return { path: name, size: bytes.length, sha256: hash(bytes) }
}

export function verifyDescendantArchive(directory, { root = repository, semantic = false } = {}) {
  const provenance = read(path.join(directory, 'provenance.json'))
  assert.equal(provenance.schema, 'tpnil-descendant-storage-ci-archive@1')
  assert.match(provenance.source, /^[a-f0-9]{40}$/)
  assert.equal(new Set(provenance.files.map(row => row.path)).size, provenance.files.length)
  assert.deepEqual(provenance.files.map(row => safe(row.path)).sort(), files(directory).filter(name => name !== 'provenance.json'))
  for (const row of provenance.files) assert.deepEqual(member(directory, row.path), row)
  const qualification = read(path.join(directory, 'qualification.json'))
  assert.equal(qualification.schema, 'tpnil-descendant-storage-ci-qualification@1')
  assert.equal(qualification.claim, 'ENGINEERING_REFERENCE_STORAGE_QUALIFICATION_ONLY')
  assert.equal(qualification.nativeQualification, false)
  assert.equal(qualification.source, provenance.source)
  assert.equal(qualification.workflowRun, provenance.workflowRun)
  const run = read(path.join(directory, 'run.json'))
  assert.equal(run.id, provenance.workflowRun); assert.equal(run.head_sha, provenance.source)
  assert.equal(run.conclusion, 'success'); assert.equal(qualification.workflowConclusion, run.conclusion)
  const artifact = read(path.join(directory, 'artifacts.json')).artifacts.find(row => row.id === provenance.artifactId)
  assert(artifact); assert.equal(artifact.name, 'descendant-storage-sync')
  const zip = member(directory, 'descendant-storage-sync.zip')
  assert.equal(artifact.size_in_bytes, zip.size); assert.equal(artifact.digest, `sha256:${zip.sha256}`)
  assert.equal(qualification.artifact.id, artifact.id); assert.equal(qualification.artifact.bytes, zip.size); assert.equal(qualification.artifact.sha256, zip.sha256)
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-descendant-archive-'))
  try {
    const output = path.join(temporary, 'evidence'); fs.mkdirSync(output)
    extractZipSafely(fs.readFileSync(path.join(directory, zip.path)), output)
    assert.deepEqual(qualification.members.slice().sort((a, b) => a.path.localeCompare(b.path)), files(output).map(name => member(output, name)).sort((a, b) => a.path.localeCompare(b.path)))
    const matrix = read(path.join(output, 'matrix.json'))
    assert.equal(matrix.sourceCommit, provenance.source); assert.equal(matrix.sourceDirty, false)
    assert.equal(matrix.result, 'PASS'); assert.equal(matrix.runs.length, 8)
    assert.deepEqual(qualification.inputs, matrix.inputs)
    assert.deepEqual(qualification.runs, matrix.runs.map(row => ({ name: row.name, repetition: row.repetition, source: row.source, destination: row.destination, result: row.result, identity: row.verification.identity, assertions: row.verification.assertions, report: row.report, log: row.log })))
    const assertions = matrix.runs.flatMap(row => row.verification.assertions)
    assert.deepEqual(qualification.assertions, { total: assertions.length, PASS: assertions.filter(row => row.result === 'PASS').length, FAIL: assertions.filter(row => row.result === 'FAIL').length, BLOCKED: assertions.filter(row => row.result === 'BLOCKED').length })
    assert.equal(qualification.assertions.total, 80); assert.equal(qualification.assertions.PASS, 80)
    assert.equal(qualification.freshExecutions, 8); assert.equal(qualification.directions, 4)
    assert.equal(qualification.distinctIdentities, 8)
    assert.equal(qualification.distinctIdentities, new Set(qualification.runs.map(row => row.identity)).size)
    assert.equal(new Set(qualification.runs.map(row => `${row.source}-to-${row.destination}`)).size, 4)
    for (const row of matrix.runs) {
      const report = read(path.join(output, safe(row.report.file)))
      for (const component of Object.values(report.components)) if (component.components.storage === 'go') assert.equal(component.go.binarySha256, qualification.binarySha256)
    }
    if (semantic) {
      // Use exact retained Git source, never rewrite the current checkout or
      // disable the matrix verifier's source-byte checks. No service starts.
      const source = path.join(temporary, 'source'); fs.mkdirSync(source)
      const paths = ['package.json', 'scripts', 'synthesis', 'infra', 'fixtures']
      const tree = execFileSync('git', ['ls-tree', '-r', '-z', provenance.source, '--', ...paths], { cwd: root }).toString().split('\0').filter(Boolean)
      for (const row of tree) {
        assert.match(row, /^100(?:644|755) blob [a-f0-9]{40}\t/, 'Frozen replay rejects links or non-file Git objects')
        safe(row.slice(row.indexOf('\t') + 1))
      }
      const archive = execFileSync('git', ['archive', '--format=tar', provenance.source, '--', ...paths], { cwd: root, maxBuffer: 128 * 1024 * 1024 })
      const unpacked = spawnSync('tar', ['-xf', '-', '-C', source], { input: archive }); assert.equal(unpacked.status, 0, String(unpacked.stderr))
      for (const [name, expected] of Object.entries(matrix.inputs)) {
        const bytes = fs.readFileSync(path.join(source, safe(name)))
        assert.equal(bytes.length, expected.bytes); assert.equal(hash(bytes), expected.sha256, `Retained input differs from frozen Git: ${name}`)
      }
      assert.equal(hash(fs.readFileSync(path.join(root, 'synthesis/package-lock.json'))), hash(fs.readFileSync(path.join(source, 'synthesis/package-lock.json'))), 'Install the frozen synthesis dependencies before replay')
      fs.symlinkSync(path.join(root, 'synthesis/node_modules'), path.join(source, 'synthesis/node_modules'), 'dir')
      const replay = spawnSync(process.execPath, [path.join(source, 'scripts/verify-descendant-storage-matrix.mjs'), output], { cwd: source, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
      assert.equal(replay.status, 0, `${replay.stderr}\n${replay.stdout}`)
    }
    return { source: provenance.source, workflowRun: provenance.workflowRun, members: qualification.members.length, assertions: qualification.assertions, semantic }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}

export function verifyDescendantArchives({ root = repository, semantic = false } = {}) {
  const directory = path.join(root, 'journals/descendant-storage-qualification')
  if (!fs.existsSync(directory)) return { archives: [] }
  const inventory = files(directory), prefixes = inventory.filter(name => name.endsWith('/provenance.json')).map(name => name.slice(0, -'provenance.json'.length))
  for (const name of inventory) assert.equal(prefixes.filter(prefix => name.startsWith(prefix)).length, 1, `Unmanifested or overlapping descendant archive: ${name}`)
  return { archives: prefixes.map(prefix => verifyDescendantArchive(path.join(directory, prefix), { root, semantic })) }
}
if (process.argv[1] === import.meta.filename) {
  assert(process.argv.slice(2).every(value => value === '--semantic'))
  console.log(JSON.stringify(verifyDescendantArchives({ semantic: process.argv.includes('--semantic') }), null, 2))
}
