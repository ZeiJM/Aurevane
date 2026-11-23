"""Prepare the frozen simple Resonance cohort locally; never publishes or connects.

All 136 current Resonances and 30 other requirement-bearing definitions append one version. The three prior
manifests are immutable inputs, not complete replacement inventories. Publication
requires a compatible application first and an exact fresh 294-definition CAS.
"""
from copy import deepcopy
from hashlib import sha256
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '2026-10-19-simple-requirements'
DESIGNS = ROOT / f'docs/superpowers/specs/{PREFIX}-designs.json'
OUTPUT = ROOT / f'docs/superpowers/specs/{PREFIX}-cohort.json'
VALIDATION_TAG = 'owner-simple-requirements-20261019'
BASELINE_MANIFESTS = [
    {'path': 'docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
     'sha256': '998a68515af8cfbb2ce38ecb949fd595a044eb617175bf14d7520ca400c8d02f'},
    {'path': 'docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json',
     'sha256': 'd74c7e65bdf8b73560b5d890ba08c776b1a523c300fe3810e88013195a8892f1'},
    {'path': 'docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json',
     'sha256': '5b2a44f8b88489064e1e993af77023677c8cb83ed6e869d10fe6933b438c4534'},
]
HOOK_TARGET_SUBJECTS = {
    'after-action': 'selected', 'damage-dealt': 'affected', 'damage-taken': 'triggering',
    'healed': 'affected', 'resource-changed': 'affected', 'turn-started': 'owner',
    'barrier-hit': 'triggering', 'displaced': 'affected', 'rewound': 'affected',
    'ally-damage-taken': 'affected', 'enemy-turn-ended': 'triggering',
}
POLICY = {'version': 8, 'tagAuthority': 'global', 'modes': {
    'summon': 'instant', 'displace': 'instant', 'mp-drain': 'instant',
    'remove-status': 'instant', 'return-to-turn-start': 'controlled',
    'barrier-change': 'instant', 'blindside': 'instant'}}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def digest(value):
    return sha256(canonical(value).encode()).hexdigest()


def file_digest(path):
    return sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def effective_baseline():
    current = {}
    for index, manifest in enumerate(BASELINE_MANIFESTS):
        path = ROOT / manifest['path']
        require(file_digest(path) == manifest['sha256'], 'Frozen baseline SHA mismatch')
        data = json.loads(path.read_text())
        require(len(data['records']) == (294, 136, 68)[index], 'Unexpected baseline overlay size')
        if index == 1:
            require(data['previousManifestSha256'] == BASELINE_MANIFESTS[0]['sha256'],
                    'Identity baseline binding mismatch')
        if index == 2:
            require(data['baselineManifests'] == BASELINE_MANIFESTS[:2],
                    'Modularity baseline binding mismatch')
        require(len({row['id'] for row in data['records']}) == len(data['records']),
                'Duplicate baseline overlay identity')
        for row in data['records']:
            if index:
                before = current[row['id']]['after']
                require(row['kind'] == current[row['id']]['kind'] and
                        row['beforeVersion'] == before['contentVersion'] and
                        row['beforeDigest'] == digest(before) and
                        row['after']['contentVersion'] == row['beforeVersion'] + 1,
                        'Invalid exact overlay identity: ' + row['id'])
            current[row['id']] = deepcopy(row)
    require(len(current) == 294 and sum(row['kind'] == 'resonance' for row in current.values()) == 136,
            'Expected exact 294-definition / 136-Resonance baseline')
    return current


def is_simple_requirement(node, registered_status_ids=None):
    if node is None:
        return True
    if not isinstance(node, dict) or node.get('subject') not in ('owner', 'selected', 'affected', 'triggering'):
        return False
    if node.get('kind') == 'status-presence':
        return (set(node) == {'kind', 'subject', 'statusId', 'present'} and
                node['present'] is True and isinstance(node['statusId'], str) and
                (registered_status_ids is None or node['statusId'] in registered_status_ids))
    if node.get('kind') == 'prime-presence':
        return set(node) == {'kind', 'subject', 'present'} and node['present'] is True
    if node.get('kind') == 'resource-state':
        return (set(node) == {'kind', 'subject', 'resource', 'comparison', 'basisPoints'} and
                node['resource'] in ('hp', 'mp') and
                node['comparison'] in ('less-than', 'more-than') and
                type(node['basisPoints']) is int and 0 <= node['basisPoints'] <= 10000)
    return False


