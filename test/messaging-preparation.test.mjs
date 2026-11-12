// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseMessagingPreparationArgs, nativeVerifierPreparationPlan, prepareNativeMessagingVerifier } from '../scripts/messaging-preparation.mjs';
const lock = JSON.parse(fs.readFileSync(new URL('../components/messaging/sources.lock.json', import.meta.url)));
test('preparation defaults to the full closure and rejects unsupported or repeated flags', () => {
  assert.equal(parseMessagingPreparationArgs([]), 'full');
  assert.equal(parseMessagingPreparationArgs(['--native-verifier-only']), 'native-verifier-only');
  for (const args of [['--native-verifier'], ['--native-verifier-only', '--native-verifier-only'], ['--native-verifier-only', 'out/override']]) assert.throws(() => parseMessagingPreparationArgs(args), /Usage/);
  const result = spawnSync(process.execPath, ['scripts/prepare-messaging.mjs', '--unknown'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Usage/);
});
test('verifier selection cannot build Go, discovery or SQLite and uses a separate exact source path', () => {
  const plan = nativeVerifierPreparationPlan('/fixture', lock);
  assert.equal(plan.cache, '/fixture/out/messaging-native-verifier');
  assert.equal(plan.packageRoot, `/fixture/out/messaging-native-verifier/ts-stack-${lock.components[0].commit}/infra/message-box-server`);
  assert.deepEqual(plan.commands.map(item => [item.command, ...item.args]), [
    ['tar', '-xzf', plan.archive, '-C', plan.cache, `${plan.directory}/infra/message-box-server`],
    ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']
  ]);
  const duplicate = structuredClone(lock); duplicate.components.push(duplicate.components[0]);
  assert.throws(() => nativeVerifierPreparationPlan('/fixture', duplicate), /Exactly one/);
});
test('verifier preparation refuses aliased or complete service caches before mutation or network', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-verifier-cache-'));
  try {
    fs.mkdirSync(path.join(root, 'components/messaging'), { recursive: true });
    fs.writeFileSync(path.join(root, 'components/messaging/sources.lock.json'), JSON.stringify({ ...lock, node: process.versions.node }));
    const full = path.join(root, 'out/messaging-sources'), cache = path.join(root, 'out/messaging-native-verifier');
    fs.mkdirSync(full, { recursive: true }); fs.writeFileSync(path.join(full, 'build.json'), 'full service sentinel');
    fs.symlinkSync(full, cache, 'dir');
    await assert.rejects(prepareNativeMessagingVerifier(root), /must not alias/);
    assert.equal(fs.readFileSync(path.join(full, 'build.json'), 'utf8'), 'full service sentinel');
    fs.unlinkSync(cache); fs.mkdirSync(cache); fs.writeFileSync(path.join(cache, 'build.json'), 'keep');
    await assert.rejects(prepareNativeMessagingVerifier(root), /complete service closure/);
    assert.equal(fs.readFileSync(path.join(cache, 'build.json'), 'utf8'), 'keep');
    fs.unlinkSync(path.join(cache, 'build.json')); fs.writeFileSync(path.join(cache, 'paths.json'), JSON.stringify({ 'go-binary': 'keep' }));
    await assert.rejects(prepareNativeMessagingVerifier(root), /full service paths/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(cache, 'paths.json')))['go-binary'], 'keep');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
