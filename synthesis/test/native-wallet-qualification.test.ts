import { expect, it } from 'vitest'
import { verifyHostReceipt } from '../src/wallet-lab/native/verify.js'
const baseline = { image: 'sha256:fixture', networkMode: 'none', privileged: false, readonly: true, init: true, pidMode: '', capDrop: ['ALL'], capAdd: null, user: '1001:1001', mounts: [{ type: 'bind', destination: '/evidence' }], networks: { none: {} } }
it('accepts only the isolated non-root native host contract', () => {
  expect(() => verifyHostReceipt(baseline, baseline.image)).not.toThrow()
  for (const patch of [
    { networkMode: 'host' }, { privileged: true }, { readonly: false }, { init: false }, { pidMode: 'host' },
    { capDrop: [] }, { capAdd: ['NET_ADMIN'] }, { user: '0:0' }, { image: 'sha256:unadmitted' },
    { networks: { bridge: {} } }, { mounts: [{ type: 'bind', destination: '/var/run/docker.sock' }] }
  ]) expect(() => verifyHostReceipt({ ...baseline, ...patch }, baseline.image)).toThrow()
})
