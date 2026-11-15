"""Offline release safety regressions; never connects to a hosted database."""

from copy import deepcopy
from pathlib import Path
from runpy import run_path
import tempfile
import unittest


release = run_path(str(Path(__file__).with_name("apply-aurevane-world-map-geometry.py")))


class ProductionReleaseTests(unittest.TestCase):
    def local_verifier(self):
        path = Path(__file__).with_name("verify-world-map-release-transaction.py")
        self.assertTrue(path.exists(), "Disposable transaction verifier must exist")
        return run_path(str(path))

    def test_disposable_verifier_refuses_remote_or_wrong_docker_targets(self):
        verifier = self.local_verifier()
        config = {"project_id": "aurevane", "db": {"port": 54322, "major_version": 17}}
        container = {"Name": "/supabase_db_aurevane", "State": {"Running": True},
                     "Config": {"Image": "public.ecr.aws/supabase/postgres:17.6.1.155"}}
        uri = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
        verifier["validate_local_target"](config, uri, container)
        for invalid in (uri.replace("127.0.0.1", "db.example.com"),
                        uri.replace("54322", "6543"), uri + "?host=db.example.com"):
            with self.assertRaises(SystemExit):
                verifier["validate_local_target"](config, invalid, container)
        wrong = deepcopy(container)
        wrong["Name"] = "/supabase_db_production"
        with self.assertRaises(SystemExit):
            verifier["validate_local_target"](config, uri, wrong)

    def test_disposable_baseline_excludes_exactly_four_new_migrations(self):
        verifier = self.local_verifier()
        with tempfile.TemporaryDirectory() as directory:
            verifier["stage_baseline"](Path.cwd(), Path(directory), release)
            staged = sorted(p.name for p in (Path(directory) / "supabase/migrations").glob("*.sql"))
            source = sorted(p.name for p in Path("supabase/migrations").glob("*.sql"))
            self.assertEqual([name for name in source if name not in staged], list(release["MIGRATIONS"]))
            self.assertEqual(staged[-1], "20261112183130_town_and_continent_teleport_geometry.sql")

    def test_forced_failure_changes_real_state_before_postflight_snapshot(self):
        verifier = self.local_verifier()
        sql = release["atomic_apply_sql"](Path.cwd())
        failed = verifier["force_postflight_failure"](sql)
        self.assertIn("update app_private.character_world_state", failed)
        self.assertLess(failed.index("releaseInvariantInjected"),
                        failed.index("create temporary table aurevane_release_after"))
        self.assertEqual(failed.count("insert into supabase_migrations.schema_migrations"), 4)
        self.assertIn("PRESERVATION_POSTFLIGHT", failed)

    def test_only_four_november14_migrations_can_be_staged(self):
        self.assertEqual(list(release["MIGRATIONS"]), [
            "20261114110000_world_map_teleport_geometry_v3.sql",
            "20261114112500_world_saved_geometry_recovery.sql",
            "20261114113000_world_void_pre_rotation_return.sql",
            "20261114114000_world_map_teleport_geometry_v4.sql",
        ])
        with tempfile.TemporaryDirectory() as directory:
            staged = Path(directory) / "supabase/migrations"
            release["stage_migrations"](Path.cwd(), Path(directory), [["20261112183130", "already_live"]])
            self.assertEqual(sorted(p.name for p in staged.glob("*.sql")),
                             ["20261112183130_already_live.sql", *release["MIGRATIONS"]])
            self.assertEqual((staged / "20261112183130_already_live.sql").read_text(),
                             "-- Already installed.\n")

    def test_altered_migration_is_rejected_before_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            migrations = root / "supabase/migrations"
            migrations.mkdir(parents=True)
            for name in release["MIGRATIONS"]:
                (migrations / name).write_bytes((Path("supabase/migrations") / name).read_bytes())
            release["verify_migrations"](root)
            (migrations / next(iter(release["MIGRATIONS"]))).write_text("-- changed")
            with self.assertRaises(SystemExit):
                release["verify_migrations"](root)

    def test_cli_plan_must_match_exact_order_without_old_migrations(self):
        verify = release["verify_plan"]
        names = list(release["MIGRATIONS"])
        verify("\n".join(names))
        for invalid in (names[::-1], names[:-1], ["20261112183130_town_and_continent_teleport_geometry.sql", *names], names + names):
            with self.subTest(invalid=invalid), self.assertRaises(SystemExit):
                verify("\n".join(invalid))

    def test_preservation_rejects_history_geometry_acl_or_progress_changes(self):
        before = {"ledger": [["20261112183130", "already_live"]],
                  "baseline_digest": release["BASELINE_DIGEST"],
                  "geometry": {"v1": "hash1", "v2": "hash2"},
                  "world": "saved-progress",
                  "legacy_functions": {"v1": "body-and-acl"},
                  "preserved_acl": {"read": "acl"}}
        after = deepcopy(before)
        after["ledger"] += release["migration_rows"]()
        release["verify_preservation"](before, after)
        for field in ("baseline_digest", "geometry", "world", "legacy_functions", "preserved_acl"):
            changed = deepcopy(after)
            changed[field] = "changed"
            with self.subTest(field=field), self.assertRaises(SystemExit):
                release["verify_preservation"](before, changed)
        changed = deepcopy(after)
        changed["ledger"][0] = ["20261112183130", "rewritten_history"]
        with self.assertRaises(SystemExit):
            release["verify_preservation"](before, changed)

    def test_installed_functions_require_exact_service_only_access(self):
        valid = {name: {"exists": True, "service": service, "player": False,
                        "anon": False, "public": False}
                 for name, service in release["NEW_FUNCTIONS"].items()}
        release["verify_functions"](valid)
        for name in valid:
            for field in ("exists", "service", "player", "anon", "public"):
                changed = deepcopy(valid)
                changed[name][field] = not changed[name][field]
                with self.subTest(name=name, field=field), self.assertRaises(SystemExit):
                    release["verify_functions"](changed)

    def test_cron_activation_requires_same_ready_deployment_source(self):
        sha = "a" * 40
        release["verify_activation_source"](sha, sha)
        for candidate, deployed in ((sha, "b" * 40), (sha, ""), ("short", "short")):
            with self.assertRaises(SystemExit):
                release["verify_activation_source"](candidate, deployed)

    def test_atomic_apply_locks_before_snapshot_and_records_only_reviewed_files(self):
        sql = release["atomic_apply_sql"](Path.cwd())
        account = sql.index("pg_try_advisory_xact_lock")
        table = sql.index("lock table app_private.character_world_state")
        snapshot = sql.index("create temporary table aurevane_release_before")
        self.assertLess(account, table)
        self.assertLess(table, snapshot)
        second_account = sql.index("pg_try_advisory_xact_lock", account + 1)
        self.assertLess(table, second_account)
        self.assertLess(second_account, snapshot)
        self.assertIn("order by c.user_id", sql)
        self.assertIn("access exclusive mode nowait", sql)
        self.assertIn("set local statement_timeout = '45s'", sql)
        self.assertIn("set local transaction_timeout = '60s'", sql)
        self.assertNotIn("--writes-paused", sql)
        self.assertEqual(sql.count("insert into supabase_migrations.schema_migrations"), 4)
        self.assertNotIn("on conflict", sql.lower())
        self.assertIn("PRESERVATION_POSTFLIGHT", sql)
        self.assertNotIn("configure_world_void_return_cron_v1(true)", sql)
        self.assertNotIn("from app_private.combat_content_versions", sql)

    def test_all_file_transaction_wrappers_are_removed_only_from_execution(self):
        sql = release["atomic_apply_sql"](Path.cwd())
        # Exact original bodies remain in ledger statement arrays; execution
        # strips only each verified file's outer BEGIN/COMMIT pair.
        for name in release["MIGRATIONS"]:
            source = (Path("supabase/migrations") / name).read_text()
            body = source.strip()[len("begin;"):-len("commit;")].strip()
            self.assertIn(body, sql)
            self.assertIn(source.replace("'", "''"), sql)


if __name__ == "__main__":
    unittest.main()
