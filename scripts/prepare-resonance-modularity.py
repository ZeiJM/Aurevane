"""Prepare the append-only modular/temporary-Barrier cohort locally.

Never connects to a database, creates a draft, writes SQL or publishes content.
An optional fresh inventory binds the exact baseline CAS metadata only; deploying
and publishing require the Owner's separate authorized release workflow.
"""
from copy import deepcopy
from hashlib import sha256
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'docs/superpowers/specs/2026-10-18-modular-correction-cohort.json'
IDENTITY = ROOT / 'docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json'
DESIGNS = ROOT / 'docs/superpowers/specs/2026-10-19-resonance-modularity-designs.json'
OUTPUT = ROOT / 'docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json'
VALIDATION_TAG = 'owner-resonance-modularity-20261019'
POLICY = {'version': 8, 'tagAuthority': 'global', 'modes': {
    'summon': 'instant', 'displace': 'instant', 'mp-drain': 'instant',
    'remove-status': 'instant', 'return-to-turn-start': 'controlled',
    'barrier-change': 'instant', 'blindside': 'instant'}}
TRIGGER_KINDS = frozenset(('event', 'action', 'subject-relation',
                           'resource-threshold-crossing', 'resource-change'))
MP_GAIN = {'kind': 'resource-change', 'subject': 'affected', 'resource': 'mp',
           'direction': 'gained', 'minimumAmount': 1}


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
    """October19 is a narrow overlay, never a complete294-row replacement."""
    baseline = json.loads(BASE.read_text())
    identity = json.loads(IDENTITY.read_text())
    require(identity['previousManifestSha256'] == file_digest(BASE), 'Baseline manifest SHA mismatch')
    current = {row['id']: deepcopy(row) for row in baseline['records']}
    require(len(current) == len(baseline['records']) == 294, 'Expected294 distinct baseline rows')
    require(len(identity['records']) == 136, 'Expected136 October19 overlay rows')
    for row in identity['records']:
        before = current[row['id']]['after']
        require(row['kind'] == current[row['id']]['kind'] and
                row['beforeVersion'] == before['contentVersion'] and
                row['beforeDigest'] == digest(before) and
                row['after']['contentVersion'] == row['beforeVersion'] + 1,
                'Invalid prior identity overlay: ' + row['id'])
        current[row['id']] = deepcopy(row)
    return current


def requirement_leaves(node):
    if node is None:
        return []
    if node['kind'] in ('all', 'any'):
        return [leaf for child in node['children'] for leaf in requirement_leaves(child)]
    return [node]


def condition_blocks(node):
    if node is None:
        return []
    if node['kind'] == 'all':
        return [block for child in node['children'] for block in condition_blocks(child)]
    return [node]


def state_condition_blocks(node):
    return [block for block in condition_blocks(node) if block['kind'] not in TRIGGER_KINDS]


def barrier_payloads(definition):
    return [effect['payload'] for behavior in definition.get('ability', {}).get('behaviors', [])
            for effect in behavior['effects'] if effect['payload']['type'] == 'barrier-change']


