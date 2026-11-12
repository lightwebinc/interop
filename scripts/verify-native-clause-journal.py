#!/usr/bin/env python3
"""Verify retained reference bytes and replay only the explicitly final diagnostic reports."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

root = Path(__file__).resolve().parent.parent
directory = root / (sys.argv[1] if len(sys.argv) > 1 else 'journals/native-clause-reference/2026-11-09')
journal = json.loads((directory / 'journal.json').read_text())
assert journal['nativeQualification'] is False
assert journal['claim'] == 'ENGINEERING_OBSERVATION_ONLY'
replayed = []
with tempfile.TemporaryDirectory(prefix='tpnil-clause-replay-') as temporary:
    for attempt in journal['attempts']:
        archive = directory / attempt['archive']
        raw = archive.read_bytes()
        assert len(raw) == attempt['archiveBytes']
        assert hashlib.sha256(raw).hexdigest() == attempt['archiveSha256']
        expected = {entry['path']: entry for entry in attempt['files']}
        with zipfile.ZipFile(archive) as bundle:
            assert len(bundle.namelist()) == len(expected)
            assert set(bundle.namelist()) == set(expected)
            for name in bundle.namelist():
                assert not Path(name).is_absolute() and '..' not in Path(name).parts
                data = bundle.read(name)
                assert len(data) == expected[name]['bytes']
                assert hashlib.sha256(data).hexdigest() == expected[name]['sha256']
                if attempt['attempt'] in journal['finalReplayedAttempts']:
                    target = Path(temporary) / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
        if attempt['attempt'] in journal['finalReplayedAttempts']:
            target = Path(temporary) / attempt['attempt']
            command = [os.environ.get('TPNIL_NODE', 'node'), str(root / 'scripts/verify-conformance-clauses.mjs'), str(target / 'clauses/evidence/conformance/clauses.json'), '--reference', '--boundary', str(target / 'observations.json')]
            result = subprocess.run(command, cwd=root, check=True, text=True, capture_output=True)
            verified = json.loads(result.stdout)
            assert verified['verified'] is True
            assert verified['counts'] == journal['finalCounts']
            assert verified['completeBRC100Conformance'] is False
            replayed.append(attempt['attempt'])
assert sorted(replayed) == sorted(journal['finalReplayedAttempts'])
print(json.dumps({'verified': True, 'archives': len(journal['attempts']), 'replayed': replayed, 'countsPerFinalAttempt': journal['finalCounts'], 'nativeQualification': False}))
