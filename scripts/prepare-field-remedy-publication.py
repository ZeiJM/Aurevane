"""Bind the reviewed one-record publication SQL offline. Never executes SQL.

Requires a fresh catalogue CAS token plus the separately read current Field Remedy
row. The SQL independently rechecks the current row and highest history version.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / 'docs/verification/release-assets/2026-10-29-field-remedy-recovery-publication.sql'
_spec = importlib.util.spec_from_file_location('field_remedy_candidate', ROOT / 'scripts/prepare-field-remedy-recovery.py')
_candidate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_candidate)


def prepare(*, live_definition, catalogue_token):
    reviewed = json.loads(_candidate.OUTPUT.read_text())
    if reviewed != _candidate.candidate():
        raise ValueError('Candidate differs from the deterministic reviewed preparation')
    if not isinstance(catalogue_token, str) or not re.fullmatch('[a-f0-9]{32}', catalogue_token):
        raise ValueError('A fresh 32-character catalogue CAS token is required')
    record, = reviewed['records']
    if not isinstance(live_definition, dict):
        raise ValueError('A current Field Remedy row is required')
    definition = live_definition.get('definition')
    version = live_definition.get('content_version')
    if version == 7 and definition == record['before']:
        expected_outcome = 'append-v8'
    elif version == 8 and definition == record['after']:
        expected_outcome = 'already-published-no-op'
    else:
        raise ValueError('Current Field Remedy differs from the reviewed before/after definitions')
    sql = TEMPLATE.read_text()
    for token, value in [('__BEFORE_JSON__', record['before']), ('__AFTER_JSON__', record['after'])]:
        payload = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        if any(delimiter in payload for delimiter in ('$field_remedy_before$', '$field_remedy_after$', '$publish_field_remedy$')):
            raise ValueError('Unsafe SQL delimiter in candidate')
        sql = sql.replace(token, payload)
    sql = sql.replace('__EXPECTED_CATALOGUE_TOKEN__', catalogue_token)
    if re.search(r'__[A-Z_]+__', sql):
        raise ValueError('Unbound SQL placeholder')
    return sql, {'record': record['id'], 'beforeVersion': 7, 'afterVersion': 8,
                 'expectedOutcome': expected_outcome, 'candidateDigest': _candidate.digest(reviewed),
                 'bytes': len(sql.encode())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live-definition', type=Path, required=True)
    parser.add_argument('--catalogue-token', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        sql, receipt = prepare(live_definition=json.loads(args.live_definition.read_text()),
                               catalogue_token=args.catalogue_token)
    except ValueError as error:
        parser.error(str(error))
    args.output.write_text(sql)
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
