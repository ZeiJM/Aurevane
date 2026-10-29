"""Prepare the Owner-requested Field Remedy version locally; never publishes.

Frozen release sources remain immutable. A live catalogue readback and exact before
comparison are still required before publishing this one-record candidate.
"""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/verification/release-assets/2026-10-29-field-remedy-recovery-candidate.json'
SOURCES = [
    ('docs/superpowers/specs/2026-10-18-modular-correction-cohort.json', 'records'),
    ('docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json', 'records'),
    ('docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json', 'records'),
    ('docs/superpowers/specs/2026-10-19-simple-requirements-cohort.json', 'records'),
    ('docs/verification/release-assets/2026-10-22-resonance-trigger-fix.json', 'changed'),
    ('docs/verification/release-assets/2026-10-22-resonance-quality-candidate.json', 'changes'),
    ('docs/verification/release-assets/2026-10-22-passive-readiness-candidate.json', 'changed'),
]


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':'),
                            ensure_ascii=False).encode()).hexdigest()


def effective_catalogue():
    current = {}
    for relative, key in SOURCES:
        for row in json.loads((ROOT / relative).read_text())[key]:
            current[row['id']] = {**current.get(row['id'], {}), **row}
    if len(current) != 294:
        raise ValueError('Expected the complete frozen 294-definition catalogue')
    return current


def candidate():
    current = effective_catalogue()
    original = current['wildwarden.field-remedy']
    before = original['after']
    if before['contentVersion'] != 7:
        raise ValueError('Field Remedy baseline version changed; review it first')
    after = deepcopy(before)
    behavior, = after['ability']['behaviors']
    cleanse, recovery = behavior['effects']
    expected_gate = {'kind': 'any', 'children': [
        {'kind': 'status-presence', 'subject': 'owner', 'statusId': status, 'present': True}
        for status in ['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'mark',
                       'challenged', 'suppress']
    ]}
    if (behavior['requirements'] is not None or
            cleanse['payload']['type'] != 'remove-status' or
            recovery['payload']['type'] != 'percentage-recovery' or
            recovery['payload']['resource'] != 'hp' or
            recovery.get('requirements') != expected_gate):
        raise ValueError('Field Remedy effect order or eligibility changed; review it first')
    del recovery['requirements']
    after['contentVersion'] += 1
    after['flavorLine'] = 'Clear common afflictions and recover HP.'
    audit = []
    for row in current.values():
        for behavior in row['after']['ability']['behaviors']:
            for effect in behavior['effects']:
                if effect.get('requirements') is not None:
                    audit.append({'kind': row['kind'], 'id': row['id'],
                                  'contentVersion': row['after']['contentVersion'],
                                  'behaviorId': behavior['id'], 'effectId': effect['id'],
                                  'effectType': effect['payload']['type'],
                                  'skillRequirements': behavior['requirements'],
                                  'effectRequirements': effect['requirements'],
                                  'decision': 'remove-recovery-gate' if row['id'] == original['id']
                                  else 'retain-pending-individual-design-review'})
    return {
        'schemaVersion': 1,
        'status': 'unpublished-candidate-requires-fresh-live-catalogue-review',
        'sourceManifests': [{'path': relative, 'sha256': sha256((ROOT / relative).read_bytes()).hexdigest()}
                            for relative, _ in SOURCES],
        'inventoryCount': len(current),
        'unchangedCurrentCount': len(current) - 1,
        'immutableHistoryPreserved': True,
        'reason': 'Owner requested unconditional capped HP Recovery after Cleanse; Requirements describe the whole Skill.',
        'records': [{'id': original['id'], 'kind': original['kind'],
                     'beforeVersion': before['contentVersion'], 'beforeDigest': digest(before),
                     'afterDigest': digest(after), 'before': before, 'after': after}],
        'effectRequirementAudit': audit,
    }


if __name__ == '__main__':
    result = candidate()
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'candidate': str(OUTPUT.relative_to(ROOT)), 'changed': len(result['records']),
                      'effectLocalGatesBefore': len(result['effectRequirementAudit'])}))
