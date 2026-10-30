"""Prepare the seven reviewed Chilled-only Conditional Cleanse versions offline.

Only exact actor-only frozen removal nodes gain specified removal and explicit self targeting. The
full audited definitions and authoring state are pinned; no database is contacted.
"""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIVE_AUDIT = ROOT / 'docs/verification/release-assets/2026-10-29-chilled-cleanse-live-audit.json'
OUTPUT = ROOT / 'docs/verification/release-assets/2026-10-29-chilled-cleanse-candidate.json'
REVIEWED_AUDIT_DIGEST = '66817b0caebc98894aa7dc0f6d9b8e003ccae5fa5ff9c45d577c71feb22e1a44'


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                            ensure_ascii=False).encode()).hexdigest()


def read_audit():
    return json.loads(LIVE_AUDIT.read_text())


def convert(node):
    """Represent actor-only Chilled removal explicitly without widening delivery."""
    count = 0
    if isinstance(node, dict):
        if (node.get('type') == 'remove-status' and node.get('statusIds') == ['frozen']
                and 'removalMode' not in node):
            if node.get('recipient') != 'actor' or ('target' in node and node['target'] != 'self'):
                raise ValueError('Chilled removal must retain its exact actor/self recipient')
            node['removalMode'] = 'specified'
            node['target'] = 'self'
            count += 1
        count += sum(convert(value) for value in node.values())
    elif isinstance(node, list):
        count += sum(convert(value) for value in node)
    return count


def candidate():
    audit = read_audit()
    if digest(audit) != REVIEWED_AUDIT_DIGEST:
        raise ValueError('Full reviewed audit changed; review the new live baseline first')
    records = []
    if len(audit['records']) != 7:
        raise ValueError('Expected seven reviewed current records')
    for live in audit['records']:
        before = live['definition']
        key, version = live['content_key'], live['content_version']
        if (live['has_draft'] or live['highest_version'] != version or
                live['version_floor'] != version or live['lifecycle'] != 'active' or
                live['restore_pending'] or before['contentVersion'] != version or
                before.get('id', before.get('essenceId')) != key):
            raise ValueError('Reviewed baseline has a draft, history or record-state conflict: ' + key)
        after = deepcopy(before)
        changed = convert(after)
        if not changed:
            raise ValueError('No Chilled removal conversion in reviewed definition: ' + key)
        after['contentVersion'] = version + 1
        if 'skill' in after:
            if after['skill'].get('id') != key or after['skill'].get('contentVersion') != version:
                raise ValueError('Nested Skill identity/version differs: ' + key)
            after['skill']['contentVersion'] = version + 1
        records.append({'id': key, 'kind': live['content_kind'], 'beforeVersion': version,
                        'afterVersion': version + 1, 'convertedNodes': changed,
                        'beforeDigest': digest(before), 'afterDigest': digest(after),
                        'baseline': {field: value for field, value in live.items() if field != 'definition'},
                        'before': deepcopy(before), 'after': after})
    return {'schemaVersion': 1,
            'status': 'unpublished-candidate-requires-fresh-live-catalogue-review',
            'reason': 'Owner consolidates Cleanse Chilled into Conditional Cleanse selecting only Chilled.',
            'liveAudit': {'path': str(LIVE_AUDIT.relative_to(ROOT)), 'digest': REVIEWED_AUDIT_DIGEST},
            'immutableHistoryPreserved': True, 'records': records}


if __name__ == '__main__':
    result = candidate()
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'candidate': str(OUTPUT.relative_to(ROOT)), 'changed': len(result['records']),
                      'convertedNodes': sum(row['convertedNodes'] for row in result['records'])}))