def validate_design(design, current):
    rows = design['records']
    resonances = {key: row for key, row in current.items() if row['kind'] == 'resonance'}
    require(len(rows) == len({row['id'] for row in rows}) == 136 and
            {row['id'] for row in rows} == set(resonances), 'Design must review all136 Resonances')
    require(design['sharedPolicy']['barrierDurationTurns'] == 2, 'Barrier duration must be explicitly2')
    for source in design['baselineManifests']:
        require(file_digest(ROOT / source['path']) == source['sha256'], 'Frozen manifest SHA mismatch')
    require({source['path'] for source in design['baselineManifests']} ==
            {str(BASE.relative_to(ROOT)), str(IDENTITY.relative_to(ROOT))}, 'Missing baseline binding')
    reductions = primes = gains = 0
    for row in rows:
        before = resonances[row['id']]['after']
        require(row['beforeVersion'] == before['contentVersion'] and
                row['name'] == before['name'] and row['pair'] == before['disciplinePair'],
                'Design identity differs: ' + row['id'])
        behaviors = before['ability']['behaviors']
        require(len(behaviors) == 1, 'Unexpected multiple behavior source: ' + row['id'])
        expected = deepcopy(behaviors[0]['requirements'])
        removed = row['removedConditions']
        if removed:
            require(expected['kind'] == 'all' and len(removed) == 1 and
                    all(block in state_condition_blocks(expected) for block in removed),
                    'Only one actual redundant state block may be removed: ' + row['id'])
            expected['children'] = [child for child in expected['children'] if child not in removed]
            reductions += 1
        prime_leaves = [leaf for leaf in requirement_leaves(expected)
                        if leaf['kind'] == 'prime-presence']
        require(row['genericPrimed'] == bool(prime_leaves), 'Prime migration flag mismatch')
        for leaf in prime_leaves:
            require(leaf.get('abilityId') == 'chronist.rewind-step', 'Unexpected prior prime identity')
            del leaf['abilityId']
        primes += bool(prime_leaves)
        if row['positiveMpGainWitness']:
            require(row['id'] == 'resonance.lifebinder-stormsinger.linked-sequence',
                    'Unexpected positive MP witness scope')
            expected['children'].append(deepcopy(MP_GAIN))
            gains += 1
        require(row['requirementNodes'] == expected, 'Design changes unauthorized requirements: ' + row['id'])
        require(len(state_condition_blocks(expected)) <= 2, 'More than two state conditions: ' + row['id'])
        changed = expected != behaviors[0]['requirements']
        require(row['keepOrRevise'] == ('revise' if changed else 'keep'), 'Incorrect keep/revise decision')
    require((reductions, primes, gains) == (24, 11, 1), 'Unexpected modular revision scope')


def bind_inventory(inventory, current):
    require(bool(re.fullmatch('[a-f0-9]{32}', inventory.get('token', ''))), 'Invalid inventory CAS token')
    require(all(inventory.get(key) == value for key, value in
                {'history': 719, 'current': 294, 'drafts': 0, 'policy': POLICY}.items()),
            'Inventory history/current/drafts/policy mismatch')
    rows = inventory.get('publications', [])
    expected = {row['id']: {'content_key': row['id'],
                           'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'],
                           'content_version': row['after']['contentVersion'],
                           'definition': row['after']} for row in current.values()}
    actual = {row.get('content_key'): {key: row.get(key) for key in
              ('content_key', 'content_kind', 'content_version', 'definition')} for row in rows}
    require(len(rows) == len(actual) == 294 and actual == expected,
            'Fresh inventory exact definitions differ from effective294 baseline')
    return {'inventoryBound': True, 'expectedCatalogueToken': inventory['token'],
            'inventorySha256': digest(inventory)}


