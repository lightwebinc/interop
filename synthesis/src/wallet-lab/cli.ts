import type { ComponentSelection } from './go-services.js'
import fs from 'node:fs'
import path from 'node:path'
import { canonicalJson, sha256Hex } from '../determinism.js'
import { verifyEvidenceBundle, verifyWalletRunSeries } from './evidence.js'
import type { ArtifactIdentity, WalletLabResult } from './model.js'
import { runHttpDesktopWallet, type DeclaredNetworkDeviation, type FixtureEnvironmentConfiguration } from './http-wallet-driver.js'
import type { PromptAnswering } from './http-wallet-hooks.js'
import { runYoursWallet } from './yours-driver.js'

interface CommonConfiguration {
  schema: 'tpnil-isi4-wallet-run-config@1.0.0'
  baseDirectory: string
  webroot: string
  applicationArchive: string
  outputDirectory: string
  repetitions: number
  headless?: boolean
  components?: ComponentSelection
  walletArtifact: ArtifactIdentity
  applicationArtifact: ArtifactIdentity
}

interface ExtensionConfiguration extends CommonConfiguration {
  driver: 'yours-extension'
  extensionDirectory: string
  extensionArchive: string
}

interface HttpDesktopConfiguration extends CommonConfiguration {
  driver: 'http-desktop-wallet'
  /** The installed wallet artifact, verified against walletArtifact when present. */
  walletArchive?: string
  expectedWalletVersion: string
  walletUrl?: string
  prompts: PromptAnswering
  fixture: FixtureEnvironmentConfiguration
  networkDeviation?: DeclaredNetworkDeviation
  walletConfiguration?: string[]
  browserExecutable?: string
}

type RunConfiguration = ExtensionConfiguration | HttpDesktopConfiguration

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

function verifyArtifact(file: string, identity: ArtifactIdentity): void {
  const bytes = fs.readFileSync(file)
  if (bytes.length !== identity.size) throw new Error(`${identity.id} size mismatch`)
  const digest = sha256Hex(bytes)
  if (digest !== identity.sha256) throw new Error(`${identity.id} digest mismatch: ${digest}`)
}

async function run(configPath: string): Promise<void> {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as RunConfiguration
  if (config.schema !== 'tpnil-isi4-wallet-run-config@1.0.0' ||
      (config.driver !== 'yours-extension' && config.driver !== 'http-desktop-wallet'))
    fail('Unsupported wallet-run configuration')
  if (!Number.isSafeInteger(config.repetitions) || config.repetitions < 2)
    fail('A wallet-run series requires at least two repetitions')
  const base = path.resolve(path.dirname(configPath), config.baseDirectory)
  const resolve = (value: string): string => path.resolve(base, value)
  if (config.driver === 'yours-extension') verifyArtifact(resolve(config.extensionArchive), config.walletArtifact)
  else if (config.walletArchive !== undefined) verifyArtifact(resolve(config.walletArchive), config.walletArtifact)
  verifyArtifact(resolve(config.applicationArchive), config.applicationArtifact)
  const output = resolve(config.outputDirectory)
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0)
    fail(`Wallet-run output already exists: ${output}`)
  fs.mkdirSync(output, { recursive: true })
  const results: WalletLabResult[] = []
  for (let index = 1; index <= config.repetitions; index += 1) {
    const outputDirectory = path.join(output, `repetition-${index}`)
    const result = config.driver === 'yours-extension'
      ? await runYoursWallet({
          extensionDirectory: resolve(config.extensionDirectory),
          components: config.components,
          webroot: resolve(config.webroot),
          outputDirectory,
          walletArtifact: config.walletArtifact,
          applicationArtifact: config.applicationArtifact,
          headless: config.headless ?? true
        })
      : await runHttpDesktopWallet({
          webroot: resolve(config.webroot),
          outputDirectory,
          walletArtifact: config.walletArtifact,
          applicationArtifact: config.applicationArtifact,
          expectedWalletVersion: config.expectedWalletVersion,
          prompts: config.prompts,
          fixture: config.fixture,
          headless: config.headless ?? true,
          ...(config.walletUrl === undefined ? {} : { walletUrl: config.walletUrl }),
          ...(config.networkDeviation === undefined ? {} : { networkDeviation: config.networkDeviation }),
          ...(config.walletConfiguration === undefined ? {} : { walletConfiguration: config.walletConfiguration }),
          ...(config.browserExecutable === undefined ? {} : { browserExecutable: resolve(config.browserExecutable) })
        })
    verifyEvidenceBundle(path.join(output, `repetition-${index}`))
    results.push(result)
  }
  const projections = results.map(result => canonicalJson(result.semanticProjection))
  const repetitionMatch = projections.every(projection => projection === projections[0])
  const summary = {
    schema: 'tpnil-isi4-wallet-run-series@1.0.0',
    claim: results[0]!.claim,
    program: 'ISI-4@1.0.0',
    repetitions: results.map(result => ({
      runId: result.runId,
      outcome: result.outcome,
      recordSha256: sha256Hex(fs.readFileSync(path.join(output, result.runId, 'record.json')))
    })),
    repetitionMatch,
    semanticProjection: results[0]?.semanticProjection ?? {},
    outcome: repetitionMatch ? results[0]?.outcome ?? 'INCONCLUSIVE' : 'INCONCLUSIVE'
  }
  fs.writeFileSync(path.join(output, 'series.json'), `${canonicalJson(summary)}\n`)
  process.stdout.write(`${canonicalJson(summary)}\n`)
  if (!repetitionMatch) process.exitCode = 1
}

function verify(directory: string): void {
  const target = path.resolve(directory)
  if (fs.existsSync(path.join(target, 'record.json'))) {
    const result = verifyEvidenceBundle(target)
    process.stdout.write(`${canonicalJson({ verified: 1, runId: result.runId })}\n`)
    return
  }
  if (!fs.existsSync(path.join(target, 'series.json'))) fail('No wallet-run series record found')
  const verified = verifyWalletRunSeries(target)
  process.stdout.write(`${canonicalJson({ verified: verified.results.length, semanticProjectionMatch: verified.repetitionMatch })}\n`)
  if (!verified.repetitionMatch) process.exitCode = 1
}

const [command, argument] = process.argv.slice(2)
if (argument === undefined) fail('Usage: wallet-lab <run CONFIG | verify DIRECTORY>')
if (command === 'run') await run(path.resolve(argument))
else if (command === 'verify') verify(argument)
else fail(`Unknown wallet-lab command: ${command ?? ''}`)