def validate_design(design, current):
    require(design['baselineManifests'] == BASELINE_MANIFESTS, 'Frozen design baseline binding mismatch')
    rows = design['records']
    resonances = {key: row for key, row in current.items() if row['kind'] == 'resonance'}
    expected = set(resonances) | {key for key, row in current.items() if row['after']['ability']['behaviors'][0]['requirements'] is not None} | {'essence.aetherist.aether-nova'}
    require(len(rows) == len({row['id'] for row in rows}) == 166 and
            {row['id'] for row in rows} == expected, 'Design must review all 136 Resonances and 30 other requirement-bearing definitions')
    registered = design['registeredStatusIds']
    require(isinstance(registered, list) and len(registered) == len(set(registered)),
            'Invalid frozen registered status options')
    for row in rows:
        before = current[row['id']]['after']
        require(row['kind'] == current[row['id']]['kind'] and
                (row['kind'] != 'resonance' or row['name'] == before['name'] and row['pair'] == before['disciplinePair']) and
                row['beforeVersion'] == before['contentVersion'] and row['beforeDigest'] == digest(before),
                'Design identity differs: ' + row['id'])
        require(len(before['ability']['behaviors']) == 1, 'Expected one behavior: ' + row['id'])
        behavior = before['ability']['behaviors'][0]
        require(is_simple_requirement(row['requirements'], registered), 'Not one registered simple requirement: ' + row['id'])
        trigger = row.get('automaticTrigger')
        require(trigger is None or trigger in HOOK_TARGET_SUBJECTS, 'Unknown finite native hook')
        require(trigger is None or behavior['activation'] == 'automatic' and behavior['mode'] == 'action',
                'Only Automatic Actions use finite execution hooks')
        target_subject = (HOOK_TARGET_SUBJECTS[trigger] if trigger else 'owner')
        allowed = {'owner', 'selected'} if behavior['activation'] == 'manual' or behavior['mode'] == 'modifier' and behavior['activation'] != 'ongoing' else {'owner', target_subject}
        requirement = row['requirements']
        require(requirement is None or requirement['subject'] in allowed,
                'Target role is unavailable for this execution preset: ' + row['id'])
        require(behavior['activation'] != 'ongoing' or requirement is None or requirement['subject'] == 'owner',
                'Ongoing condition must belong to owner')
        if row['kind'] == 'resonance':
            require(all('requirements' not in effect for effect in behavior['effects']),
                    'Existing effect-level requirement needs explicit review: ' + row['id'])
        effect_updates = row.get('effectRequirements', {})
        require(not effect_updates or row['id'] == 'essence.aetherist.aether-nova' and
                set(effect_updates) == {'stored-aether'} and
                effect_updates['stored-aether'] == {'kind': 'resource-state', 'subject': 'owner', 'resource': 'mp', 'comparison': 'more-than', 'basisPoints': 7500},
                'Unauthorized effect eligibility change: ' + row['id'])
        require(all(is_simple_requirement(effect_updates.get(effect['id'], effect.get('requirements')), registered) for effect in behavior['effects']),
                'Simple profile contains a complex effect gate: ' + row['id'])
        original_target = behavior.get('automaticTarget')
        proposed_target = row.get('automaticTarget')
        if proposed_target != original_target:
            require(trigger is None and behavior['activation'] == 'automatic' and behavior['mode'] == 'action' and
                    proposed_target == {'subject': 'owner'} and behavior['targeting']['shape']['kind'] == 'single' and
                    set(behavior['targeting']['categories']) == {'self'},
                    'Only Self state-entry target rebinding is authorized: ' + row['id'])
        require(isinstance(row['rationale'], str) and bool(row['rationale'].strip()), 'Missing per-record review')
        require(isinstance(row['description'], str) and 1 <= len(row['description']) <= 500,
                'Missing or excessive simple description')


def bind_inventory(inventory, current):
    require(isinstance(inventory, dict) and bool(re.fullmatch('[a-f0-9]{32}', inventory.get('token', ''))),
            'Invalid inventory CAS token')
    require(all(inventory.get(key) == value for key, value in
                {'history': 787, 'current': 294, 'drafts': 0, 'policy': POLICY}.items()),
            'Inventory history/current/drafts/policy mismatch')
    expected = {row['id']: {'content_key': row['id'],
                           'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'],
                           'content_version': row['after']['contentVersion'], 'definition': row['after']}
                for row in current.values()}
    rows = inventory.get('publications', [])
    actual = {row.get('content_key'): {key: row.get(key) for key in
              ('content_key', 'content_kind', 'content_version', 'definition')} for row in rows}
    require(len(rows) == len(actual) == 294 and actual == expected,
            'Fresh inventory exact definitions differ from effective baseline')
    return {'inventoryBound': True, 'expectedCatalogueToken': inventory['token'],
            'inventorySha256': digest(inventory)}


