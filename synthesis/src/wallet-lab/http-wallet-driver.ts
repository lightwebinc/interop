import type { ComponentSelection } from './go-services.js'
import os from 'node:os'
import path from 'node:path'
import {
  Beef,
  LockingScript,
  MerklePath,
  P2PKH,
  PrivateKey,
  PublicKey,
  PushDrop,
  Transaction,
  Utils
} from '@bsv/sdk'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { sha256Hex } from '../determinism.js'
import { EvidenceBundle } from './evidence.js'
import {
  DeclaredHookClient,
  createPromptAnswerer,
  fundingTransactionFromBlock,
  requireLoopbackUrl,
  type BlockFundingMaterial,
  type FixtureHookConfiguration,
  type PromptAnswerer,
  type PromptAnswering
} from './http-wallet-hooks.js'
import {
  aggregateOutcome,
  type ArtifactIdentity,
  type RouteObservation,
  type VectorResult,
  type WalletLabResult
} from './model.js'

// ISI-4 driver for desktop wallets that serve the BRC-100 HTTP JSON substrate on loopback.
//
// The vectors, assertion identifiers, evidence names and verdict predicates follow the
// browser-extension driver (yours-driver.ts). Only the substrate differs: the application and the
// fixture pages reach the wallet at `walletUrl` with an `Originator` header, as the SDK's HTTP JSON
// substrate does, instead of through an injected window object. Prompts are answered by a person or
// through the wallet's documented automation hook (http-wallet-hooks.ts).

export const BRC100_METHODS = [
  'createAction', 'signAction', 'abortAction', 'listActions', 'internalizeAction', 'listOutputs', 'relinquishOutput',
  'getPublicKey', 'revealCounterpartyKeyLinkage', 'revealSpecificKeyLinkage', 'encrypt', 'decrypt', 'createHmac',
  'verifyHmac', 'createSignature', 'verifySignature', 'acquireCertificate', 'listCertificates', 'proveCertificate',
  'relinquishCertificate', 'discoverByIdentityKey', 'discoverByAttributes', 'isAuthenticated', 'waitForAuthentication',
  'getHeight', 'getHeaderForHeight', 'getNetwork', 'getVersion'
] as const

export type FixtureEnvironmentConfiguration =
  | { mode: 'controlled-services'; components?: ComponentSelection }
  | {
      mode: 'declared-hook'
      hook: FixtureHookConfiguration
      applicationOrigin: string
      denyOrigin: string
      alternateOrigin: string
      /** Chromium host resolver rules that map the application names to their local server. */
      hostResolverRules?: string
    }

export interface DeclaredNetworkDeviation {
  network: string
  reason: string
}

export interface HttpWalletRunOptions {
  webroot: string
  outputDirectory: string
  walletArtifact: ArtifactIdentity
  applicationArtifact: ArtifactIdentity
  /** The exact `getVersion` answer of the admitted artifact. */
  expectedWalletVersion: string
  walletUrl?: string
  prompts: PromptAnswering
  fixture: FixtureEnvironmentConfiguration
  /** Records an operator-declared network outside the mainnet profile. */
  networkDeviation?: DeclaredNetworkDeviation
  /** Supported wallet settings the operator applied for this run, recorded as given. */
  walletConfiguration?: string[]
  browserExecutable?: string
  headless?: boolean
  task?: string
  amount?: number
}

interface OutputProjection {
  outpoint: string
  satoshis: number
  lockingScript?: string
  spendable: boolean
}

interface ListOutputProjection {
  totalOutputs: number
  outputs: OutputProjection[]
  beef?: number[]
}

export interface Submission {
  txid: string
  verdict: 'ACCEPTED_BY_NETWORK' | 'REJECTED'
  sha256?: string
}

/** Unknown or malformed fixture observations cannot establish a network verdict. */
export function parseSubmissions(value: unknown): Submission[] {
  if (!Array.isArray(value)) throw new Error('Fixture submissions hook returned no submission list')
  return value.map(item => {
    if (item === null || typeof item !== 'object') throw new Error('Malformed fixture submission')
    const record = item as Record<string, unknown>
    if (record.verdict !== 'REJECTED' && record.verdict !== 'ACCEPTED_BY_NETWORK')
      throw new Error('Unknown fixture submission verdict')
    if (typeof record.txid !== 'string' || !/^[0-9a-f]{64}$/i.test(record.txid))
      throw new Error('Invalid fixture submission transaction id')
    if (record.rawTx !== undefined) {
      if (typeof record.rawTx !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(record.rawTx))
        throw new Error('Invalid fixture submission transaction bytes')
      if (Transaction.fromHex(record.rawTx).id('hex') !== record.txid.toLowerCase())
        throw new Error('Fixture submission transaction id mismatch')
    }
    return {
      txid: record.txid.toLowerCase(),
      verdict: record.verdict,
      ...(typeof record.rawTx === 'string' ? { sha256: sha256Hex(Uint8Array.from(Utils.toArray(record.rawTx, 'hex'))) } : {})
    }
  })
}

interface FundingResult {
  transaction: Transaction
  beef: Uint8Array
  outputIndex: number
  height: number
  proofValid: boolean
  material: unknown
}

