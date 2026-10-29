"""Bind the reviewed two-record publication SQL offline. Never executes SQL.

Requires a fresh catalogue CAS token plus the separately read current Field Remedy and Dawn’s Oath
rows. The SQL independently rechecks the current row and highest history version.
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
    records = reviewed['records']
    if (not isinstance(live_definition, list) or len(live_definition) != len(records) or
            any(not isinstance(row, dict) for row in live_definition) or
            {row.get('content_key') for row in live_definition} != {row['id'] for row in records}):
        raise ValueError('Current rows for both reviewed recovery definitions are required')
    sql = TEMPLATE.read_text()
    outcomes = []
    for record in records:
        live = next(row for row in live_definition if row['content_key'] == record['id'])
        if live.get('content_version') == 7 and live.get('definition') == record['before']:
            outcome = 'append-v8'
        elif live.get('content_version') == 8 and live.get('definition') == record['after']:
            outcome = 'already-published-no-op'
        else:
            raise ValueError('Current recovery definition differs from reviewed before/after: ' + record['id'])
        outcomes.append({'id': record['id'], 'beforeVersion': 7, 'afterVersion': 8, 'expectedOutcome': outcome})
        prefix = '' if record['id'] == 'wildwarden.field-remedy' else 'OATH_'
        for suffix, value in [('BEFORE', record['before']), ('AFTER', record['after'])]:
            payload = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
            if any(delimiter in payload for delimiter in ('$field_remedy_before$', '$field_remedy_after$', '$publish_field_remedy$',
                                                         '$dawns_oath_before$', '$dawns_oath_after$', '$publish_dawns_oath$')):
                raise ValueError('Unsafe SQL delimiter in candidate')
            sql = sql.replace('__' + prefix + suffix + '_JSON__', payload)
    expected_outcome = ('already-published-no-op' if all(row['expectedOutcome'] == 'already-published-no-op' for row in outcomes)
                        else 'append-v8')
    sql = sql.replace('__EXPECTED_CATALOGUE_TOKEN__', catalogue_token)
    if re.search(r'__[A-Z_]+__', sql):
        raise ValueError('Unbound SQL placeholder')
    return sql, {'records': outcomes,
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
