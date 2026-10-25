"""Read-only integrity check for the Task13 first repair checkpoint."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASE = '6668f3774dfeb83b672a493e32d49ab2ab446de9'
ROOT = Path(__file__).resolve().parents[3]
LEDGER = 'docs/verification/task-10-reconstruction/verification.jsonl'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

old = git('show', f'{BASE}:{LEDGER}')
current = (ROOT / LEDGER).read_bytes()
assert current.startswith(old)
assert len(old) == 523653
assert hashlib.sha256(old).hexdigest() == '585fd11298d5748492bf821a13977883a67e74ce9446038189dc111c222058e8'
assert hashlib.sha256(current[:470454]).hexdigest() == 'f8a0c43acbc1a29ef1a42b9ee2af4e2911a5d961bf008b33cfa5cb6cef78a3e7'
old_files = 0
for entry in git('ls-tree', '-rz', BASE, '--', 'docs/verification', 'supabase/migrations').split(b'\0'):
    if not entry:
        continue
    metadata, name = entry.split(b'\t', 1)
    name = name.decode()
    if name == LEDGER:
        continue
    blob = (ROOT / name).read_bytes()
    actual = hashlib.sha1(b'blob ' + str(len(blob)).encode() + b'\0' + blob).hexdigest()
    assert actual == metadata.split()[2].decode(), name
    old_files += 1
receipts = [json.loads(line) for line in current.splitlines()]
checked = []
for row in receipts:
    if row.get('task') != 'Task13' or 'raw_gzip' not in row:
        continue
    compressed = (ROOT / row['raw_gzip']).read_bytes()
    raw = gzip.decompress(compressed)
    assert hashlib.sha256(compressed).hexdigest() == row['gzip_sha256'], row['label']
    assert hashlib.sha256(raw).hexdigest() == row['raw_sha256'], row['label']
    checked.append(row['label'])
manifest = json.loads((ROOT / 'docs/verification/task-10-reconstruction/task13-fix1-browser-manifest.json').read_text())
for item in manifest:
    blob = (ROOT / item['path']).read_bytes()
    assert len(blob) == item['bytes'], item['path']
    assert hashlib.sha256(blob).hexdigest() == item['sha256'], item['path']
# A token-shaped string is a hard failure; no secrets are printed.
jwt = re.compile(rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')
for path in (ROOT / 'docs/verification/task-10-reconstruction').glob('task13-fix1-*'):
    files = path.rglob('*') if path.is_dir() else [path]
    for file in files:
        if not file.is_file() or file.suffix == '.png':
            continue
        blob = file.read_bytes()
        if file.suffix == '.gz':
            blob = gzip.decompress(blob)
        assert not jwt.search(blob), f'Token-shaped text in {file.name}'
assert not jwt.search(current[len(old):])
assert git('diff', '--check') == b''
print(json.dumps({
    'dispatch_head': BASE,
    'dispatch_ledger_bytes': len(old),
    'dispatch_ledger_sha256': hashlib.sha256(old).hexdigest(),
    'current_ledger_bytes_before_this_receipt': len(current),
    'old_verification_and_migration_files_unchanged': old_files,
    'task13_receipts_verified_before_this_receipt': len(checked),
    'fix1_receipts_verified_before_this_receipt': sum(label.startswith('fix1-') for label in checked),
    'new_browser_artifacts_verified': len(manifest),
    'new_browser_artifact_bytes': sum(item['bytes'] for item in manifest),
    'token_matches': 0,
}, indent=2))
