"""Prepare Field Remedy and Dawn’s Oath recovery versions locally; never publishes.

Frozen release sources remain immutable. A live catalogue readback and exact before
comparison are still required before publishing this two-record candidate.
"""
from copy import deepcopy
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/verification/release-assets/2026-10-29-field-remedy-recovery-candidate.json'
LIVE_AUDIT = ROOT / 'docs/verification/release-assets/2026-10-29-recovery-live-audit.json'
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
    records = [{'id': original['id'], 'kind': original['kind'],
                'beforeVersion': before['contentVersion'], 'beforeDigest': digest(before),
                'afterDigest': digest(after), 'before': before, 'after': after}]
    oath = current['essence.dawnshield.dawns-oath']
    oath_before = oath['after']
    oath_after = deepcopy(oath_before)
    oath_behavior, = oath_after['ability']['behaviors']
    oath_cleanse, oath_recovery, oath_guard = oath_behavior['effects']
    oath_expected_gate = deepcopy(expected_gate)
    for child in oath_expected_gate['children']:
        child['subject'] = 'selected'
    if (oath_before['contentVersion'] != 7 or oath_behavior['requirements'] is not None or
            oath_cleanse['payload']['type'] != 'remove-status' or
            oath_recovery['payload']['type'] != 'percentage-recovery' or
            oath_recovery['payload']['resource'] != 'hp' or
            oath_recovery['payload']['percentageBasisPoints'] != 1400 or
            oath_recovery.get('requirements') != oath_expected_gate or
            oath_guard['payload']['statusId'] != 'guarded'):
        raise ValueError('Dawn’s Oath effect order or eligibility changed; review it first')
    del oath_recovery['requirements']
    oath_after['contentVersion'] = 8
    oath_after['skill']['contentVersion'] = 8
    oath_after['flavorLine'] = 'Cleanse and shield a friendly, restoring health.'
    records.append({'id': oath['id'], 'kind': oath['kind'],
                    'beforeVersion': 7, 'beforeDigest': digest(oath_before),
                    'afterDigest': digest(oath_after), 'before': oath_before, 'after': oath_after})
    live = json.loads(LIVE_AUDIT.read_text())
    for record in records:
        actual = next(row for row in live['targets'] if row['content_key'] == record['id'])
        if actual['content_version'] != record['beforeVersion'] or actual['definition'] != record['before']:
            raise ValueError('Fresh audited recovery baseline differs from frozen source; review it first')
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
                                  'decision': 'remove-recovery-gate' if row['id'] in {r['id'] for r in records}
                                  else 'retain-meaningful-conditional-bonus'})
    return {
        'schemaVersion': 1,
        'status': 'unpublished-candidate-requires-fresh-live-catalogue-review',
        'sourceManifests': [{'path': relative, 'sha256': sha256((ROOT / relative).read_bytes()).hexdigest()}
                            for relative, _ in SOURCES],
        'inventoryCount': len(current),
        'unchangedCurrentCount': len(current) - len(records),
        'liveAudit': {'path': str(LIVE_AUDIT.relative_to(ROOT)), 'sha256': sha256(LIVE_AUDIT.read_bytes()).hexdigest(),
                      'capturedAt': live['capturedAt'], 'inventoryCount': live['currentCount'],
                      'unchangedCurrentCount': live['currentCount'] - len(records)},
        'immutableHistoryPreserved': True,
        'reason': 'Owner requested unconditional capped HP Recovery after Cleanse for Field Remedy and similar Skills; Requirements describe the whole Skill.',
        'records': records,
        'effectRequirementAudit': audit,
    }


if __name__ == '__main__':
    result = candidate()
    OUTPUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'candidate': str(OUTPUT.relative_to(ROOT)), 'changed': len(result['records']),
                      'effectLocalGatesBefore': len(result['effectRequirementAudit'])}))
