#!/usr/bin/env python3
"""Run the opt-in native WebView test twice against an isolated SQLite directory."""
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
binary = root / 'src-tauri/target/debug/folio'
work = Path(tempfile.mkdtemp(prefix='folio-native-'))
print(f'Native test data: {work}', flush=True)
reports = []
for phase in ('1', '2'):
    env = {**os.environ, 'FOLIO_SMOKE_DIR': str(work), 'FOLIO_SMOKE_PHASE': phase}
    result = subprocess.run([str(binary)], env=env, capture_output=True, text=True, timeout=150)
    report_path = work / f'report-{phase}.json'
    if not report_path.exists():
        raise RuntimeError(f'Native phase {phase} produced no report: {result.stderr[-4000:]}')
    report = json.loads(report_path.read_text())
    print(json.dumps(report, indent=2), flush=True)
    if not report['ok'] or result.returncode:
        raise RuntimeError(f'Native phase {phase} failed: {result.stderr[-4000:]}')
    reports.append(report)
    db_path = next((work/'projects').glob('*/project.sqlite3'))
    with sqlite3.connect(db_path) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        project = json.loads(db.execute('SELECT data FROM project').fetchone()[0])
        text = next(e['text'] for e in project['entries'] if e['id'] == project['order'][0])
        assert ('Rapid final text must survive native quit.' if phase=='1' else 'Original prose kept for a fragment.') in text
        mirror = json.loads((db_path.parent/'project.json').read_text())
        assert mirror == project, 'Portable mirror differs from SQLite'
        assert db.execute('SELECT count(*) FROM snapshots').fetchone()[0] >= int(phase)
summary = {'ok': True, 'phases': reports, 'dataDirectory': str(work), 'checks':['SQLite integrity', 'quit flush', 'process restart', 'fragment extraction and restore', 'snapshot restore and safety snapshot', 'portable JSON matches database']}
(root/'test-results').mkdir(exist_ok=True)
(root/'test-results/native-smoke.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Native WebView + SQLite smoke test passed.', flush=True)
