"""Bind reviewed modular-correction release SQL locally, without network or execution.

Publication and rollback require a fresh exact catalogue inventory, Owner UUID,
and the40hex source already verified READY with compatible historical readers.
Readback is read-only and supports published or rolled-back pointer expectations.
"""
from copy import deepcopy
from hashlib import sha256
import argparse
import importlib.util
import json
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs/verification/release-assets'
PREFIX = '2026-10-19-resonance-modularity'
CANDIDATE = ROOT / 'docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json'
DESIGNS = ROOT / 'docs/superpowers/specs/2026-10-19-resonance-modularity-designs.json'
_spec = importlib.util.spec_from_file_location('modular_preparation', ROOT / 'scripts/prepare-resonance-modularity.py')
_preparation = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_preparation)
POLICY = _preparation.POLICY
canonical = _preparation.canonical
digest = _preparation.digest


def sha(path):
    return sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_reviewed():
    current = _preparation.effective_baseline()
    candidate = json.loads(CANDIDATE.read_text())
    control = json.loads((ASSETS / f'{PREFIX}-release-control.json').read_text())
    require(candidate == _preparation.candidate(), 'Candidate differs from deterministic reviewed preparation')
    require(control['candidateSha256'] == sha(CANDIDATE) and control['designSha256'] == sha(DESIGNS),
            'Reviewed candidate/design manifest SHA mismatch')
    require(control['baselineManifests'] == candidate['baselineManifests'], 'Baseline manifest bindings differ')
    for source in control['baselineManifests']:
        require(source['sha256'] == sha(ROOT / source['path']), 'Frozen baseline SHA mismatch')
    rows = []
    for row in candidate['records']:
        before = current[row['id']]['after']
        require(row['kind'] == current[row['id']]['kind'] and
                row['beforeVersion'] == before['contentVersion'] and row['beforeDigest'] == digest(before) and
                row['after']['contentVersion'] == row['beforeVersion'] + 1,
                'Invalid exact before identity/version/digest: ' + row['id'])
        rows.append({**deepcopy(row), 'before': deepcopy(before)})
    require(len(rows) == len({row['id'] for row in rows}) == 68 and len(current) == 294 and
            {kind: sum(row['kind'] == kind for row in rows) for kind in ('skill', 'essence', 'resonance')} ==
            {'skill': 9, 'essence': 1, 'resonance': 58}, 'Invalid narrow68-record release scope')
    return {'baseline': [{'kind': row['kind'], 'id': row['id'], 'after': row['after']} for row in current.values()],
            'rows': rows, 'candidate': candidate, 'control': control}


def expected_publications(reviewed, mode):
    expected = {row['id']: {'content_key': row['id'],
                           'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'],
                           'content_version': row['after']['contentVersion'], 'definition': row['after']}
                for row in reviewed['baseline']}
    if mode == 'rollback':
        for row in reviewed['rows']:
            expected[row['id']].update(content_version=row['after']['contentVersion'], definition=row['after'])
    return expected


def bind_inventory(reviewed, mode, inventory):
    require(isinstance(inventory, dict), 'Publication/rollback require a fresh inventory')
    token = inventory.get('token')
    require(isinstance(token, str) and bool(re.fullmatch('[a-f0-9]{32}', token)), 'Invalid fresh inventory CAS token')
    require(all(inventory.get(key) == value for key, value in
                {'history': 719 if mode == 'publication' else 787, 'current': 294, 'drafts': 0, 'policy': POLICY}.items()),
            'Fresh inventory counts/drafts/policy mismatch')
    rows = inventory.get('publications', [])
    require(isinstance(rows, list) and all(isinstance(row, dict) for row in rows), 'Invalid inventory publications')
    actual = {row.get('content_key'): {key: row.get(key) for key in
              ('content_key', 'content_kind', 'content_version', 'definition')} for row in rows}
    require(len(rows) == len(actual) == 294 and actual == expected_publications(reviewed, mode),
            'Fresh inventory exact definitions differ from reviewed release state')
    return token


def prepare(mode, *, actor=None, inventory=None, deployed_sha=None, state='published'):
    require(mode in ('publication', 'rollback', 'readback'), 'Unknown release-control mode')
    require(state in ('published', 'rolled-back'), 'Unknown readback pointer expectation')
    reviewed = load_reviewed()
    path = ASSETS / f'{PREFIX}-{mode}.sql'
    require(reviewed['control']['templates'][mode] == sha(path), 'Reviewed SQL template SHA mismatch')
    sql = path.read_text()
    if deployed_sha is not None:
        require(isinstance(deployed_sha, str) and bool(re.fullmatch('[a-f0-9]{40}', deployed_sha)),
                'Compatible deployed source must be exact40hex SHA')
    if mode != 'readback':
        require(actor is not None and deployed_sha is not None, 'Owner UUID and compatible deployed source required')
        try:
            actor = str(uuid.UUID(str(actor)))
        except ValueError as error:
            raise ValueError('Invalid Owner UUID') from error
        token = bind_inventory(reviewed, mode, inventory)
        sql = sql.replace('__OWNER_ACTOR_UUID__', actor).replace('__EXPECTED_CATALOGUE_TOKEN__', token)
    cohort_json = json.dumps(reviewed['rows'], ensure_ascii=False, separators=(',', ':'))
    baseline_json = json.dumps(reviewed['baseline'], ensure_ascii=False, separators=(',', ':'))
    for delimiter in ('$modularity_cohort$', '$modularity_baseline$'):
        require(delimiter not in cohort_json and delimiter not in baseline_json, 'Unsafe SQL delimiter in reviewed definitions')
    replacements = {'__COHORT_JSON__': cohort_json, '__BASELINE_JSON__': baseline_json,
                    '__CANDIDATE_SHA256__': sha(CANDIDATE), '__DESIGN_SHA256__': sha(DESIGNS),
                    '__EFFECTIVE_BASELINE_SHA256__': digest(reviewed['baseline']),
                    '__DEPLOYED_SHA__': deployed_sha or '', '__READBACK_STATE__': state,
                    '__POLICY_JSON__': json.dumps(POLICY, separators=(',', ':'))}
    for key, value in replacements.items():
        sql = sql.replace(key, value)
    require(not re.search(r'__[A-Z_]+__', sql), 'Unbound release SQL placeholder')
    return sql, {'mode': mode, 'state': state if mode == 'readback' else None,
                 'records': 68, 'appendedByKind': {'skill': 9, 'essence': 1, 'resonance': 58},
                 'historyBefore': 719 if mode == 'publication' else 787, 'historyAfter': 787,
                 'unchangedCurrent': 226, 'candidateSha256': sha(CANDIDATE), 'designSha256': sha(DESIGNS),
                 'effectiveBaselineSha256': digest(reviewed['baseline']), 'sourceSha': deployed_sha,
                 'bytes': len(sql.encode()), 'sha256': sha256(sql.encode()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['publication', 'rollback', 'readback'])
    parser.add_argument('--actor')
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--deployed-sha')
    parser.add_argument('--state', choices=['published', 'rolled-back'], default='published')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        inventory = json.loads(args.inventory.read_text()) if args.inventory else None
        sql, metadata = prepare(args.mode, actor=args.actor, inventory=inventory,
                                deployed_sha=args.deployed_sha, state=args.state)
    except ValueError as error:
        parser.error(str(error))
    args.output.write_text(sql)
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
