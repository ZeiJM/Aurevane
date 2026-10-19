"""Local-only regression guards for the complete simple Resonance requirement cohort."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/prepare-simple-requirements.py'


class SimpleResonancePreparationTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Simple Resonance preparation is not implemented')
        spec = importlib.util.spec_from_file_location('simple_resonance_preparation', SCRIPT)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.current = self.module.effective_baseline()
        self.design = json.loads(self.module.DESIGNS.read_text())
        self.cohort = self.module.candidate()

    def test_frozen_overlay_is_exact_294_and_every_resonance_is_reviewed(self):
        self.assertEqual(len(self.current), 294)
        self.assertEqual(len(self.design['records']), 166)
        self.assertEqual(len({row['id'] for row in self.design['records']}), 166)
        self.assertEqual({row['id'] for row in self.design['records'] if row['kind'] == 'resonance'},
                         {key for key, row in self.current.items() if row['kind'] == 'resonance'})
        self.assertEqual(self.cohort['baselineManifests'], self.module.BASELINE_MANIFESTS)
        for manifest in self.module.BASELINE_MANIFESTS:
            self.assertEqual(self.module.file_digest(ROOT / manifest['path']), manifest['sha256'])

    def test_all_166_append_one_actual_simple_requirement_and_no_resonance_effect_gates(self):
        self.assertEqual(len(self.cohort['records']), 166)
        for row in self.cohort['records']:
            behavior = row['after']['ability']['behaviors'][0]
            self.assertEqual(behavior['requirementMode'], 'simple')
            self.assertTrue(self.module.is_simple_requirement(behavior['requirements']))
            if row['kind'] == 'resonance':
                for effect in behavior['effects']:
                    self.assertNotIn('requirements', effect)
            if behavior.get('automaticTrigger'):
                self.assertIn(behavior['automaticTrigger'], self.module.HOOK_TARGET_SUBJECTS)
            elif behavior['requirements'] is not None and behavior['activation'] == 'automatic' and behavior['mode'] == 'action':
                self.assertEqual(behavior['requirements']['subject'], 'owner')

    def test_only_authorized_fields_change_and_128_other_definitions_are_identical(self):
        for row in self.cohort['records']:
            before = self.current[row['id']]['after']
            self.assertEqual(row['beforeVersion'], before['contentVersion'])
            self.assertEqual(row['beforeDigest'], self.module.digest(before))
            expected = deepcopy(before)
            expected['contentVersion'] += 1
            if row['kind'] == 'resonance':
                expected['description'] = row['after']['description']
            if 'authoring' in expected:
                expected['authoring']['validationTags'].append(self.module.VALIDATION_TAG)
            old = expected['ability']['behaviors'][0]
            new = row['after']['ability']['behaviors'][0]
            for key in ('requirements', 'requirementMode', 'automaticTrigger', 'automaticTarget'):
                if key in new:
                    old[key] = deepcopy(new[key])
                else:
                    old.pop(key, None)
            if row['kind'] == 'essence':
                expected['skill']['contentVersion'] = expected['contentVersion']
                expected['skill']['authoring']['validationTags'].append(self.module.VALIDATION_TAG)
            if row['id'] == 'essence.aetherist.aether-nova':
                old['effects'][1]['requirements'] = deepcopy(new['effects'][1]['requirements'])
            self.assertEqual(row['after'], expected)
        effective = deepcopy(self.current)
        effective.update({row['id']: row for row in self.cohort['records']})
        changed_ids = {row['id'] for row in self.cohort['records']}
        others = [key for key in self.current if key not in changed_ids]
        self.assertEqual(len(others), 128)
        for key in others:
            self.assertEqual(effective[key], self.current[key])
        self.assertEqual(self.cohort['changes']['historyBefore'], 787)
        self.assertEqual(self.cohort['changes']['historyAfter'], 953)

    def test_barrier_lifetimes_and_every_payload_are_preserved_exactly(self):
        barriers = 0
        for row in self.cohort['records']:
            before = self.current[row['id']]['after']['ability']['behaviors'][0]
            after = row['after']['ability']['behaviors'][0]
            if row['id'] == 'essence.aetherist.aether-nova':
                before = deepcopy(before)
                before['effects'][1]['requirements']['comparison'] = 'more-than'
            self.assertEqual(after['effects'], before['effects'])
            for effect in after['effects']:
                if row['kind'] == 'resonance' and effect['payload']['type'] == 'barrier-change':
                    barriers += 1
                    self.assertEqual(effect['payload']['durationTurns'], 2)
        self.assertEqual(barriers, 36)

    def test_none_prime_emergency_percent_and_screenshot_have_real_simple_semantics(self):
        records = {row['id']: row for row in self.cohort['records']}
        behavior = lambda pair: records[next(key for key in records if key.split('.')[1] == pair)]['after']['ability']['behaviors'][0]
        self.assertEqual(behavior('cinderweaver-tidecaller')['requirements'],
                         {'kind': 'status-presence', 'subject': 'owner', 'statusId': 'burn', 'present': True})
        self.assertNotIn('automaticTrigger', behavior('cinderweaver-tidecaller'))
        self.assertEqual(behavior('cinderweaver-tidecaller')['automaticTarget'], {'subject': 'owner'})
        self.assertIsNone(behavior('bastion-farstrider')['requirements'])
        self.assertEqual(behavior('bastion-farstrider')['automaticTrigger'], 'damage-taken')
        self.assertEqual(behavior('aetherist-chronist')['requirements'],
                         {'kind': 'prime-presence', 'subject': 'owner', 'present': True})
        self.assertEqual(behavior('chronist-ravager')['requirements'],
                         {'kind': 'resource-state', 'subject': 'owner', 'resource': 'hp',
                          'comparison': 'less-than', 'basisPoints': 3000})
        self.assertEqual(behavior('ironfist-lifebinder')['requirements']['basisPoints'], 10000)

    def test_rejected_conjunction_absence_raw_amount_and_causal_target_mismatch_fail(self):
        for requirement in (
            {'kind': 'all', 'children': []},
            {'kind': 'status-presence', 'subject': 'owner', 'statusId': 'burn', 'present': False},
            {'kind': 'resource-state', 'subject': 'owner', 'resource': 'hp', 'comparison': 'less-than', 'amount': 40},
            {'kind': 'resource-state', 'subject': 'owner', 'resource': 'ap', 'comparison': 'less-than', 'basisPoints': 4000},
        ):
            wrong = deepcopy(self.design)
            wrong['records'][0]['requirements'] = requirement
            with self.subTest(requirement=requirement), self.assertRaises(ValueError):
                self.module.candidate(design=wrong)
        wrong = deepcopy(self.design)
        wrong['records'][0]['requirements']['subject'] = 'triggering'
        with self.assertRaisesRegex(ValueError, 'Target role'):
            self.module.candidate(design=wrong)

    def test_deterministic_output_and_stale_inventory_rejection(self):
        self.assertEqual(self.cohort, self.module.candidate())
        self.assertEqual(self.cohort, json.loads(self.module.OUTPUT.read_text()))
        inventory = {'token': '1' * 32, 'history': 787, 'current': 294, 'drafts': 0,
                     'policy': self.module.POLICY,
                     'publications': [{'content_key': row['id'],
                                       'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'],
                                       'content_version': row['after']['contentVersion'],
                                       'definition': deepcopy(row['after'])}
                                      for row in self.current.values()]}
        bound = self.module.candidate(inventory=inventory)
        self.assertTrue(bound['publicationBinding']['inventoryBound'])
        for mutation in ('history', 'drafts', 'definition'):
            wrong = deepcopy(inventory)
            if mutation in ('history', 'drafts'):
                wrong[mutation] += 1
            else:
                wrong['publications'][0]['definition']['name'] = 'stale'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.module.candidate(inventory=wrong)


if __name__ == '__main__':
    unittest.main()
