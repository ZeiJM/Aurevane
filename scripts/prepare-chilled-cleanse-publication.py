"""Bind guarded seven-record publication SQL offline; never executes SQL.

Supply a fresh externally read catalogue CAS token and all seven full current rows,
including audited authoring metadata. Never replace a stale supplied token silently.
"""
import argparse
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / 'docs/verification/release-assets/2026-10-29-chilled-cleanse-publication.sql'
_spec = importlib.util.spec_from_file_location('chilled_cleanse_candidate', ROOT / 'scripts/prepare-chilled-cleanse.py')
_candidate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_candidate)


def expected_live(record, *, published=False):
    result = deepcopy(record['baseline'])
    result['definition'] = deepcopy(record['after'] if published else record['before'])
    if published:
        result.update(content_version=record['afterVersion'], highest_version=record['afterVersion'],
                      version_floor=record['afterVersion'], revision=result['revision'] + 2,
                      draft_sequence=result['draft_sequence'] + 1)
    return result


def prepare(*, live_definition, catalogue_token):
    reviewed = json.loads(_candidate.OUTPUT.read_text())
    if reviewed != _candidate.candidate():
        raise ValueError('Candidate differs from deterministic reviewed preparation')
    if not isinstance(catalogue_token, str) or not re.fullmatch('[a-f0-9]{32}', catalogue_token):
        raise ValueError('A fresh 32-character catalogue CAS token is required')
    records = reviewed['records']
    if (not isinstance(live_definition, list) or len(live_definition) != len(records) or
            any(not isinstance(row, dict) for row in live_definition) or
            {row.get('content_key') for row in live_definition} != {row['id'] for row in records}):
        raise ValueError('All seven exact current rows with full definitions and metadata are required')
    outcomes = []
    for record in records:
        live = next(row for row in live_definition if row['content_key'] == record['id'])
        if live == expected_live(record):
            outcome = 'append'
        elif live == expected_live(record, published=True):
            outcome = 'already-published-no-op'
        else:
            raise ValueError('Live definition or authoring/history state differs from reviewed before/after: ' + record['id'])
        outcomes.append({'id': record['id'], 'beforeVersion': record['beforeVersion'],
                         'afterVersion': record['afterVersion'], 'expectedOutcome': outcome})
    payload = json.dumps(records, ensure_ascii=False, separators=(',', ':'))
    if '$chilled_records$' in payload or '$publish_chilled$' in payload:
        raise ValueError('Unsafe SQL delimiter in candidate')
    sql = (TEMPLATE.read_text().replace('__RECORDS_JSON__', payload)
           .replace('__EXPECTED_CATALOGUE_TOKEN__', catalogue_token))
    if re.search(r'__[A-Z_]+__', sql):
        raise ValueError('Unbound SQL placeholder')
    return sql, {'records': outcomes,
                 'expectedOutcome': ('already-published-no-op' if all(row['expectedOutcome'] == 'already-published-no-op'
                                                                     for row in outcomes) else 'append'),
                 'candidateDigest': _candidate.digest(reviewed), 'bytes': len(sql.encode())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live-definition', type=Path, required=True)
    parser.add_argument('--catalogue-token', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        sql, receipt = prepare(live_definition=json.loads(args.live_definition.read_text()), catalogue_token=args.catalogue_token)
    except ValueError as error:
        parser.error(str(error))
    args.output.write_text(sql)
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
