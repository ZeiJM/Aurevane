"""Exact offline Chilled conversion and fresh-CAS binding contracts."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


candidate = load('prepare-chilled-cleanse')
publication = load('prepare-chilled-cleanse-publication')


class ChilledCleansePreparation(unittest.TestCase):
    def setUp(self):
        self.reviewed = candidate.candidate()
        self.live = json.loads(candidate.LIVE_AUDIT.read_text())['records']

    def test_exact_seven_frozen_only_conversions_preserve_all_other_fields(self):
        self.assertEqual(len(self.reviewed['records']), 7)
        self.assertEqual(candidate.candidate(), self.reviewed)
        for row in self.reviewed['records']:
            with self.subTest(id=row['id']):
                def inspect(before, after, path=()):
                    if isinstance(before, dict):
                        permitted = {}
                        if (before.get('type') == 'remove-status' and before.get('statusIds') == ['frozen']
                                and before.get('recipient') == 'actor' and 'removalMode' not in before):
                            permitted = {'removalMode': 'specified', 'target': 'self'}
                        self.assertEqual(set(after), set(before) | set(permitted))
                        for field, value in permitted.items():
                            self.assertEqual(after[field], value)
                        count = int(bool(permitted))
                        for field in before:
                            if field == 'contentVersion' and path in [(), ('skill',)]:
                                self.assertEqual(after[field], before[field] + 1)
                            elif field not in permitted:
                                count += inspect(before[field], after[field], path + (field,))
                        return count
                    if isinstance(before, list):
                        self.assertEqual(len(before), len(after))
                        return sum(inspect(a, b, path + (index,)) for index, (a, b) in enumerate(zip(before, after)))
                    self.assertEqual(before, after)
                    return 0
                changed = inspect(row['before'], row['after'])
                self.assertGreater(changed, 0)
                self.assertEqual(row['convertedNodes'], changed)
                self.assertEqual(row['after']['contentVersion'], row['beforeVersion'] + 1)
        self.assertEqual(json.loads(candidate.OUTPUT.read_text()), self.reviewed)

    def test_conversion_never_widens_other_removal_modes_or_lists(self):
        nodes = [{'type': 'remove-status', 'recipient': 'actor', 'statusIds': statuses, **mode}
                 for statuses in [[], ['burn'], ['frozen', 'burn'], ['frozen']]
                 for mode in [{}, {'removalMode': 'specified'}, {'removalMode': 'all'}]]
        before = deepcopy(nodes)
        self.assertEqual(candidate.convert(nodes), 1)
        for index, node in enumerate(before):
            if node == {'type': 'remove-status', 'recipient': 'actor', 'statusIds': ['frozen']}:
                node['removalMode'] = 'specified'
                node['target'] = 'self'
            self.assertEqual(nodes[index], node)

    def test_unsafe_recipient_or_target_is_rejected(self):
        for fields in [{'recipient': 'primary-unit'}, {'recipient': 'actor', 'target': 'enemy'}, {'recipient': 'actor', 'target': None}]:
            with self.assertRaisesRegex(ValueError, 'actor/self'):
                candidate.convert({'type': 'remove-status', 'statusIds': ['frozen'], **fields})
        node = {'type': 'remove-status', 'statusIds': ['frozen'], 'recipient': 'actor', 'target': 'self'}
        self.assertEqual(candidate.convert(node), 1)
        self.assertEqual(node['target'], 'self')

    def test_unknown_or_drifted_audit_is_rejected(self):
        changed = deepcopy({'records': self.live})
        changed['records'][0]['definition']['apCost'] += 1
        with patch.object(candidate, 'read_audit', return_value=changed):
            with self.assertRaisesRegex(ValueError, 'reviewed audit'):
                candidate.candidate()

    def test_noop_is_rejected(self):
        with patch.object(candidate, 'convert', return_value=0):
            with self.assertRaisesRegex(ValueError, 'No Chilled'):
                candidate.candidate()

    def test_fresh_binder_requires_full_exact_metadata_and_definition(self):
        sql, receipt = publication.prepare(live_definition=self.live, catalogue_token='a' * 32)
        self.assertEqual(receipt['expectedOutcome'], 'append')
        self.assertEqual(len(receipt['records']), 7)
        self.assertNotRegex(sql, r'__[A-Z_]+__')
        self.assertIn("lock_combat_content_catalogue_v1('" + 'a' * 32 + "')", sql)
        self.assertEqual(sql.count('lock_combat_content_catalogue_v1('), 1)
        for field, value in [('definition', {}), ('revision', 2), ('highest_version', 40),
                             ('has_draft', True), ('restore_pending', True), ('lifecycle', 'archived')]:
            changed = deepcopy(self.live)
            changed[0][field] = value
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    publication.prepare(live_definition=changed, catalogue_token='a' * 32)
        with self.assertRaises(ValueError):
            publication.prepare(live_definition=self.live[:-1], catalogue_token='a' * 32)

    def test_exact_after_retry_and_mixed_state(self):
        published = deepcopy(self.live)
        for live, row in zip(published, self.reviewed['records']):
            live.update(publication.expected_live(row, published=True))
        _, receipt = publication.prepare(live_definition=published, catalogue_token='b' * 32)
        self.assertEqual(receipt['expectedOutcome'], 'already-published-no-op')
        published[-1] = self.live[-1]
        _, receipt = publication.prepare(live_definition=published, catalogue_token='b' * 32)
        self.assertEqual(receipt['expectedOutcome'], 'append')

    def test_token_and_candidate_tampering_fail_closed(self):
        for token in [None, '', 'A' * 32, 'a' * 31, "'; commit; --"]:
            with self.assertRaisesRegex(ValueError, 'CAS token'):
                publication.prepare(live_definition=self.live, catalogue_token=token)
        changed = deepcopy(self.reviewed)
        changed['records'][0]['after']['apCost'] = 0
        with patch.object(publication._candidate, 'candidate', return_value=changed):
            with self.assertRaisesRegex(ValueError, 'Candidate differs'):
                publication.prepare(live_definition=self.live, catalogue_token='a' * 32)


if __name__ == '__main__':
    unittest.main()
