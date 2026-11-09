import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Setup } from '@bsv/wallet-toolbox'
import { expect, it, vi } from 'vitest'
import { ControlledWalletServices } from '../src/wallet-lab/services.js'

function request(origin: string, target: string, host?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(origin, { path: target, headers: host ? { host } : {}, timeout: 5000 }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode!, body: Buffer.concat(chunks).toString() }))
      response.on('error', reject)
    })
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Controlled endpoint response deadline exceeded'))); req.end()
  })
}
async function closed(origin: string) {
  await expect(new Promise<void>((resolve, reject) => {
    const socket = net.connect(Number(new URL(origin).port), '127.0.0.1')
    socket.once('connect', () => { socket.destroy(); resolve() })
    socket.once('error', reject)
  })).rejects.toMatchObject({ code: 'ECONNREFUSED' })
}
const binary = path.resolve(import.meta.dirname, '../../out/itcve-go-storage-portability')
for (const implementation of ['typescript', 'go'] as const) it.skipIf(implementation === 'go' && !fs.existsSync(binary))(`atomically binds concurrent ${implementation} service listeners and publishes their actual live ports`, async () => {
  const webroot = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-listener-test-'))
  fs.writeFileSync(path.join(webroot, 'index.html'), '<title>atomic listener fixture</title>')
  try {
    for (let round = 0; round < 3; round++) {
      const providers = Array.from({ length: 2 }, () => new ControlledWalletServices({ webroot, components: { storage: implementation, chaintracks: implementation }, ...(implementation === 'go' ? { go: { binary, storagePortabilityPatch: true, terminalRejectionReceipts: true } } : {}) }))
      const listen = vi.spyOn(net.Server.prototype, 'listen')
      try {
        const started = await Promise.allSettled(providers.map(provider => provider.start()))
        for (const result of started) expect(result.status === 'fulfilled' ? undefined : result.reason).toBeUndefined()
        // Detect the old probe/release/rebind algorithm deterministically, even
        // when the OS happens to choose different ports in this execution.
        expect(listen.mock.calls.length).toBeGreaterThanOrEqual(8)
        for (const call of listen.mock.calls) {
          const argument: any = call[0]
          expect(typeof argument === 'object' ? argument.port : argument).toBe(0)
        }
        listen.mockRestore()
        const endpoints = providers.flatMap(provider => [provider.serviceUrl, provider.storageUrl, provider.proxyUrl])
        expect(new Set(endpoints.map(endpoint => new URL(endpoint).port)).size).toBe(endpoints.length)
        for (const provider of providers) {
          expect(new URL(provider.emulatorProxyUrl).port).toBe(new URL(provider.proxyUrl).port)
          expect(fs.existsSync(path.join(provider.caDirectory, 'certs/ca.pem'))).toBe(true)
          const headers = await request(provider.serviceUrl, '/chaintracks/v2/header/height/0')
          expect(headers.status).toBe(200)
          expect(JSON.parse(headers.body).hash).toBe('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f')
          expect(await request(provider.proxyUrl, 'http://todo.itcve.test/', 'todo.itcve.test')).toEqual({ status: 200, body: '<title>atomic listener fixture</title>' })
          const client = await Setup.createWalletClientNoEnv({ chain: 'main', rootKeyHex: '22'.repeat(32), storageUrl: provider.storageUrl })
          const storageIdentity = client.storage.getSettings().storageIdentityKey
          try { expect((await client.listOutputs({ basket: 'default' })).totalOutputs).toBe(0) } finally { await client.destroy() }
          const storageUrl = provider.storageUrl
          await provider.setStorageEndpointAvailable(false); await closed(storageUrl)
          const occupied = http.createServer()
          await new Promise<void>((resolve, reject) => { occupied.once('error', reject); occupied.listen(Number(new URL(storageUrl).port), '127.0.0.1', resolve) })
          try { await expect(provider.setStorageEndpointAvailable(true)).rejects.toMatchObject({ code: 'EADDRINUSE' }); expect(provider.storageUrl).toBe(storageUrl) }
          finally { await new Promise<void>(resolve => occupied.close(() => resolve())) }
          await provider.setStorageEndpointAvailable(true)
          expect(provider.storageUrl).toBe(storageUrl)
          await provider.restartStorage()
          expect(provider.storageUrl).toBe(storageUrl)
          const recovered = await Setup.createWalletClientNoEnv({ chain: 'main', rootKeyHex: '22'.repeat(32), storageUrl })
          try {
            expect(recovered.storage.getSettings().storageIdentityKey).toBe(storageIdentity)
            expect((await recovered.listOutputs({ basket: 'default' })).totalOutputs).toBe(0)
          } finally { await recovered.destroy() }
        }
        await Promise.all(providers.map(provider => provider.close()))
        for (const endpoint of endpoints) await closed(endpoint)
      } finally {
        listen.mockRestore()
        for (const provider of providers) if (fs.existsSync(provider.temporaryDirectory)) await provider.close()
      }
    }
  } finally { fs.rmSync(webroot, { recursive: true, force: true }) }
}, 60_000)

it('closes the already-bound service listener when later storage startup fails', async () => {
  const webroot = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-listener-startup-failure-'))
  const provider = new ControlledWalletServices({ webroot })
  const setup = vi.spyOn(Setup, 'createWalletSQLite').mockRejectedValueOnce(new Error('controlled storage setup failure'))
  try {
    await expect(provider.start()).rejects.toThrow('controlled storage setup failure')
    await closed(provider.serviceUrl)
    expect(fs.existsSync(provider.temporaryDirectory)).toBe(false)
  } finally { setup.mockRestore(); fs.rmSync(webroot, { recursive: true, force: true }) }
})
