import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { extractZipSafely } from './verify-published-integrations.mjs'

const repository = path.resolve(import.meta.dirname, '..')
export const permissionReplayInputs = [
  'synthesis/package.json', 'synthesis/package-lock.json', 'synthesis/src/determinism.ts',
  'synthesis/src/wallet-lab/native/conformance-permissions-model.ts',
  'synthesis/src/wallet-lab/native/verify-conformance-permissions.ts',
  'synthesis/src/wallet-lab/native/conformance-permission-lifecycle-model.ts',
  'synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts',
  'fixtures/teranode/wab-funding-v1.json'
]
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
function inventory(directory) {
  assert(fs.lstatSync(directory).isDirectory() && !fs.lstatSync(directory).isSymbolicLink())
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'Evidence cannot contain links')
    if (entry.isDirectory()) return inventory(path.join(directory, entry.name)).map(name => `${entry.name}/${name}`)
    assert(entry.isFile()); return entry.name
  }).sort()
}
function member(directory, name) {
  assert(/^[A-Za-z0-9_.@/-]+$/.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'))
  const bytes = fs.readFileSync(path.join(directory, name))
  return { path: name, size: bytes.length, sha256: hash(bytes) }
}
export function verifyPermissionLifecycleArchive(directory, { root = repository, semantic = false } = {}) {
  const manifest = json(path.join(directory, 'manifest.json'))
  assert.equal(manifest.schema, 'tpnil-native-permission-lifecycle-engineering-archive@1')
  assert.equal(manifest.claim, 'NATIVE_MACOS_ENGINEERING_PREFLIGHT_ONLY')
  assert.equal(manifest.platform, 'darwin'); assert.equal(manifest.architecture, 'arm64')
  assert.deepEqual(manifest.assertions, { originalPermissions: 8, permissionLifecycle: 16 })
  assert.equal(new Set(manifest.files.map(row => row.path)).size, manifest.files.length)
  assert.deepEqual(manifest.files.map(row => row.path).sort(), inventory(directory).filter(name => !['manifest.json', 'README.md'].includes(name)))
  for (const row of manifest.files) assert.deepEqual(member(directory, row.path), row)
  assert.deepEqual(manifest.replayInputs, permissionReplayInputs)
  for (const name of permissionReplayInputs) assert(manifest.files.some(row => row.path === `replay-source/${name}`), `Missing mandatory frozen replay input ${name}`)
  for (const name of ['conformance-permission-lifecycle-model.ts', 'verify-conformance-permission-lifecycle.ts']) {
    assert.equal(member(directory, `go-reference/source/${name}`).sha256, member(directory, `replay-source/synthesis/src/wallet-lab/native/${name}`).sha256)
  }
  const report = json(path.join(directory, 'go-reference/evidence/conformance/permission-lifecycle.json'))
  const result = json(path.join(directory, 'go-reference/result.json'))
  assert.deepEqual(report, result.lifecycle); assert.equal(report.identity, result.identity)
  assert.equal(report.startedAt, manifest.lifecycleStartedAt); assert.equal(report.endedAt, manifest.lifecycleEndedAt)
  assert.equal(report.result, 'PASS'); assert.equal(result.originalPermissions.result, 'PASS'); assert.equal(result.verified.result, 'PASS')
  assert.deepEqual(result.cleanup, { browser: true, services: true, profile: true })
  assert.deepEqual(report.cleanup, { applicationPagesClosed: true, ownedPromptsClosed: true, settingsPageClosed: true })
  const screenshots = report.steps.flatMap(row => row.prompts.map(prompt => prompt.screenshot.name)).concat(report.ui.flatMap(row => [row.before.name, row.after.name, ...(row.confirmation ? [row.confirmation.name] : [])]))
  assert.equal(new Set(screenshots).size, screenshots.length)
  const expected = [
    'engineering-runner.ts', 'focused-tests.log', 'typecheck.log', 'prior-attempts.zip',
    'go-reference/result.json', 'go-reference/execution.log', 'go-reference/go-component-build-manifest.json',
    ...['conformance-permission-lifecycle-model.ts', 'conformance-permission-lifecycle.ts', 'verify-conformance-permission-lifecycle.ts'].map(name => `go-reference/source/${name}`),
    ...permissionReplayInputs.map(name => `replay-source/${name}`),
    ...['permission-lifecycle.json', 'permissions.json', 'permissions-alternate-approve.png', 'permissions-alternate-deny.png', 'permissions-primary-approve.png'].map(name => `go-reference/evidence/conformance/${name}`),
    ...screenshots.map(name => `go-reference/evidence/${name}`)
  ].sort()
  assert.deepEqual(manifest.files.map(row => row.path).sort(), expected)
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-permission-journal-'))
  try {
    const attempts = path.join(temporary, 'attempts'); fs.mkdirSync(attempts)
    extractZipSafely(fs.readFileSync(path.join(directory, 'prior-attempts.zip')), attempts)
    assert.deepEqual(manifest.archiveMembers.slice().sort((a, b) => a.path.localeCompare(b.path)), inventory(attempts).map(name => member(attempts, name)).sort((a, b) => a.path.localeCompare(b.path)))
    assert.deepEqual(manifest.priorAttempts.map(row => row.number), [1, 2, 3, 4, 5, 6])
    for (let index = 1; index <= 6; index++) {
      const attempt = json(path.join(attempts, `attempt-${index}/result.json`))
      assert.deepEqual(attempt.cleanup, { browser: true, services: true, profile: true })
    }
    if (semantic) {
      // Replay only the frozen observer and fixture bytes. No browser or service
      // is started, and mutable development source cannot change this verdict.
      const source = path.join(temporary, 'source'); fs.mkdirSync(source)
      for (const name of permissionReplayInputs) {
        const target = path.join(source, name); fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.copyFileSync(path.join(directory, 'replay-source', name), target)
      }
      assert.equal(hash(fs.readFileSync(path.join(root, 'synthesis/package-lock.json'))), hash(fs.readFileSync(path.join(source, 'synthesis/package-lock.json'))), 'Install frozen synthesis dependencies before replay')
      fs.symlinkSync(path.join(root, 'synthesis/node_modules'), path.join(source, 'synthesis/node_modules'), 'dir')
      const script = `import fs from 'node:fs'; import assert from 'node:assert/strict'; import {verifyNativePermissionLifecycle} from './synthesis/src/wallet-lab/native/verify-conformance-permission-lifecycle.ts'; import {verifyNativePermissionConformance} from './synthesis/src/wallet-lab/native/verify-conformance-permissions.ts'; const base=process.argv[2]; const read=name=>fs.readFileSync(base+'/go-reference/evidence/'+name); const report=JSON.parse(read('conformance/permission-lifecycle.json')); const old=JSON.parse(read('conformance/permissions.json')); assert.equal(verifyNativePermissionConformance(old,read,report.identity).result,'PASS'); const result=await verifyNativePermissionLifecycle(report,read,report.identity); assert.equal(result.result,'PASS'); console.log(JSON.stringify({original:8,lifecycle:result.assertions.length,result:result.result}));`
      const runner = path.join(source, 'replay.mjs'); fs.writeFileSync(runner, script)
      const replay = spawnSync(process.execPath, ['--import', path.join(root, 'synthesis/node_modules/tsx/dist/loader.mjs'), runner, path.resolve(directory)], { cwd: source, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 })
      assert.equal(replay.status, 0, `${replay.stderr}\n${replay.stdout}`)
    }
    return { result: 'PASS', files: manifest.files.length, originalAttemptMembers: manifest.archiveMembers.length, nativeMacOSEngineeringOnly: true, originalPredicates: 8, lifecyclePredicates: 16, semantic }
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}
if (process.argv[1] === import.meta.filename) {
  assert(process.argv.slice(2).every(value => value === '--semantic'))
  console.log(JSON.stringify(verifyPermissionLifecycleArchive(path.join(repository, 'journals/native-permission-lifecycle/2026-11-09'), { semantic: process.argv.includes('--semantic') }), null, 2))
}
