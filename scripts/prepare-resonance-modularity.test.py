"""Focused local guards for the append-only modular correction preparation."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/prepare-resonance-modularity.py'


def load_generator():
    spec = importlib.util.spec_from_file_location('modularity_generator', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ModularCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Modular correction generator is not implemented')
        self.module = load_generator()
        self.current = self.module.effective_baseline()
        self.design = json.loads(self.module.DESIGNS.read_text())
        self.cohort = self.module.candidate()

    def test_every_resonance_has_real_low_complexity_conditions(self):
        rows = self.design['records']
        self.assertEqual(len(rows), 136)
        self.assertEqual(len({row['id'] for row in rows}), 136)
        for row in rows:
            with self.subTest(id=row['id']):
                gates = self.module.state_condition_blocks(row['requirementNodes'])
                self.assertLessEqual(len(gates), 2)
                for leaf in self.module.requirement_leaves(row['requirementNodes']):
                    if leaf['kind'] == 'prime-presence':
                        self.assertNotIn('abilityId', leaf)
        self.assertEqual(self.cohort['changes']['stateGateReductionRecords'], 24)
        self.assertEqual(self.cohort['changes']['genericPrimedRecords'], 11)

    def test_all_barrier_payloads_have_explicit_two_turn_duration(self):
        effective = deepcopy(self.current)
        effective.update({row['id']: row for row in self.cohort['records']})
        definitions = []
        count = 0
        for row in effective.values():
            payloads = self.module.barrier_payloads(row['after'])
            if payloads:
                definitions.append(row)
                count += len(payloads)
                self.assertTrue(all(payload['durationTurns'] == 2 for payload in payloads))
        self.assertEqual(len(definitions), 45)
        self.assertEqual(count, 46)
        self.assertEqual({kind: sum(row['kind'] == kind for row in definitions)
                          for kind in ('skill', 'essence', 'resonance')},
                         {'skill': 9, 'essence': 1, 'resonance': 35})

    def test_only_changed_rows_append_and_prior_identity_is_exact(self):
        rows = self.cohort['records']
        self.assertEqual(len(rows), len({row['id'] for row in rows}))
        self.assertEqual(self.cohort, self.module.candidate())
        for row in rows:
            before = self.current[row['id']]['after']
            self.assertEqual(row['beforeVersion'], before['contentVersion'])
            self.assertEqual(row['beforeDigest'], self.module.digest(before))
            self.assertEqual(row['after']['contentVersion'], before['contentVersion'] + 1)
            expected = deepcopy(before)
            expected['ability'] = deepcopy(row['after']['ability'])
            expected['contentVersion'] += 1
            expected['authoring']['validationTags'].append(self.module.VALIDATION_TAG)
            if row['kind'] == 'essence':
                expected['skill']['contentVersion'] = expected['contentVersion']
                expected['skill']['authoring']['validationTags'].append(self.module.VALIDATION_TAG)
            self.assertEqual(row['after'], expected)
            if row['kind'] == 'skill':
                self.assertTrue(self.module.barrier_payloads(before))
            self.assertNotEqual(row['kind'], 'basic')
        self.assertEqual(self.cohort['publicationBinding']['expectedDraftCount'], 0)
        self.assertFalse(self.cohort['publicationBinding']['inventoryBound'])

    def test_restorative_current_requires_real_mp_gain(self):
        row = next(row for row in self.design['records'] if row['name'] == 'Restorative Current')
        witnesses = [leaf for leaf in self.module.requirement_leaves(row['requirementNodes'])
                     if leaf['kind'] == 'resource-change']
        self.assertEqual(witnesses, [{'kind': 'resource-change', 'subject': 'affected',
                                     'resource': 'mp', 'direction': 'gained', 'minimumAmount': 1}])
        self.assertEqual(self.cohort['changes']['positiveMpGainWitnessRecords'], 1)

    def test_inventory_binding_rejects_stale_definition_and_nonzero_drafts(self):
        policy = deepcopy(self.module.POLICY)
        inventory = {'token': '1' * 32, 'current': 294, 'history': 719,
                     'drafts': 0, 'policy': policy,
                     'publications': [{'content_key': row['id'],
                                       'content_kind': 'skill' if row['kind'] == 'basic' else row['kind'],
                                       'content_version': row['after']['contentVersion'],
                                       'definition': deepcopy(row['after'])}
                                      for row in self.current.values()]}
        bound = self.module.candidate(inventory=inventory)
        self.assertTrue(bound['publicationBinding']['inventoryBound'])
        self.assertEqual(bound['publicationBinding']['expectedCatalogueToken'], '1' * 32)
        for mutation in ('drafts', 'definition'):
            wrong = deepcopy(inventory)
            if mutation == 'drafts':
                wrong['drafts'] = 1
            else:
                wrong['publications'][0]['definition']['contentVersion'] += 1
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.module.candidate(inventory=wrong)


if __name__ == '__main__':
    unittest.main()
