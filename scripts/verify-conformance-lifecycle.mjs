import fs from 'node:fs'
import path from 'node:path'
import { register } from '../synthesis/node_modules/tsx/dist/esm/api/index.mjs'
const root = path.resolve(import.meta.dirname, '..')
register()
const { verifyConformanceLifecycle } = await import('../synthesis/src/wallet-lab/native/verify-conformance-lifecycle.ts')
if (process.argv.length !== 3) throw new Error('Usage: node scripts/verify-conformance-lifecycle.mjs REPORT_JSON')
console.log(JSON.stringify(await verifyConformanceLifecycle(JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))), null, 2))
