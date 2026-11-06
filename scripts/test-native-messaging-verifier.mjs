// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { verifyNativeMessaging } from './verify-native-messaging.mjs';
import { sha256 } from '../components/messaging/identity.mjs';
const original = path.resolve(process.argv[2]); await verifyNativeMessaging(original);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tpnil-native-message-verifier-'));
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file)));
const write = (file, data) => fs.writeFileSync(path.join(directory, file), JSON.stringify(data));
function rebind(result) { for (const item of result.evidence) item.sha256 = sha256(JSON.stringify(read(item.path))); write('result.json', result); }
try {
  fs.cpSync(original, directory, { recursive: true });
  let result = read('result.json'), payment = read('typescript-native-payment.json');
  payment.recipientActions.actions = []; write('typescript-native-payment.json', payment); rebind(result);
  await assert.rejects(verifyNativeMessaging(directory), /Exact recipient wallet receipt absent/);
  fs.cpSync(original, directory, { recursive: true });
  result = read('result.json'); payment = read('typescript-native-payment.json');
  const paths = JSON.parse(fs.readFileSync('out/messaging-sources/paths.json'));
  const require = createRequire(path.join(paths['typescript-messagebox'], 'package.json'));
  const { Transaction } = await import(pathToFileURL(require.resolve('@bsv/sdk')).href);
  const transaction = Transaction.fromBEEF(payment.request.payment.tx); transaction.outputs[1].satoshis += 1;
  payment.request.payment.tx = transaction.toAtomicBEEF(); payment.txid = transaction.id('hex');
  write('typescript-native-payment.json', payment); rebind(result);
  await assert.rejects(verifyNativeMessaging(directory), /Payment script\/ancestry invalid|Script evaluation error/);
  // Flattening and JSON reformatting are how the native evidence envelope saves
  // the helper's data. Verify that those operations preserve the binding.
  fs.rmSync(directory, { recursive: true }); fs.mkdirSync(directory);
  const valid = JSON.parse(fs.readFileSync(path.join(original, 'result.json')));
  write('messaging.json', valid);
  for (const item of valid.evidence) write(`messaging-${item.path}`, JSON.parse(fs.readFileSync(path.join(original, item.path))));
  await verifyNativeMessaging(directory);
  console.log('Native messaging verifier: 2 independent negative cases and flattened evidence passed');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }
