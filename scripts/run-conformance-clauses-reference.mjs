import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
const root = path.resolve(import.meta.dirname, '..')
const [destination, language = 'typescript'] = process.argv.slice(2)
if (!destination || !['typescript', 'go'].includes(language)) throw Error('Usage: run-conformance-clauses-reference.mjs OUTPUT typescript|go')
const output = path.resolve(destination)
if (fs.existsSync(output)) throw Error('Reference output must be a fresh directory')
const run = spawnSync(process.execPath, ['--import', path.join(root, 'synthesis/node_modules/tsx/dist/loader.mjs'), path.join(root, 'synthesis/src/wallet-lab/run-boundary.ts'), output, language, '--clauses'], { cwd: root, stdio: 'inherit' })
if (run.error) throw run.error
if (run.status !== 0) process.exit(run.status ?? 1)
const verify = spawnSync(process.execPath, [path.join(root, 'scripts/verify-conformance-clauses.mjs'), path.join(output, 'clauses/evidence/conformance/clauses.json'), '--reference', '--boundary', path.join(output, 'observations.json')], { cwd: root, stdio: 'inherit' })
if (verify.error) throw verify.error
process.exitCode = verify.status ?? 1
