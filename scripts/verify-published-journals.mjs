import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { verifyIntakeReview } from '../src/intake.mjs';
import { ROOT } from '../src/core.mjs';
import { verifyJournal } from '../src/journal.mjs';
import { verifyQualification } from '../src/qualification.mjs';
import { verifyNativeQualification } from '../src/native-qualification.mjs';
import { verifyComponentQualification } from '../src/component-qualification.mjs';
import { verifyRuntimeQualification } from '../src/runtime-qualification.mjs';
import { verifyReferenceQualification } from '../src/reference-qualification.mjs';
import { verifySynthesisStackQualification } from '../src/synthesis-stack-qualification.mjs';
import { verifyNativeObservation, verifyWalletRun, verifyWalletRunSeries } from '../src/sut-evidence.mjs';
let nativeWalletQualificationCount = 0, nativeWalletAttemptCount = 0;
let count = 0, intakeCount = 0, qualificationCount = 0, nativeQualificationCount = 0;
let componentQualificationCount = 0, runtimeQualificationCount = 0;
let referenceQualificationCount = 0;
let synthesisStackCount = 0;
let nativeObservationCount = 0, experimentalWalletRunCount = 0, experimentalWalletSeriesCount = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Published journal tree contains a symlink');
    if (entry.isDirectory()) walk(file);
    else if (file.startsWith(path.join(ROOT, 'journals/intake') + path.sep) && entry.name.endsWith('.json')) {
      verifyIntakeReview(file, path.join(ROOT, 'journals/intake/objects')); intakeCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/qualification') + path.sep) && entry.name === 'record.json') {
      verifyQualification(dir); qualificationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/native-qualification') + path.sep) && entry.name === 'record.json') {
      verifyNativeQualification(dir); nativeQualificationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/component-qualification') + path.sep) && entry.name === 'record.json') {
      verifyComponentQualification(dir); componentQualificationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/runtime-qualification') + path.sep) && entry.name === 'record.json') {
      verifyRuntimeQualification(dir); runtimeQualificationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/reference-qualification') + path.sep) && entry.name === 'record.json') {
      verifyReferenceQualification(dir); referenceQualificationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/synthesis-stack-qualification') + path.sep) && entry.name === 'result.json') {
      verifySynthesisStackQualification(dir); synthesisStackCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/native-observation') + path.sep) && entry.name === 'record.json') {
      verifyNativeObservation(dir); nativeObservationCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/wallet-runs') + path.sep) && entry.name === 'record.json') {
      verifyWalletRun(dir); experimentalWalletRunCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/wallet-runs') + path.sep) && entry.name === 'series.json') {
      verifyWalletRunSeries(dir); experimentalWalletSeriesCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/native-wallet-attempts') + path.sep) && entry.name === 'attempt.json') {
      const attempt = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(attempt.schema, 'tpnil-native-wallet-attempt@1.0.0');
      assert.ok(['OBSERVER_STARTUP_ERROR', 'OBSERVER_EXECUTION_ERROR'].includes(attempt.claim));
      assert.ok(attempt.files.length > 0);
      const actual = fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter(item => item.isFile()).map(item => path.relative(dir, path.join(item.parentPath, item.name)).split(path.sep).join('/')).filter(name => name !== 'attempt.json').sort();
      assert.deepEqual(attempt.files.map(item => item.name).sort(), actual);
      for (const item of attempt.files) {
        assert.ok(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(item.name) && !item.name.includes('..'));
        const bytes = fs.readFileSync(path.join(dir, item.name));
        assert.equal(bytes.length, item.size);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
      }
      nativeWalletAttemptCount++;
    }
    else if (file.startsWith(path.join(ROOT, 'journals/native-wallet-qualification') + path.sep) && entry.name === 'qualification.json') {
      execFileSync(path.join(ROOT, 'synthesis/node_modules/.bin/tsx'), [path.join(ROOT, 'synthesis/src/wallet-lab/native/verify.ts'), dir], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
      nativeWalletQualificationCount++;
    }
    else if (entry.name === 'journal.jsonl') { verifyJournal(dir); count++; }
  }
}
walk(path.join(ROOT, 'journals'));
console.log(JSON.stringify({
  verifiedPublishedSelfTestJournals: count,
  verifiedIntakeReviews: intakeCount,
  verifiedInfrastructureQualifications: qualificationCount,
  verifiedNativeInfrastructureQualifications: nativeQualificationCount,
  verifiedComponentQualifications: componentQualificationCount,
  verifiedRuntimeQualifications: runtimeQualificationCount,
  verifiedReferenceQualifications: referenceQualificationCount,
  verifiedSynthesisStacks: synthesisStackCount,
  verifiedNativeObservations: nativeObservationCount,
  verifiedExperimentalWalletRuns: experimentalWalletRunCount,
  verifiedExperimentalWalletSeries: experimentalWalletSeriesCount,
  verifiedNativeWalletQualifications: nativeWalletQualificationCount,
  verifiedNativeWalletFailedAttempts: nativeWalletAttemptCount,
  officialSutRuns: 0
}));