interface FixtureEnvironment {
  readonly applicationOrigin: string
  readonly denyOrigin: string
  readonly alternateOrigin: string
  readonly browserArgs: string[]
  readonly controlledDestinations: string[]
  readonly profile: WalletLabResult['profile']
  routes(): RouteObservation[]
  componentIdentity?(): Record<string, unknown>
  storageBoundaryObserved(): boolean
  fund(publicKey: string, satoshis: number): Promise<FundingResult>
  enqueueVerdict(verdict: Submission['verdict']): Promise<void>
  discardQueuedVerdict(verdict: Submission['verdict']): Promise<boolean>
  submissions(): Promise<Submission[]>
  close(): Promise<void>
}

async function controlledServicesEnvironment(webroot: string, components?: ComponentSelection): Promise<FixtureEnvironment> {
  const { ControlledWalletServices } = await import('./services.js')
  const services = new ControlledWalletServices({ webroot, components })
  await services.start()
  return {
    componentIdentity: () => services.componentIdentity,
    applicationOrigin: 'https://todo.itcve.test',
    denyOrigin: 'https://deny.itcve.test',
    alternateOrigin: 'https://alternate.itcve.test',
    browserArgs: [`--proxy-server=${services.proxyUrl}`, '--ignore-certificate-errors'],
    controlledDestinations: ['todo.itcve.test', 'alternate.itcve.test', 'deny.itcve.test', 'api.1sat.app'],
    profile: 'desktop-wallet-todo-controlled-services' as const,
    routes: () => services.routes,
    storageBoundaryObserved: () => services.storageRpcObservations.some(item => item.completed),
    async fund(publicKey, satoshis) {
      const funding = new Transaction()
      funding.addOutput({ satoshis, lockingScript: new P2PKH().lock(PublicKey.fromString(publicKey).toAddress()) })
      const txid = funding.id('hex')
      const height = 900_000
      funding.merklePath = new MerklePath(height, [[{ offset: 0, hash: txid, txid: true }]])
      services.registerSyntheticHeader({
        version: 1,
        previousHash: '00'.repeat(32),
        merkleRoot: txid,
        time: 1_800_000_000,
        bits: 486_604_799,
        nonce: 0,
        height,
      })
      const beef = Uint8Array.from(funding.toAtomicBEEF())
      const proofValid = await Beef.fromBinary(beef).verify({
        isValidRootForHeight: async (root, rootHeight) => root === txid && rootHeight === height,
        currentHeight: async () => 900_100
      }, false)
      return { transaction: funding, beef, outputIndex: 0, height, proofValid, material: { synthetic: true, height } }
    },
    async enqueueVerdict(verdict) {
      services.enqueueVerdict(verdict)
    },
    async discardQueuedVerdict(verdict) {
      return services.discardQueuedVerdict(verdict)
    },
    async submissions() {
      return services.submissions.map(item => ({ txid: item.txid, verdict: item.verdict, sha256: sha256Hex(item.bytes) }))
    },
    close: () => services.close()
  }
}

function hookEnvironment(
  configuration: Extract<FixtureEnvironmentConfiguration, { mode: 'declared-hook' }>,
  client: DeclaredHookClient
): FixtureEnvironment {
  const { hook } = configuration
  requireLoopbackUrl(hook.fundUrl, 'fixture fund')
  requireLoopbackUrl(hook.verdictUrl, 'fixture verdict')
  requireLoopbackUrl(hook.submissionsUrl, 'fixture submissions')
  const origins = [configuration.applicationOrigin, configuration.denyOrigin, configuration.alternateOrigin]
  return {
    applicationOrigin: configuration.applicationOrigin,
    denyOrigin: configuration.denyOrigin,
    alternateOrigin: configuration.alternateOrigin,
    browserArgs: configuration.hostResolverRules === undefined ? [] : [`--host-resolver-rules=${configuration.hostResolverRules}`],
    controlledDestinations: origins.map(origin => new URL(origin).hostname),
    profile: 'desktop-wallet-todo-declared-fixture-hook' as const,
    routes: () => [],
    storageBoundaryObserved: () => false,
    async fund(publicKey, satoshis) {
      const reply = await client.request('fixture-fund', 'POST', hook.fundUrl, { publicKey, satoshis })
      if (reply.status !== 200) throw new Error(`Fixture funding hook answered HTTP ${reply.status}`)
      const material = reply.body as BlockFundingMaterial
      const transaction = fundingTransactionFromBlock(material)
      const script = new P2PKH().lock(PublicKey.fromString(publicKey).toAddress()).toHex()
      const outputIndex = transaction.outputs.findIndex(output => output.lockingScript.toHex() === script)
      if (outputIndex < 0) throw new Error('Fixture funding transaction does not pay the derived key')
      const beef = Uint8Array.from(transaction.toAtomicBEEF())
      const proofValid = await Beef.fromBinary(beef).verify({
        isValidRootForHeight: async (root, height) => root === material.merkleRoot && height === material.blockHeight,
        currentHeight: async () => material.blockHeight + 1
      }, false)
      return { transaction, beef, outputIndex, height: material.blockHeight, proofValid, material }
    },
    async enqueueVerdict(verdict) {
      const reply = await client.request('fixture-verdict', 'POST', hook.verdictUrl, { action: 'schedule', verdict })
      if (reply.status !== 200) throw new Error(`Fixture verdict hook answered HTTP ${reply.status}`)
    },
    async discardQueuedVerdict(verdict) {
      const reply = await client.request('fixture-verdict', 'POST', hook.verdictUrl, { action: 'discard', verdict })
      if (reply.status !== 200) throw new Error(`Fixture verdict hook answered HTTP ${reply.status}`)
      return Boolean((reply.body as { discarded?: unknown } | null)?.discarded)
    },
    async submissions() {
      const reply = await client.request('fixture-submissions', 'GET', hook.submissionsUrl)
      if (reply.status !== 200) throw new Error(`Fixture submissions hook answered HTTP ${reply.status}`)
      const list = (reply.body as { submissions?: unknown } | null)?.submissions
      return parseSubmissions(list)
    },
    close: async () => undefined
  }
}

async function waitForText(page: Page, value: string, timeout = 30_000): Promise<void> {
  await page.getByText(value, { exact: false }).first().waitFor({ state: 'visible', timeout })
}

async function within<T>(label: string, timeout: number, operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeout} ms`)), timeout)
      })
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function extractTxid(outpoint: string): string {
  const txid = outpoint.split(/[._]/)[0]
  if (txid === undefined || !/^[0-9a-f]{64}$/i.test(txid)) throw new Error(`Invalid outpoint: ${outpoint}`)
  return txid.toLowerCase()
}

/** One HTTP JSON call from inside a page, so the browser sets the request origin. */
async function rawWalletCall(
  page: Page,
  walletUrl: string,
  method: string,
  args: unknown
): Promise<{ status: number; body: unknown }> {
  return page.evaluate(async ({ walletUrl, method, args }) => {
    const response = await fetch(`${walletUrl}/${method}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Originator: location.origin },
      body: JSON.stringify(args ?? {})
    })
    const text = await response.text()
    let body: unknown = text
    try {
      body = JSON.parse(text)
    } catch { /* Keep a non-JSON body as text. */ }
    return { status: response.status, body }
  }, { walletUrl, method, args })
}

export class WalletRefusal extends Error {
  constructor(readonly method: string, readonly status: number, message: string) {
    super(`${method} failed (HTTP ${status}): ${message}`)
    this.name = 'WalletRefusal'
  }
}

export function isPermissionRefusal(error: unknown): boolean {
  return error instanceof WalletRefusal && (
    error.status === 401 || error.status === 403 ||
    (error.status === 400 && /denied|not authorized|not allowed|forbidden|access refused|permission (?:refused|rejected|required)/i.test(error.message))
  )
}

/** A wallet call that throws on a non-success reply, as the SDK's HTTP JSON substrate does. */
async function walletCall(page: Page, walletUrl: string, method: string, args: unknown): Promise<Record<string, unknown>> {
  const reply = await rawWalletCall(page, walletUrl, method, args)
  if (reply.status < 200 || reply.status > 299) {
    const body = reply.body as Record<string, unknown> | string | null
    const message = typeof body === 'object' && body !== null
      ? String(body.message ?? body.description ?? body.name ?? `HTTP ${reply.status}`)
      : String(body ?? `HTTP ${reply.status}`)
    throw new WalletRefusal(method, reply.status, message)
  }
  return reply.body as Record<string, unknown>
}

export interface MethodProbe {
  status: number
  code?: string
}

/**
 * Probes each BRC-100 method with empty arguments. A 404 or 501 reply means the substrate does not
 * serve the method; any other reply, including an argument error, means it does.
 */
export async function probeMethodInventory(
  call: (method: string, args: unknown) => Promise<{ status: number; body: unknown }>
): Promise<{ inventory: Record<string, MethodProbe>; methods: string[] }> {
  const inventory: Record<string, MethodProbe> = {}
  for (const method of BRC100_METHODS) {
    const args = method === 'listActions' ? { labels: [] } : method === 'listCertificates' ? { certifiers: [], types: [] } : {}
    const reply = await call(method, args)
    const body = reply.body as Record<string, unknown> | null
    const code = typeof body === 'object' && body !== null ? body.code ?? body.name : undefined
    inventory[method] = { status: reply.status, ...(code === undefined ? {} : { code: String(code) }) }
  }
  const methods = Object.entries(inventory)
    .filter(([, probe]) => probe.status !== 404 && probe.status !== 501)
    .map(([method]) => method)
    .sort()
  return { inventory, methods }
}

