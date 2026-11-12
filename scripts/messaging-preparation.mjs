// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { sha256, sourceTreeDigest } from '../components/messaging/identity.mjs';

export function parseMessagingPreparationArgs(args) {
  if (args.length === 0) return 'full';
  if (args.length === 1 && args[0] === '--native-verifier-only') return 'native-verifier-only';
  throw new Error('Usage: node scripts/prepare-messaging.mjs [--native-verifier-only]');
}

export function nativeVerifierPreparationPlan(root, lock) {
  assert.equal(lock.schema, 'tpnil-messaging-sources@1');
  const selected = lock.components.filter(component => component.id === 'typescript-messagebox');
  assert.equal(selected.length, 1, 'Exactly one pinned TypeScript Message Box source is required');
  const component = selected[0];
  assert.equal(component.repository, 'bsv-blockchain/ts-stack');
  assert.equal(component.path, 'infra/message-box-server');
  assert.match(component.commit, /^[a-f0-9]{40}$/);
  assert.match(component.archiveSha256, /^[a-f0-9]{64}$/);
  const cache = path.join(root, 'out/messaging-native-verifier');
  const directory = `ts-stack-${component.commit}`;
  return {
    component, cache, directory,
    packageRoot: path.join(cache, directory, component.path),
    archive: path.join(cache, `${directory}.tgz`),
    commands: [
      { command: 'tar', args: ['-xzf', path.join(cache, `${directory}.tgz`), '-C', cache, `${directory}/${component.path}`] },
      { command: 'npm', args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'] }
    ]
  };
}

/** This isolated dependency cache cannot stand in for a complete service build. */
export async function prepareNativeMessagingVerifier(root) {
  const lockPath = path.join(root, 'components/messaging/sources.lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath));
  const plan = nativeVerifierPreparationPlan(root, lock);
  assert.equal(process.versions.node, lock.node, 'Use the pinned Node runtime');
  if (fs.existsSync(plan.cache)) {
    assert.ok(!fs.lstatSync(plan.cache).isSymbolicLink(), 'Verifier cache must not alias a service cache');
    assert.ok(!fs.existsSync(path.join(plan.cache, 'build.json')), 'Refusing to modify a complete service closure');
    const pathsFile = path.join(plan.cache, 'paths.json');
    if (fs.existsSync(pathsFile)) assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(pathsFile))), ['typescript-messagebox'], 'Refusing to modify full service paths');
  }
  fs.mkdirSync(plan.cache, { recursive: true });
  const startedAt = new Date().toISOString();
  if (!fs.existsSync(plan.archive)) {
    const response = await fetch(`https://codeload.github.com/${plan.component.repository}/tar.gz/${plan.component.commit}`, { signal: AbortSignal.timeout(180000) });
    assert.ok(response.ok, `Source fetch HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(bytes), plan.component.archiveSha256, 'Pinned source archive differs');
    fs.writeFileSync(plan.archive, bytes, { flag: 'wx' });
  }
  assert.equal(sha256(fs.readFileSync(plan.archive)), plan.component.archiveSha256, 'Pinned source archive differs');
  fs.rmSync(path.join(plan.cache, plan.directory), { recursive: true, force: true });
  execFileSync(plan.commands[0].command, plan.commands[0].args, { stdio: 'inherit' });
  const packageJson = fs.readFileSync(path.join(plan.packageRoot, 'package.json'));
  const packageLock = fs.readFileSync(path.join(plan.packageRoot, 'package-lock.json'));
  const sourceBefore = sourceTreeDigest(plan.packageRoot);
  execFileSync(plan.commands[1].command, plan.commands[1].args, { cwd: plan.packageRoot, stdio: 'inherit' });
  assert.equal(sourceTreeDigest(plan.packageRoot), sourceBefore, 'Dependency installation changed pinned source');
  const require = createRequire(path.join(plan.packageRoot, 'package.json'));
  const sdkEntry = require.resolve('@bsv/sdk');
  const sdkPackage = fs.readFileSync(path.join(plan.packageRoot, 'node_modules/@bsv/sdk/package.json'));
  const installed = JSON.parse(sdkPackage);
  const locked = JSON.parse(packageLock).packages['node_modules/@bsv/sdk'];
  assert.equal(installed.name, '@bsv/sdk');
  assert.equal(installed.version, locked.version);
  const { PrivateKey } = await import(pathToFileURL(sdkEntry).href);
  assert.equal(PrivateKey.fromHex('01'.padStart(64, '0')).toPublicKey().toString(), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
  const inputs = ['scripts/prepare-messaging.mjs', 'scripts/messaging-preparation.mjs', 'components/messaging/identity.mjs', 'components/messaging/sources.lock.json'];
  const paths = { 'typescript-messagebox': plan.packageRoot };
  const receipt = {
    schema: 'tpnil-native-messaging-verifier-preparation@1',
    mode: 'native-verifier-only', serviceRuntimePrepared: false,
    startedAt, completedAt: new Date().toISOString(),
    source: { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0, files: Object.fromEntries(inputs.map(file => [file, sha256(fs.readFileSync(path.join(root, file)))])) },
    runtime: { node: process.versions.node, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), platform: process.platform, arch: process.arch },
    component: plan.component, archive: { path: plan.archive, sha256: sha256(fs.readFileSync(plan.archive)), bytes: fs.statSync(plan.archive).size },
    package: { path: plan.packageRoot, jsonSha256: sha256(packageJson), lockSha256: sha256(packageLock), sourceTreeSha256: sourceBefore },
    sdk: { name: installed.name, version: installed.version, resolved: locked.resolved, integrity: locked.integrity, packageSha256: sha256(sdkPackage), entry: path.relative(plan.packageRoot, sdkEntry), entrySha256: sha256(fs.readFileSync(sdkEntry)), publicKeyCheck: 'PASS' },
    commands: plan.commands, paths, verifierEnvironment: { TPNIL_MESSAGING_PATHS: path.join(plan.cache, 'paths.json') },
    capabilities: { offlineNativeMessagingVerification: true, serviceBuild: false, nativeSqliteRebuild: false, goBuild: false, discoveryPreparation: false }
  };
  fs.writeFileSync(path.join(plan.cache, 'paths.json'), JSON.stringify(paths, null, 2) + '\n');
  fs.writeFileSync(path.join(plan.cache, 'verifier-preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