def candidate(inventory=None, design=None):
    current = effective_baseline()
    design = deepcopy(design) if design is not None else json.loads(DESIGNS.read_text())
    validate_design(design, current)
    records, review = [], []
    for proposed in design['records']:
        original = current[proposed['id']]
        before = original['after']
        after = deepcopy(before)
        behavior = after['ability']['behaviors'][0]
        behavior['requirementMode'] = 'simple'
        behavior['requirements'] = deepcopy(proposed['requirements'])
        for key in ('automaticTrigger', 'automaticTarget'):
            if key in proposed:
                behavior[key] = deepcopy(proposed[key])
            else:
                behavior.pop(key, None)
        if original['kind'] == 'resonance':
            after['description'] = proposed['description']
        for effect in behavior['effects']:
            if effect['id'] in proposed.get('effectRequirements', {}):
                effect['requirements'] = deepcopy(proposed['effectRequirements'][effect['id']])
        after['contentVersion'] += 1
        if 'authoring' in after:
            after['authoring']['validationTags'].append(VALIDATION_TAG)
        if original['kind'] == 'essence':
            after['skill']['contentVersion'] = after['contentVersion']
            after['skill']['authoring']['validationTags'].append(VALIDATION_TAG)
        records.append({'kind': original['kind'], 'id': proposed['id'],
                        'beforeVersion': before['contentVersion'], 'beforeDigest': digest(before), 'after': after})
        review.append({'id': proposed['id'], 'name': proposed['name'], 'decision': 'revised',
                       'rationale': proposed['rationale']})
    baseline_rows = [{'kind': row['kind'], 'id': row['id'], 'after': row['after']} for row in current.values()]
    binding = {'inventoryBound': False, 'expectedCatalogueToken': None, 'inventorySha256': None,
               'expectedCurrentCount': 294, 'expectedHistoryCount': 787, 'expectedDraftCount': 0,
               'expectedGlobalTimingPolicy': POLICY, 'effectiveBaselineSha256': digest(baseline_rows),
               'releaseRequirements': [
                   'verify compatible application READY and exact deployed source SHA before publication',
                   'refresh and bind exact 294-definition inventory, 787 history rows, zero drafts and policy 8',
                   'authorized transactional CAS append of 166 definitions, retaining all prior versions',
                   'read back all 294 current definitions, 953 immutable history rows and 128 unchanged definitions'],
               'historicalCaptureRule': 'Captured old definitions keep their authored compound requirements; captured simple definitions require the compatible reader and executor even after pointer rollback.'}
    if inventory is not None:
        binding.update(bind_inventory(inventory, current))
    return {'schemaVersion': 1, 'status': 'candidate-not-published-pending-full-acceptance',
            'baseCommit': design['baseCommit'], 'reviewedRecordCount': 294, 'reviewedResonanceCount': 136,
            'requiredRecordCount': 166, 'baselineManifests': deepcopy(BASELINE_MANIFESTS),
            'designManifestSha256': file_digest(DESIGNS), 'globalTimingPolicyVersion': 8,
            'unreviewedDefinitionsUnchanged': True,
            'changes': {'appendedByKind': {'basic': 2, 'skill': 24, 'essence': 4, 'resonance': 136},
                        'unchangedCurrentCount': 128, 'historyBefore': 787, 'historyAfter': 953,
                        'singleRequirementProfiles': 166, 'resonanceEffectLevelRequirementCount': 0, 'changedEffectLevelRequirements': 1,
                        'preservedResonanceBarrierPayloads': 36, 'barrierDurationTurns': 2},
            'publicationBinding': binding, 'review': review, 'records': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        result = candidate(json.loads(args.inventory.read_text()) if args.inventory else None)
        rendered = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
        if args.check:
            require(args.output.read_text() == rendered, 'Frozen output differs from deterministic preparation')
        else:
            args.output.write_text(rendered)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps({'records': len(result['records']), 'changes': result['changes'],
                      'sha256': file_digest(args.output)}))


if __name__ == '__main__':
    main()