def candidate(inventory=None):
    current = effective_baseline()
    design = json.loads(DESIGNS.read_text())
    validate_design(design, current)
    designs = {row['id']: row for row in design['records']}
    records, review = [], []
    barrier_definitions = barrier_count = 0
    changed_kinds = {'skill': 0, 'essence': 0, 'resonance': 0}
    for key, original in current.items():
        before = original['after']
        after = deepcopy(before)
        reasons = []
        if key in designs:
            proposed = deepcopy(designs[key]['requirementNodes'])
            if proposed != after['ability']['behaviors'][0]['requirements']:
                after['ability']['behaviors'][0]['requirements'] = proposed
                reasons.append('modular-requirements')
        payloads = barrier_payloads(after)
        if payloads:
            require(all('durationTurns' not in payload for payload in payloads),
                    'Unexpected already-duration-authored Barrier: ' + key)
            for payload in payloads:
                payload['durationTurns'] = 2
            barrier_definitions += 1
            barrier_count += len(payloads)
            reasons.append('explicit-barrier-duration')
        changed = after != before
        review.append({'kind': original['kind'], 'id': key,
                       'decision': 'revised' if changed else 'retained', 'reasons': reasons})
        if not changed:
            continue
        require(original['kind'] in changed_kinds, 'Basics must not change')
        require(original['kind'] != 'skill' or bool(payloads), 'Non-Barrier ordinary Skill changed')
        after['contentVersion'] += 1
        after['authoring']['validationTags'].append(VALIDATION_TAG)
        if original['kind'] == 'essence':
            after['skill']['contentVersion'] = after['contentVersion']
            after['skill']['authoring']['validationTags'].append(VALIDATION_TAG)
        changed_kinds[original['kind']] += 1
        records.append({'kind': original['kind'], 'id': key,
                        'beforeVersion': before['contentVersion'], 'beforeDigest': digest(before),
                        'after': after})
    require((barrier_definitions, barrier_count) == (45, 46), 'Unexpected Barrier correction scope')
    binding = {'inventoryBound': False, 'expectedCatalogueToken': None, 'inventorySha256': None,
               'expectedCurrentCount': 294, 'expectedHistoryCount': 719,
               'expectedDraftCount': 0, 'expectedGlobalTimingPolicy': POLICY,
               'effectiveBaselineSha256': digest([{'kind': row['kind'], 'id': row['id'],
                                                  'after': row['after']}
                                                 for row in current.values()]),
               'releaseRequirements': ['verify compatible application READY and exact deployed source SHA',
                                       'refresh and bind exact294-definition inventory, drafts0 and policy8',
                                       'Owner-authorized transactional CAS append using beforeVersion/beforeDigest',
                                       'read back new current pointers and retained immutable history'],
               'historicalCaptureRule': 'Old captures retain their authored definitions. Omitted Barrier duration remains until spent; explicit new duration needs a compatible historical reader.'}
    if inventory is not None:
        binding.update(bind_inventory(inventory, current))
    return {'schemaVersion': 1, 'status': 'candidate-not-published-pending-full-acceptance',
            'baseCommit': design['baseCommit'], 'reviewedRecordCount': 294,
            'reviewedResonanceCount': 136, 'requiredRecordCount': len(records),
            'baselineManifests': [{'path': str(path.relative_to(ROOT)), 'sha256': file_digest(path)}
                                  for path in (BASE, IDENTITY)],
            'designManifestSha256': file_digest(DESIGNS), 'globalTimingPolicyVersion': 8,
            'basicsAndNonBarrierOrdinarySkillsUnchanged': True,
            'changes': {'stateGateReductionRecords': 24, 'genericPrimedRecords': 11,
                        'positiveMpGainWitnessRecords': 1, 'barrierDefinitions': barrier_definitions,
                        'barrierPayloads': barrier_count, 'barrierDurationTurns': 2,
                        'appendedByKind': changed_kinds, 'unchangedCurrentCount': 294 - len(records),
                        'historyBefore': 719, 'historyAfter': 719 + len(records)},
            'publicationBinding': binding, 'review': review, 'records': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', type=Path, help='Optional fresh exact baseline inventory binding')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    parser.add_argument('--check', action='store_true', help='Verify existing output is deterministic')
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text()) if args.inventory else None
    try:
        result = candidate(inventory)
    except ValueError as error:
        parser.error(str(error))
    serialized = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if args.check:
        require(args.output.read_text() == serialized, 'Prepared cohort differs; regenerate before review')
    else:
        args.output.write_text(serialized)
    print(json.dumps({'records': result['requiredRecordCount'], 'changes': result['changes'],
                      'output': str(args.output), 'sha256': sha256(serialized.encode()).hexdigest(),
                      'inventoryBound': result['publicationBinding']['inventoryBound']}))


if __name__ == '__main__':
    main()
