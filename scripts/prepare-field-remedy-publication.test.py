"""Offline binding, conflict/retry and publication guard regression checks."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('field_remedy_publication', Path(__file__).with_name('prepare-field-remedy-publication.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FieldRemedyPublication(unittest.TestCase):
    def setUp(self):
        self.candidate = module._candidate.candidate()
        self.row = self.candidate['records'][0]
        self.live = [{'content_key': row['id'], 'content_version': 7, 'definition': deepcopy(row['before'])} for row in self.candidate['records']]

    def test_binds_exact_live_before_and_current_character_signature(self):
        sql, receipt = module.prepare(live_definition=self.live, catalogue_token='a' * 32)
        self.assertEqual(receipt['expectedOutcome'], 'append-v8')
        self.assertNotRegex(sql, r'__[A-Z_]+__')
        self.assertIn("lock_combat_content_catalogue_v1('" + 'a' * 32 + "')", sql)
        self.assertIn("public.publish_saved_combat_content_v1(actor,actor_character,'wildwarden.field-remedy'", sql)
        self.assertIn("public.write_combat_content_record_v1(actor,actor_character,'wildwarden.field-remedy'", sql)
        self.assertNotIn("publish_combat_content_with_floor_v1(", sql)
        self.assertLess(sql.index('assert_game_owner_v1(actor)'), sql.index('FIELD_REMEDY_ALREADY_PUBLISHED'))
        self.assertIn('current_row.content_version=7 and highest_version=7 and current_row.definition=expected_before', sql)
        self.assertIn('current_row.content_version=8 and highest_version=8 and current_row.definition=expected_after', sql)
        self.assertIn('FIELD_REMEDY_BASELINE_CHANGED', sql)
        before = sql.split('$field_remedy_before$')[1]
        after = sql.split('$field_remedy_after$')[1]
        self.assertEqual(json.loads(before), self.row['before'])
        self.assertEqual(json.loads(after), self.row['after'])

    def test_binds_both_reviewed_records_atomically_and_rejects_missing_oath(self):
        sql, receipt = module.prepare(live_definition=self.live, catalogue_token='a' * 32)
        self.assertEqual([row['id'] for row in receipt['records']],
                         ['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'])
        self.assertEqual(sql.count('begin;'), 1)
        self.assertEqual(sql.count('commit;'), 1)
        self.assertIn('DAWNS_OATH_HAS_UNCOMMITTED_DRAFT', sql)
        self.assertIn("public.publish_saved_combat_content_v1(actor,actor_character,'essence.dawnshield.dawns-oath'", sql)
        self.assertEqual(sql.count('lock_combat_content_catalogue_v1('), 1)
        with self.assertRaisesRegex(ValueError, 'both reviewed'):
            module.prepare(live_definition=self.live[:1], catalogue_token='a' * 32)

    def test_recognizes_exact_published_retry_without_rewriting_candidate(self):
        published = [{'content_key': row['id'], 'content_version': 8, 'definition': deepcopy(row['after'])} for row in self.candidate['records']]
        sql, receipt = module.prepare(live_definition=published, catalogue_token='b' * 32)
        self.assertEqual(receipt['expectedOutcome'], 'already-published-no-op')
        replay_branch = sql.split("raise notice 'FIELD_REMEDY_ALREADY_PUBLISHED';")[0].split('if current_row.content_version=8')[1]
        self.assertNotIn('publish_saved_combat_content_v1(', replay_branch)
        self.assertEqual(published[0]['definition'], self.row['after'])

    def test_rejects_changed_owner_definition_and_incorrect_version(self):
        changed = deepcopy(self.live)
        changed[0]['definition']['flavorLine'] = 'Owner changed this.'
        for live in [changed, [{**self.live[0], 'content_version': 8}, self.live[1]], {}, None]:
            with self.subTest(live=live):
                with self.assertRaises(ValueError):
                    module.prepare(live_definition=live, catalogue_token='a' * 32)

    def test_rejects_unbound_stale_shape_or_injectable_token(self):
        for token in [None, '', '__EXPECTED_CATALOGUE_TOKEN__', 'a' * 31, "'; commit; --"]:
            with self.subTest(token=token):
                with self.assertRaisesRegex(ValueError, 'CAS token'):
                    module.prepare(live_definition=self.live, catalogue_token=token)

    def test_rejects_candidate_drift_before_sql_generation(self):
        changed = deepcopy(self.candidate)
        changed['records'][0]['after']['apCost'] = 0
        with patch.object(module._candidate, 'candidate', return_value=changed):
            with self.assertRaisesRegex(ValueError, 'differs'):
                module.prepare(live_definition=self.live, catalogue_token='a' * 32)

    def test_template_preserves_full_history_unrelated_records_drafts_and_policy(self):
        sql = module.TEMPLATE.read_text()
        for guard in ['history_count+1', 'v.id<>result_row.id', 'is distinct from old_history',
                      'is distinct from other_publications', 'is distinct from old_drafts',
                      'is distinct from old_records', 'is distinct from old_policy_history',
                      'is distinct from old_policy', 'FIELD_REMEDY_HAS_UNCOMMITTED_DRAFT',
                      'FIELD_REMEDY_RECORD_STATE_CHANGED', 'FIELD_REMEDY_READBACK_MISMATCH']:
            self.assertIn(guard, sql)
        self.assertIn('in share row exclusive mode', sql)
        self.assertIn('actor,actor_character', sql)
        self.assertNotIn("lock_combat_content_catalogue_v1(public.read_", sql)


if __name__ == '__main__':
    unittest.main()
