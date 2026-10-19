"""Bind reviewed, append-only release SQL locally; never connects to a database.

Publication attests that --deployed-sha is already READY and verified on the
canonical deployment. Before promoting older code, restore compatible current
pointers; captured new definitions still need the compatible history reader.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs/verification/release-assets'
PREFIX = '2026-10-19-essence-resonance'
POLICY = {'version': 8, 'tagAuthority': 'global', 'modes': {
    'summon': 'instant', 'displace': 'instant', 'mp-drain': 'instant',
    'remove-status': 'instant', 'return-to-turn-start': 'controlled',
    'barrier-change': 'instant', 'blindside': 'instant'}}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['publication', 'rollback', 'readback'])
    parser.add_argument('--actor')
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--deployed-sha')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    previous_path = ROOT / 'docs/superpowers/specs/2026-10-18-modular-correction-cohort.json'
    candidate_path = ROOT / 'docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json'
    design_path = ROOT / 'docs/superpowers/specs/2026-10-19-essence-resonance-designs.json'
    previous = json.loads(previous_path.read_text())
    candidate = json.loads(candidate_path.read_text())
    control = json.loads((ASSETS / f'{PREFIX}-release-control.json').read_text())
    if candidate['previousManifestSha256'] != sha(previous_path) or candidate['designManifestSha256'] != sha(design_path) or control['candidateSha256'] != sha(candidate_path):
        parser.error('reviewed manifest SHA mismatch')
    baseline = previous['records']
    old = {row['id']: row for row in baseline}
    rows = []
    for row in candidate['records']:
        before = old[row['id']]['after']
        if row['kind'] not in ('essence', 'resonance') or old[row['id']]['kind'] != row['kind'] or row['beforeVersion'] != before['contentVersion'] or row['after']['contentVersion'] != row['beforeVersion'] + 1 or hashlib.sha256(canonical(before).encode()).hexdigest() != row['beforeDigest']:
            parser.error(f"invalid reviewed before identity/version/digest: {row['id']}")
        rows.append({**row, 'before': before})
    if len(rows) != len({row['id'] for row in rows}):
        parser.error('invalid cohort identity count')
    if len(rows) != 136 or sum(row['kind'] == 'resonance' for row in rows) != 131 or sum(row['kind'] == 'essence' for row in rows) != 5 or len(old) != 294:
        parser.error('invalid narrow release scope')
    sql_path = ASSETS / f'{PREFIX}-{args.mode}.sql'
    if control['templates'][args.mode] != sha(sql_path):
        parser.error('reviewed SQL SHA mismatch')
    sql = sql_path.read_text()
    if args.mode != 'readback':
        if not args.actor or not args.inventory or not args.deployed_sha or not re.fullmatch('[a-f0-9]{40}', args.deployed_sha):
            parser.error('publication/rollback require Owner UUID, fresh inventory, and verified compatible 40hex deployed source SHA')
        try:
            actor = str(uuid.UUID(args.actor))
        except ValueError:
            parser.error('invalid Owner UUID')
        inventory = json.loads(args.inventory.read_text())
        expected_history = 583 if args.mode == 'publication' else 719
        if not re.fullmatch('[a-f0-9]{32}', inventory.get('token', '')) or any(inventory.get(key) != value for key, value in {'history': expected_history, 'current': 294, 'drafts': 0, 'policy': POLICY}.items()):
            parser.error('fresh inventory counts/policy/token mismatch')
        current = inventory.get('publications', [])
        expected = {row['id']: {'content_key': row['id'], 'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'], 'content_version': row['after']['contentVersion'], 'definition': row['after']} for row in baseline}
        if args.mode == 'rollback':
            for row in rows:
                expected[row['id']].update(content_version=row['after']['contentVersion'], definition=row['after'])
        actual = {row['content_key']: {key: row[key] for key in ('content_key', 'content_kind', 'content_version', 'definition')} for row in current}
        if len(current) != 294 or actual != expected:
            parser.error('fresh inventory exact definitions differ from reviewed release')
        sql = sql.replace('__OWNER_ACTOR_UUID__', actor).replace('__EXPECTED_CATALOGUE_TOKEN__', inventory['token']).replace('__DEPLOYED_SHA__', args.deployed_sha)
    cohort_json = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    baseline_json = json.dumps(baseline, ensure_ascii=False, separators=(',', ':'))
    if '$identity_cohort$' in cohort_json or '$identity_baseline$' in baseline_json:
        parser.error('unsafe SQL delimiter in reviewed definitions')
    sql = sql.replace('__COHORT_JSON__', cohort_json).replace('__BASELINE_JSON__', baseline_json)
    if re.search(r'__[A-Z_]+__', sql):
        parser.error('unbound release SQL placeholder')
    args.output.write_text(sql)
    print(json.dumps({'mode': args.mode, 'records': len(rows), 'bytes': len(sql.encode()), 'sha256': hashlib.sha256(sql.encode()).hexdigest(), 'cohortSha256': sha(candidate_path), 'sourceSha': args.deployed_sha}))


if __name__ == '__main__':
    main()
