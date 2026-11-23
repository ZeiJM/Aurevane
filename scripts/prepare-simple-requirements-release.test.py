"""Offline release-control binding and narrow-scope regression guards."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/prepare-simple-requirements-release.py'


class ReleaseControlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.exists():
            raise AssertionError('Simple requirement release-control binder is not implemented')
        spec = importlib.util.spec_from_file_location('release_controls', SCRIPT)
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)
        cls.reviewed = cls.module.load_reviewed()

    def inventory(self, mode='publication'):
        expected = self.module.expected_publications(self.reviewed, mode)
        return {'token': 'a' * 32, 'current': 294, 'history': 787 if mode == 'publication' else 953,
                'drafts': 0, 'policy': deepcopy(self.module.POLICY),
                'publications': list(deepcopy(expected).values())}

    def render(self, mode='publication', **overrides):
        kwargs = {'actor': str(uuid.UUID(int=1)), 'inventory': self.inventory(mode),
                  'deployed_sha': 'b' * 40}
        kwargs.update(overrides)
        return self.module.prepare(mode, **kwargs)

    def test_publication_binds_exact294_baseline_and166_append_only_rows(self):
        sql, metadata = self.render()
        self.assertEqual(metadata['records'], 166)
        self.assertEqual(metadata['historyBefore'], 787)
        self.assertEqual(metadata['historyAfter'], 953)
        self.assertEqual(metadata['unchangedCurrent'], 128)
        self.assertEqual(metadata['appendedByKind'], {'basic': 2, 'skill': 24, 'essence': 4, 'resonance': 136})
        self.assertNotRegex(sql, r'__[A-Z_]+__')
        self.assertIn('public.publish_combat_content_v3(', sql)
        self.assertIn("lock_combat_content_catalogue_v1('" + 'a' * 32, sql)
        self.assertIn('history_snapshot', sql)
        self.assertIn('POSTCHECK_CURRENT_MISMATCH', sql)
        self.assertIn("case when row->>'kind'='basic' then 'skill' else row->>'kind' end", sql)
        self.assertIn("where r->>'kind'='basic') <> 2", sql)
        self.assertNotRegex(sql.lower(), r'\b(delete|truncate)\s')

    def test_rollback_requires_exact_new_catalogue_and_preserves953_versions(self):
        sql, metadata = self.render('rollback')
        self.assertEqual((metadata['historyBefore'], metadata['historyAfter']), (953, 953))
        self.assertIn('set_combat_content_publication_v2', sql)
        self.assertNotIn('publish_combat_content_v3', sql)
        self.assertIn('HISTORY_RETENTION_MISMATCH', sql)
        with self.assertRaises(ValueError):
            self.render('rollback', inventory=self.inventory('publication'))

    def test_stale_inventory_drafts_policy_duplicates_and_missing_rows_are_rejected(self):
        for mutation in ['definition', 'version', 'drafts', 'policy', 'duplicate', 'missing', 'token']:
            inventory = self.inventory()
            if mutation == 'definition':
                inventory['publications'][0]['definition']['enabled'] = False
            elif mutation == 'version':
                inventory['publications'][0]['content_version'] += 1
            elif mutation == 'drafts':
                inventory['drafts'] = 1
            elif mutation == 'policy':
                inventory['policy']['version'] = 9
            elif mutation == 'duplicate':
                inventory['publications'][-1] = deepcopy(inventory['publications'][0])
            elif mutation == 'missing':
                inventory['publications'].pop()
            else:
                inventory['token'] = 'unsafe-token'
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                self.render(inventory=inventory)

    def test_owner_and_exact_compatible_source_binding_are_mandatory_for_writes(self):
        for kwargs in [{'actor': None}, {'actor': 'not-owner-uuid'}, {'deployed_sha': None},
                       {'deployed_sha': 'b' * 39}, {'inventory': None}]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.render(**kwargs)

    def test_readback_is_read_only_small_metadata_and_supports_rollback_expectations(self):
        for state in ['published', 'rolled-back']:
            sql, metadata = self.module.prepare('readback', state=state)
            self.assertEqual(metadata['state'], state)
            self.assertNotRegex(sql.lower(), r'\b(insert|update|delete|truncate|publish_combat_content_v3)\b')
            for field in ['current_mismatch_count', 'old_history_mismatch_count',
                          'new_history_mismatch_count', 'expected_current_hash',
                          'actual_current_hash', 'history_hash', 'candidateSha256']:
                self.assertIn(field, sql)
            self.assertNotRegex(sql, r'__[A-Z_]+__')

    def test_templates_and_candidate_are_sha_pinned_and_preparation_is_deterministic(self):
        control = self.reviewed['control']
        self.assertEqual(control['candidateSha256'], self.module.sha(self.module.CANDIDATE))
        self.assertEqual(control['designSha256'], self.module.sha(self.module.DESIGNS))
        for mode in ['publication', 'rollback', 'readback']:
            self.assertEqual(control['templates'][mode], self.module.sha(self.module.ASSETS / f'{self.module.PREFIX}-{mode}.sql'))
        self.assertEqual(self.render(), self.render())


if __name__ == '__main__':
    unittest.main()
