import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { selectComponents, validateComponentIdentity, validateStorageSyncGoBuild } from '../src/wallet-lab/go-services.js'

it('admits the layered ancestry build only explicitly and binds its immutable parent', () => {
  const root = path.resolve(import.meta.dirname, '../..')
  const lockBytes = fs.readFileSync(path.join(root, 'infra/adapters/storage-portability/patch.lock.json'))
  const patch = JSON.parse(lockBytes.toString())
  const parentBytes = fs.readFileSync(path.join(root, patch.parent))
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
  expect(sha(parentBytes)).toBe(patch.parentSha256)
  expect(sha(fs.readFileSync(path.join(root, 'infra/adapters/storage-portability', patch.patch)))).toBe(patch.patchSha256)
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'synthesis/go/components.lock.json'), 'utf8'))
  const binarySha256 = 'ab'.repeat(32)
  const manifest = { schema: 'tpnil-storage-portability-go-build@1.0.0', binarySha256, patchLockSha256: sha(lockBytes), parentPatchLockSha256: patch.parentSha256,
    patchSha256: patch.patchSha256, toolchain: lock.toolchain, replacementModule: '/declared/source', upstream: { module: patch.module, version: patch.version, sum: patch.sum } }
  const build = { toolchain: lock.toolchain, dependencies: Object.fromEntries(lock.components.map((pin: any) => [pin.module, { version: pin.version, sum: pin.sum }])) }
  build.dependencies[patch.module] = { version: patch.version, sum: '', replacementModule: manifest.replacementModule, replacementVersion: '(devel)' }
  expect(() => validateStorageSyncGoBuild(build, binarySha256, manifest, true)).not.toThrow()
  expect(() => validateStorageSyncGoBuild(build, binarySha256, manifest)).toThrow()
  expect(() => validateStorageSyncGoBuild(build, binarySha256, { ...manifest, parentPatchLockSha256: '00'.repeat(32) }, true)).toThrow()
  const components = selectComponents({ storage: 'go' })
  const identity = { components, go: { schema: 'tpnil-go-services@1.0.0', components, binarySha256, compatibilityPatch: manifest, fixtureSubmissionPolicy: 'terminal-rejection-v1', dependencies: lock, goModSha256: lock.moduleFiles['go.mod'], goSumSha256: lock.moduleFiles['go.sum'] } }
  expect(() => validateComponentIdentity(identity, 'ITCVE-1@1.4.0')).not.toThrow()
  expect(() => validateComponentIdentity(identity, 'ITCVE-1@1.3.0')).toThrow()
  expect(() => validateComponentIdentity({ ...identity, go: { ...identity.go, compatibilityPatch: { ...manifest, parentPatchLockSha256: '00'.repeat(32) } } }, 'ITCVE-1@1.4.0')).toThrow()
})
