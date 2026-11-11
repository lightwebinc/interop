#!/usr/bin/env python3
"""Verify retained correction evidence without executing wallet/verifier code."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
import hashlib
import json
import re

root = Path(__file__).resolve().parent
index = json.loads((root / 'index.json').read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
archive = (root / 'evidence.zip').read_bytes()
assert index['schema'] == 'tpnil-native-invocation-correction@1'
assert index['claim'] == 'ENGINEERING_CORRECTION_NOT_NATIVE_QUALIFICATION'
assert index['nativeSessionsExecuted'] == 0
assert index['originalLocalReceiptChanged'] is False
assert len(archive) == index['evidenceZip']['bytes']
assert sha(archive) == index['evidenceZip']['sha256']
with ZipFile(root / 'evidence.zip') as zipped:
    names = zipped.namelist()
    assert len(names) == len(set(names))
    assert sorted(names) == sorted(index['members'])
    members = {}
    for name in names:
        assert not PurePosixPath(name).is_absolute()
        assert '..' not in PurePosixPath(name).parts
        data = zipped.read(name)
        expected = index['members'][name]
        assert len(data) == expected['bytes'] and sha(data) == expected['sha256']
        members[name] = data
read = lambda name: json.loads(members[name])
original = read('original/local-1-receipt.json')
assert original['source'] == index['originalLocalSource']
assert original['result'] == 'PASS'  # Original claim is preserved, not rewritten.
empty_logs = [name for name in names if name.startswith('original/logs/')]
assert len(empty_logs) == 3
assert all(members[name] == b'\n' for name in empty_logs)
scope = read('review/local-invocation-scope-review.json')
assert scope['localSource'] == index['originalLocalSource']
assert scope['originalNativeSource'] == index['originalNativeSource']
assert len(scope['silentlySkipped']) == 3
assert sum(row['emptyAfterTrim'] for row in scope['logs']) == 3
alias = read('review/path-alias-reproduction.json')
assert alias['alias']['status'] == 0 and alias['alias']['stdout'] == ''
assert alias['canonical']['status'] == 0
assert json.loads(alias['canonical']['stdout']) == {'verified': True}
review = read('review/cli-invocation-correction-review.json')
assert review['sourceInputs'] == index['correctionInputs']
for name, expected in index['correctionInputs'].items():
    data = members['corrected-source/' + name]
    assert len(data) == expected['bytes'] and sha(data) == expected['sha256']
for mode in ['canonical', 'exported']:
    replay = read('messaging-review/replay-review-' + mode + '.json')
    assert replay['source'] == index['originalNativeSource']
    assert replay['newNativeSessions'] == 0
    assert [row['index'] for row in replay['repetitions']] == [1, 2]
    for row in replay['repetitions']:
        assert row['exitCode'] == 0 and row['assertions'] == 6
        assert row['report']['verified'] is True
        assert row['report']['assertions'] == 6
for name, count in [('cli-invocation-correction-final-tests.log', 27), ('canonical-invocation-core-20261111.log', 112)]:
    text = members['checks/' + name].decode()
    assert re.search(r'\bpass ' + str(count) + r'\b', text)
    assert re.search(r'\bfail 0\b', text)
print(json.dumps({'schema': 'tpnil-invocation-correction-integrity@1', 'integrityVerified': True, 'members': len(members), 'withdrawnFullLocalReplayClaim': True, 'nativeSessionsExecuted': 0, 'verifierExecutions': 0}))
