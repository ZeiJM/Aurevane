"""Offline candidate scope, reproducibility, and immutable-source checks."""
import importlib.util
import json
import unittest
from copy import deepcopy
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('field_remedy', Path(__file__).with_name('prepare-field-remedy-recovery.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FieldRemedyPreparation(unittest.TestCase):
    def test_frozen_candidate_is_reproducible_and_narrow(self):
        self.assertEqual(json.loads(module.OUTPUT.read_text()), module.candidate())
        data = module.candidate()
        self.assertEqual(data['inventoryCount'], 294)
        self.assertEqual(data['unchangedCurrentCount'], 292)
        self.assertEqual(len(data['records']), 2)
        row = data['records'][0]
        self.assertEqual(row['beforeDigest'], module.digest(row['before']))
        self.assertEqual(row['afterDigest'], module.digest(row['after']))
        restored = deepcopy(row['after'])
        restored['contentVersion'] = row['before']['contentVersion']
        restored['flavorLine'] = row['before']['flavorLine']
        restored['ability']['behaviors'][0]['effects'][1]['requirements'] = deepcopy(
            row['before']['ability']['behaviors'][0]['effects'][1]['requirements'])
        self.assertEqual(restored, row['before'])

    def test_dawns_oath_is_the_only_similar_recovery_gate_and_matches_live(self):
        data = module.candidate()
        row = next(row for row in data['records'] if row['id'] == 'essence.dawnshield.dawns-oath')
        live = json.loads(module.LIVE_AUDIT.read_text())
        self.assertEqual(live['currentCount'], 298)
        self.assertEqual(len(live['effectRequirementAudit']), 15)
        self.assertEqual(len(live['recoveryAudit']), 107)
        self.assertEqual(row['before'], next(x['definition'] for x in live['targets']
                                            if x['content_key'] == row['id']))
        restored = deepcopy(row['after'])
        restored['contentVersion'] = 7
        restored['skill']['contentVersion'] = 7
        restored['flavorLine'] = row['before']['flavorLine']
        restored['ability']['behaviors'][0]['effects'][1]['requirements'] = deepcopy(
            row['before']['ability']['behaviors'][0]['effects'][1]['requirements'])
        self.assertEqual(restored, row['before'])
        self.assertEqual(row['after']['skill']['contentVersion'], 8)
        self.assertEqual(row['after']['ability']['behaviors'][0]['effects'][1]['payload']['percentageBasisPoints'], 1400)

    def test_changed_baseline_is_not_silently_transformed(self):
        current = module.effective_catalogue()
        current['wildwarden.field-remedy']['after']['ability']['behaviors'][0]['effects'][1]['requirements'] = None
        with patch.object(module, 'effective_catalogue', return_value=current):
            with self.assertRaisesRegex(ValueError, 'eligibility changed'):
                module.candidate()

    def test_full_published_source_audit_preserves_other_gates(self):
        data = module.candidate()
        audit = data['effectRequirementAudit']
        self.assertEqual(len(audit), 15)
        self.assertEqual(sum(item['kind'] == 'skill' for item in audit), 12)
        self.assertEqual(sum(item['kind'] == 'essence' for item in audit), 3)
        self.assertFalse(any(item['kind'] == 'resonance' for item in audit))
        self.assertEqual([item['id'] for item in audit if item['decision'] == 'remove-recovery-gate'],
                         ['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'])


if __name__ == '__main__':
    unittest.main()