export async function runHttpDesktopWallet(options: HttpWalletRunOptions): Promise<WalletLabResult> {
  const startedAt = new Date().toISOString()
  const task = options.task ?? 'TPNIL controlled task'
  const amount = options.amount ?? 2
  const walletUrl = (options.walletUrl ?? 'http://localhost:3321').replace(/\/+$/, '')
  requireLoopbackUrl(walletUrl, 'wallet')
  const webroot = path.resolve(options.webroot)
  const outputDirectory = path.resolve(options.outputDirectory)
  const runId = path.basename(outputDirectory)
  const evidence = new EvidenceBundle(outputDirectory)
  const consoleErrors: string[] = []
  const trace: Array<Record<string, unknown>> = []
  const progress = (message: string): void => {
    process.stdout.write(`[wallet-lab:${runId}] ${message}\n`)
  }
  const hooks = new DeclaredHookClient()
  const answerer: PromptAnswerer = createPromptAnswerer(options.prompts, hooks, progress)
  const callTimeout = answerer.timeoutMs
  const stateTimeout = Math.max(45_000, callTimeout)
  const vectors: VectorResult[] = []
  let environment: FixtureEnvironment | undefined
  let browser: Browser | undefined
  let browserVersion = 'unknown'
  let walletVersion = ''
  let walletNetwork = ''
  let authenticated = false
  let fundingTxid = ''
  let createTxid: string | undefined
  let redeemTxid: string | undefined
  try {
    environment = options.fixture.mode === 'controlled-services'
      ? await controlledServicesEnvironment(webroot, options.fixture.components)
      : hookEnvironment(options.fixture, hooks)
    const env = environment
    browser = await chromium.launch({
      headless: options.headless ?? true,
      ...(options.browserExecutable === undefined ? {} : { executablePath: options.browserExecutable }),
      args: [...env.browserArgs, '--disable-background-networking', '--no-first-run', '--disable-component-update']
    })
    browserVersion = browser.version()
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true })
    context.on('request', request => {
      if (!request.url().startsWith(`${walletUrl}/`)) return
      const headers = request.headers()
      const entry: Record<string, unknown> = {
        sequence: trace.length + 1,
        method: new URL(request.url()).pathname.slice(1),
        ...(headers.origin === undefined ? {} : { origin: headers.origin }),
        ...(headers.originator === undefined ? {} : { originator: headers.originator })
      }
      trace.push(entry)
      void request.response().then(response => {
        if (response !== null) entry.status = response.status()
      }).catch(error => { entry.failure = String(error) })
    })
    context.on('page', page => {
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 2_000))
      })
    })
    answerer.start()
    const call = (page: Page, method: string, args: unknown): Promise<Record<string, unknown>> =>
      within(`${method} wallet call`, callTimeout, walletCall(page, walletUrl, method, args))
    // A refusal is a completed wallet reply with an error status. A timeout or transport failure is
    // not a refusal, as in the browser-extension driver.
    const refusal = async (
      page: Page,
      label: string,
      bound: number,
      method: string,
      args: unknown
    ): Promise<{ refused: boolean; message: string }> => {
      try {
        await within(label, Math.max(bound, callTimeout), walletCall(page, walletUrl, method, args))
        return { refused: false, message: '' }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { refused: isPermissionRefusal(error), message }
      }
    }
    const listTodoOutputs = async (page: Page): Promise<ListOutputProjection> => {
      const result = await call(page, 'listOutputs', { basket: 'todo tokens', include: 'entire transactions', limit: 1_000 })
      return {
        totalOutputs: Number(result.totalOutputs),
        outputs: (result.outputs as Array<Record<string, unknown>>).map(output => ({
          outpoint: String(output.outpoint),
          satoshis: Number(output.satoshis),
          ...(typeof output.lockingScript === 'string' ? { lockingScript: output.lockingScript } : {}),
          spendable: Boolean(output.spendable)
        })),
        ...(Array.isArray(result.BEEF) ? { beef: result.BEEF.map(Number) } : {})
      }
    }
    const waitForTodoOutputs = async (
      page: Page,
      predicate: (value: ListOutputProjection) => boolean
    ): Promise<ListOutputProjection> => {
      const deadline = Date.now() + stateTimeout
      let last: ListOutputProjection | undefined
      while (Date.now() < deadline) {
        try {
          last = await listTodoOutputs(page)
          if (predicate(last)) return last
        } catch {
          // The wallet may still be settling permissions or the action commit.
        }
        await page.waitForTimeout(500)
      }
      throw new Error(`Timed out waiting for ToDo wallet state; last projection: ${JSON.stringify(last)}`)
    }

    answerer.instruct(`Allow every request from ${env.applicationOrigin} and confirm its transactions during this run.`)
    const application = await context.newPage()
    await application.goto(`${env.applicationOrigin}/`)
    await waitForText(application, 'ToDo List', 30_000)
    const boundary = {
      version: await call(application, 'getVersion', {}),
      network: await call(application, 'getNetwork', {}),
      authenticated: await call(application, 'isAuthenticated', {})
    }
    walletVersion = String(boundary.version.version)
    walletNetwork = String(boundary.network.network)
    authenticated = Boolean(boundary.authenticated.authenticated)
    progress(`boundary identified ${walletVersion} on ${walletNetwork}`)

    const senderKey = PrivateKey.fromHex('22'.repeat(32))
    const senderIdentityKey = senderKey.toPublicKey().toString()
    const derivationPrefix = Buffer.from('tpnil-wallet-lab').toString('base64')
    const derivationSuffix = Buffer.from('funding-001').toString('base64')
    const keyID = `${derivationPrefix} ${derivationSuffix}`
    const derived = await call(application, 'getPublicKey', {
      protocolID: [2, '3241645161d8'], keyID, counterparty: senderIdentityKey, forSelf: true
    })
    const funding = await env.fund(String(derived.publicKey), 10_000)
    fundingTxid = funding.transaction.id('hex')
    const fixtureProofValid = funding.proofValid
    const internalized = await call(application, 'internalizeAction', {
      tx: [...funding.beef],
      outputs: [{
        outputIndex: funding.outputIndex,
        protocol: 'wallet payment',
        paymentRemittance: { derivationPrefix, derivationSuffix, senderIdentityKey }
      }],
      description: 'TPNIL controlled fixture funding',
      labels: ['tpnil-fixture']
    })
    evidence.addBytes('funding.atomicbeef', funding.beef)
    evidence.addJson('funding.json', {
      fundingTxid,
      fundingHeight: funding.height,
      fixtureProofValid,
      internalized,
      fixtureMaterial: funding.material
    })
    const networkPassed = options.networkDeviation === undefined
      ? walletNetwork === 'mainnet'
      : walletNetwork === options.networkDeviation.network
    const versionPassed = walletVersion === options.expectedWalletVersion
    vectors.push({
      id: 'ISI-4-V001',
      outcome: versionPassed && networkPassed && authenticated && fixtureProofValid ? 'PASS' : 'FAIL',
      assertions: [
        { id: 'artifact-and-version', outcome: versionPassed ? 'PASS' : 'FAIL', detail: walletVersion, evidence: ['artifact.json'] },
        {
          id: 'mainnet-configuration',
          outcome: options.networkDeviation === undefined
            ? networkPassed ? 'PASS' : 'FAIL'
            : networkPassed ? 'NOT_APPLICABLE' : 'FAIL',
          detail: options.networkDeviation === undefined
            ? walletNetwork
            : `${walletNetwork}; declared deviation: ${options.networkDeviation.reason}`,
          evidence: ['boundary.json']
        },
        { id: 'controlled-fixture-proof', outcome: fixtureProofValid ? 'PASS' : 'FAIL', detail: fundingTxid, evidence: ['funding.atomicbeef', 'funding.json'] }
      ],
      limitations: [
        'The controlled fixture is not a public-mainnet UTXO or public-network acceptance claim.',
        'Engineering observation only: wallet-process egress closure, installed artifact binding, and clean wallet reset between repetitions require separate intake evidence.',
        ...(options.networkDeviation === undefined
          ? []
          : [`The operator declared the ${options.networkDeviation.network} network instead of the mainnet profile: ${options.networkDeviation.reason}`])
      ]
    })
    evidence.addJson('boundary.json', boundary)
    evidence.addJson('artifact.json', { wallet: options.walletArtifact, application: options.applicationArtifact })
    progress('controlled funding internalized')

    const createUrl = new URL(`${env.applicationOrigin}/`)
    createUrl.searchParams.set('p0Task', task)
    createUrl.searchParams.set('p0Amount', String(amount))
    createUrl.searchParams.set('p0OpenCreate', '1')
    await application.goto(createUrl.toString())
    await application.getByTestId('p0-todo-create-submit').click()
    const created = await waitForTodoOutputs(application, value =>
      value.outputs.some(output => output.satoshis === amount)
    )
    const createdOutput = created.outputs.find(output => output.satoshis === amount)
    if (createdOutput === undefined) throw new Error('Created ToDo output is absent from the wallet basket')
    createTxid = extractTxid(createdOutput.outpoint)
    if (created.beef === undefined) throw new Error('Wallet omitted BEEF for the created ToDo output')
    const outputIndex = Number(createdOutput.outpoint.split(/[._]/)[1])
    if (!Number.isSafeInteger(outputIndex) || outputIndex < 0) throw new Error('Created ToDo output index is invalid')
    const createdBeef = Beef.fromBinary(Uint8Array.from(created.beef))
    const createdTransaction = Transaction.fromAtomicBEEF(createdBeef.toBinaryAtomic(createTxid))
    const createdLockingScript = createdTransaction.outputs[outputIndex]?.lockingScript
    if (createdLockingScript === undefined) throw new Error('Created ToDo locking script is absent from BEEF')
    const pushDrop = PushDrop.decode(LockingScript.fromHex(createdLockingScript.toHex()))
    const protocolAddress = Utils.toUTF8(pushDrop.fields[0] ?? [])
    const decrypted = await call(application, 'decrypt', {
      ciphertext: pushDrop.fields[1] ?? [], protocolID: [0, 'todo list'], keyID: '1', counterparty: 'self'
    })
    const plaintext = Utils.toUTF8((decrypted.plaintext as number[]) ?? [])
    evidence.addJson('created-output.json', {
      created,
      lockingScript: createdLockingScript.toHex(),
      protocolAddress,
      plaintext,
      createTxid
    })
    if (created.beef !== undefined) evidence.addBytes('create.beef', Uint8Array.from(created.beef))
    vectors.push({
      id: 'ISI-4-V002',
      outcome: protocolAddress === '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG' && plaintext === task ? 'PASS' : 'FAIL',
      assertions: [
        { id: 'todo-basket-output', outcome: createdOutput.satoshis === amount ? 'PASS' : 'FAIL', detail: createdOutput.outpoint, evidence: ['created-output.json'] },
        { id: 'pushdrop-protocol-field', outcome: protocolAddress === '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG' ? 'PASS' : 'FAIL', detail: protocolAddress, evidence: ['created-output.json'] },
        { id: 'encrypted-task-roundtrip', outcome: plaintext === task ? 'PASS' : 'FAIL', detail: plaintext, evidence: ['created-output.json'] }
      ],
      limitations: []
    })
    progress('ToDo token created and decoded')

    await application.evaluate(() => localStorage.clear())
    await application.goto(`${env.applicationOrigin}/`)
    await waitForText(application, task, stateTimeout)
    const afterReload = await listTodoOutputs(application)
    const reloadMatches = afterReload.outputs.filter(output => output.outpoint === createdOutput.outpoint).length === 1
    evidence.addJson('cold-reload.json', { localStorageCleared: true, afterReload, taskVisible: true })
    vectors.push({
      id: 'ISI-4-V003',
      outcome: reloadMatches ? 'PASS' : 'FAIL',
      assertions: [{
        id: 'wallet-state-reconstruction',
        outcome: reloadMatches ? 'PASS' : 'FAIL',
        detail: createdOutput.outpoint,
        evidence: ['cold-reload.json']
      }],
      limitations: []
    })
    progress('cold reload reconstructed wallet state')

    await application.getByLabel(`${task} ${amount} satoshis`).click()
    await application.getByTestId('p0-todo-complete-submit').click()
    const afterRedeem = await waitForTodoOutputs(application, value =>
      !value.outputs.some(output => output.outpoint === createdOutput.outpoint)
    )
    const spent = !afterRedeem.outputs.some(output => output.outpoint === createdOutput.outpoint)
    const actions = await call(application, 'listActions', { labels: [], limit: 100, includeInputs: true, includeOutputs: true })
    const actionList = (actions.actions as Array<Record<string, unknown>>) ?? []
    const newest = actionList.at(-1)
    redeemTxid = typeof newest?.txid === 'string' ? newest.txid : undefined
    evidence.addJson('redeem.json', { spentOutpoint: createdOutput.outpoint, afterRedeem, actions })
    vectors.push({
      id: 'ISI-4-V004',
      outcome: spent ? 'PASS' : 'FAIL',
      assertions: [{ id: 'spent-output-absent', outcome: spent ? 'PASS' : 'FAIL', detail: createdOutput.outpoint, evidence: ['redeem.json'] }],
      limitations: ['Delayed-broadcast wallet state was evaluated; public-mainnet acceptance was outside the profile.']
    })
    progress('ToDo token redeemed')

    const deniedProtocol = [2, 'tpnil denied permission']
    answerer.instruct(`Deny the request from ${env.denyOrigin} for the protocol "tpnil denied permission".`)
    const denialPage = await context.newPage()
    await denialPage.goto(`${env.denyOrigin}/`)
    await waitForText(denialPage, 'TPNIL boundary fixture', 30_000)
    progress('requesting explicit protocol denial')
    const denialReply = await refusal(denialPage, 'protocol-denial request', 60_000, 'getPublicKey',
      { protocolID: deniedProtocol, keyID: 'denied', counterparty: 'anyone', forSelf: true })
    const denial = { rejected: denialReply.refused, message: denialReply.message }
    await denialPage.close()
    answerer.instruct(`Deny the request from ${env.alternateOrigin} for the protocol "tpnil origin isolation".`)
    const alternate = await context.newPage()
    await alternate.goto(`${env.alternateOrigin}/`)
    await waitForText(alternate, 'TPNIL boundary fixture', 30_000)
    progress('requesting independent cross-origin protocol decision')
    const crossReply = await refusal(alternate, 'cross-origin permission request', 45_000, 'getPublicKey',
      { protocolID: [2, 'tpnil origin isolation'], keyID: '1', counterparty: 'anyone', forSelf: true })
    const crossOrigin = { independentlyPrompted: crossReply.refused, message: crossReply.message }
    await alternate.close()
    evidence.addJson('permissions.json', { denial, crossOrigin, permissions: answerer.permissions })
    vectors.push({
      id: 'ISI-4-V005',
      outcome: denial.rejected && crossOrigin.independentlyPrompted ? 'PASS' : 'FAIL',
      assertions: [
        { id: 'deny-enforced', outcome: denial.rejected ? 'PASS' : 'FAIL', detail: denial.message, evidence: ['permissions.json'] },
        { id: 'origin-isolation', outcome: crossOrigin.independentlyPrompted ? 'PASS' : 'FAIL', detail: crossOrigin.message, evidence: ['permissions.json'] }
      ],
      limitations: ['The HTTP JSON substrate was exercised; window-injection and XDM substrates are separate deployment profiles.']
    })
    progress('permission denial and cross-origin isolation exercised')

    const exerciseImmediate = async (
      name: string,
      verdict: 'ACCEPTED_BY_NETWORK' | 'REJECTED'
    ): Promise<{
      body: string
      outputs?: ListOutputProjection
      error?: string
      submission?: Submission
    }> => {
      await env.enqueueVerdict(verdict)
      const submissionsBefore = (await env.submissions()).length
      const casePage = await context.newPage()
      const url = new URL(`${env.applicationOrigin}/`)
      url.searchParams.set('p0Task', name)
      url.searchParams.set('p0Amount', '2')
      url.searchParams.set('p0OpenCreate', '1')
      url.searchParams.set('p0ImmediateBroadcast', '1')
      progress(`immediate ${verdict}: opening isolated application page`)
      let body = ''
      let outputs: ListOutputProjection | undefined
      let error: string | undefined
      let observedCount = submissionsBefore
      try {
        await within(`immediate ${verdict} navigation`, 30_000, casePage.goto(url.toString()).then(() => undefined))
        await within(`immediate ${verdict} form readiness`, 30_000,
          casePage.getByTestId('p0-todo-create-submit').waitFor({ state: 'visible' }))
        await within(`immediate ${verdict} task prefill`, 30_000,
          casePage.waitForFunction(expected => {
            const input = document.querySelector<HTMLInputElement>('[data-testid="p0-todo-task-input"]')
            return input?.value === expected
          }, name))
        await within(`immediate ${verdict} amount prefill`, 30_000,
          casePage.waitForFunction(() => {
            const input = document.querySelector<HTMLInputElement>('[data-testid="p0-todo-amount-input"]')
            return input?.value === '2'
          }))
        await within(`immediate ${verdict} submit`, 30_000,
          casePage.getByTestId('p0-todo-create-submit').click())
        progress(`immediate ${verdict}: submit dispatched`)
        const deadline = Date.now() + stateTimeout
        while (Date.now() < deadline) {
          body = await within(`immediate ${verdict} page observation`, 5_000,
            casePage.locator('body').innerText())
          observedCount = (await env.submissions()).length
          if (observedCount > submissionsBefore) break
          await casePage.waitForTimeout(500)
        }
        progress(`immediate ${verdict}: ${observedCount - submissionsBefore} submission(s) observed`)
        await casePage.waitForTimeout(2_000)
        body = await within(`immediate ${verdict} final page observation`, 5_000,
          casePage.locator('body').innerText())
        outputs = await within(`immediate ${verdict} wallet projection`, callTimeout, listTodoOutputs(casePage))
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause)
        progress(`immediate ${verdict}: bounded failure: ${error}`)
        body = await casePage.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
      } finally {
        await casePage.close().catch(() => undefined)
      }
      const all = await env.submissions()
      const observed = all.length > submissionsBefore ? all.at(-1) : undefined
      const discardedUnconsumedVerdict = observed === undefined ? await env.discardQueuedVerdict(verdict) : false
      return {
        body,
        ...(outputs === undefined ? {} : { outputs }),
        ...(error === undefined ? {} : { error }),
        ...(discardedUnconsumedVerdict ? { error: error ?? 'No controlled submission consumed the scheduled verdict.' } : {}),
        ...(observed === undefined ? {} : { submission: observed })
      }
    }
    const accepted = await exerciseImmediate(`${task} accepted`, 'ACCEPTED_BY_NETWORK')
    const acceptedCount = accepted.outputs?.totalOutputs
    const rejected = await exerciseImmediate(`${task} rejected`, 'REJECTED')
    const rejectedStatePreserved = acceptedCount !== undefined && rejected.outputs?.totalOutputs === acceptedCount
    const recovered = await exerciseImmediate(`${task} recovered`, 'ACCEPTED_BY_NETWORK')
    const recoveredStateAdvanced = acceptedCount !== undefined && recovered.outputs?.totalOutputs === acceptedCount + 1
    const acceptedPassed = accepted.submission?.verdict === 'ACCEPTED_BY_NETWORK'
      && accepted.body.includes('Task successfully created!')
    const rejectedPassed = rejected.submission?.verdict === 'REJECTED' && rejectedStatePreserved
    const recoveryPassed = recovered.submission?.verdict === 'ACCEPTED_BY_NETWORK' && recoveredStateAdvanced
    evidence.addJson('broadcast-lifecycle.json', {
      accepted,
      rejected,
      recovered,
      assertions: { acceptedPassed, rejectedPassed, rejectedStatePreserved, recoveryPassed, recoveredStateAdvanced }
    })
    vectors.push({
      id: 'ISI-4-V006',
      outcome: acceptedPassed && rejectedPassed && recoveryPassed ? 'PASS' : 'FAIL',
      assertions: [
        {
          id: 'accepted-service-verdict-observed',
          outcome: acceptedPassed ? 'PASS' : 'FAIL',
          detail: accepted.submission?.txid ?? 'no controlled submission observed',
          evidence: ['broadcast-lifecycle.json']
        },
        {
          id: 'rejection-preserves-wallet-state',
          outcome: rejectedPassed ? 'PASS' : 'FAIL',
          detail: rejected.submission?.txid ?? 'no controlled rejected submission observed',
          evidence: ['broadcast-lifecycle.json']
        },
        {
          id: 'post-rejection-recovery',
          outcome: recoveryPassed ? 'PASS' : 'FAIL',
          detail: recovered.submission?.txid ?? 'no controlled recovery submission observed',
          evidence: ['broadcast-lifecycle.json']
        }
      ],
      limitations: ['These are controlled-service verdicts; they are not public-mainnet observations.']
    })
    progress('accepted, rejected, and recovered immediate broadcasts exercised')

    const storageObserved = env.storageBoundaryObserved()
    vectors.push({
      id: 'ISI-4-V007',
      outcome: 'BLOCKED',
      assertions: [{
        id: 'remote-storage-continuity',
        outcome: storageObserved ? 'PASS' : 'BLOCKED',
        detail: storageObserved
          ? 'Creation, cold reload, and redemption used the controlled Wallet Toolbox remote-storage boundary.'
          : 'The HTTP JSON substrate exposes no remote-storage boundary; this run observed none.',
        evidence: ['cold-reload.json', 'redeem.json']
      }],
      limitations: ['Counterpart replacement requires the executable ISI-3 multi-remote synchronization profile, which is not yet implemented.']
    })

    const probe = await probeMethodInventory((method, args) =>
      within(`${method} inventory probe`, callTimeout, rawWalletCall(application, walletUrl, method, args)))
    const methodInventory = probe.methods
    const boundaryProtocol = [1, 'tpnil boundary']
    const plaintextBytes = Array.from(new TextEncoder().encode('TPNIL boundary fixture'))
    const encrypted = await call(application, 'encrypt', { plaintext: plaintextBytes, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const decryptedBoundary = await call(application, 'decrypt', { ciphertext: encrypted.ciphertext, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const signature = await call(application, 'createSignature', { data: plaintextBytes, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const verified = await call(application, 'verifySignature', { data: plaintextBytes, signature: signature.signature, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const hmac = await call(application, 'createHmac', { data: plaintextBytes, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const hmacVerified = await call(application, 'verifyHmac', { data: plaintextBytes, hmac: hmac.hmac, protocolID: boundaryProtocol, keyID: '1', counterparty: 'self' })
    const safeBoundary = {
      decrypted: Array.from((decryptedBoundary.plaintext as number[]) ?? []),
      signatureVerified: Boolean(verified.valid),
      hmacVerified: Boolean(hmacVerified.valid),
      height: await call(application, 'getHeight', {}),
      header: await call(application, 'getHeaderForHeight', { height: 0 })
    }
    const cryptoRoundtrip = Buffer.from(safeBoundary.decrypted).toString() === 'TPNIL boundary fixture'
    evidence.addJson('method-inventory.json', { methods: methodInventory, probes: probe.inventory, safeBoundary })
    vectors.push({
      id: 'ISI-4-V008',
      outcome: 'BLOCKED',
      assertions: [
        { id: 'declared-method-inventory', outcome: methodInventory.length === 28 ? 'PASS' : 'FAIL', detail: `${methodInventory.length} methods`, evidence: ['method-inventory.json'] },
        { id: 'crypto-positive-cases', outcome: cryptoRoundtrip && safeBoundary.signatureVerified && safeBoundary.hmacVerified ? 'PASS' : 'FAIL', detail: 'encrypt/decrypt, signature, and HMAC', evidence: ['method-inventory.json'] }
      ],
      limitations: [
        'Certificate acquisition, identity discovery, linkage revelation, abort, and relinquishment need clause-level positive and specified-error fixtures before complete BRC-100 coverage can be claimed.',
        'Over HTTP the inventory counts methods that answer with a status other than 404 or 501 to an empty-argument probe.'
      ]
    })
    progress('safe BRC-100 boundary corpus exercised')

    await answerer.stop()
    evidence.addJson('routes.json', env.routes())
    evidence.addJson('console-errors.json', consoleErrors)
    evidence.addJson('wallet-trace.json', trace)
    evidence.addJson('prompt-answering.json', answerer.describe())
    evidence.addJson('declared-hooks.json', hooks.uses)
    if (env.componentIdentity !== undefined) evidence.addJson('service-components.json', env.componentIdentity())
    const resultWithoutEvidence: Omit<WalletLabResult, 'evidence'> = {
      schema: 'tpnil-isi4-wallet-run@1.0.0',
      claim: 'ENGINEERING_OBSERVATION_ONLY',
      program: 'ISI-4@1.0.0',
      itcve: options.fixture.mode === 'controlled-services' && Object.values(options.fixture.components ?? {}).includes('go') ? 'ITCVE-1@1.1.0' : 'ITCVE-1@1.0.0',
      profile: env.profile,
      runId,
      startedAt,
      endedAt: new Date().toISOString(),
      runner: {
        os: `${os.platform()} ${os.release()}`,
        architecture: os.arch(),
        node: process.version,
        browser: browserVersion,
        headless: options.headless ?? true
      },
      artifacts: { wallet: options.walletArtifact, application: options.applicationArtifact },
      configuration: {
        ...(env.componentIdentity === undefined ? {} : { serviceComponents: env.componentIdentity() }),
        walletNetwork: options.networkDeviation?.network ?? 'mainnet',
        publicMainnetBroadcast: 'not-observed',
        applicationOrigin: env.applicationOrigin,
        controlledDestinations: env.controlledDestinations,
        undeclaredEgress: 'not-observed',
        substrate: 'brc100-http-json',
        walletUrl,
        promptAnswering: answerer.mode,
        fixtureEnvironment: options.fixture.mode,
        walletSettings: options.walletConfiguration ?? []
      },
      observations: {
        walletVersion,
        walletNetwork,
        authenticated,
        fundingTxid,
        ...(createTxid === undefined ? {} : { createTxid }),
        ...(redeemTxid === undefined ? {} : { redeemTxid }),
        routes: env.routes(),
        permissions: answerer.permissions
      },
      vectors,
      semanticProjection: {
        walletVersion,
        walletNetwork,
        authenticated,
        v001: vectors.find(vector => vector.id === 'ISI-4-V001')!.outcome,
        v002: vectors.find(vector => vector.id === 'ISI-4-V002')!.outcome,
        v003: vectors.find(vector => vector.id === 'ISI-4-V003')!.outcome,
        v004: vectors.find(vector => vector.id === 'ISI-4-V004')!.outcome,
        v005: vectors.find(vector => vector.id === 'ISI-4-V005')!.outcome,
        v006: vectors.find(vector => vector.id === 'ISI-4-V006')!.outcome,
        v007: vectors.find(vector => vector.id === 'ISI-4-V007')!.outcome,
        v008: vectors.find(vector => vector.id === 'ISI-4-V008')!.outcome,
        todoLifecycle: spent,
        permissionsIsolated: denial.rejected && crossOrigin.independentlyPrompted,
        methodCount: methodInventory.length
      },
      outcome: aggregateOutcome(vectors)
    }
    return evidence.write(resultWithoutEvidence)
  } catch (error) {
    await answerer.stop().catch(() => undefined)
    evidence.addJson('attempt-failure.json', { startedAt, endedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) })
    evidence.addJson('routes.json', environment?.routes() ?? [])
    evidence.addJson('console-errors.json', consoleErrors)
    evidence.addJson('wallet-trace.json', trace)
    evidence.addJson('prompt-answering.json', answerer.describe())
    evidence.addJson('declared-hooks.json', hooks.uses)
    evidence.flush()
    throw error
  } finally {
    await answerer.stop().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    await environment?.close().catch(() => undefined)
  }
}
