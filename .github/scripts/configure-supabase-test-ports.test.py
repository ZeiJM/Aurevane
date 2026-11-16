import os
from pathlib import Path
from runpy import run_path
import socket
import subprocess
import tempfile
import tomllib
import unittest


SCRIPT = Path(__file__).with_name("configure-supabase-test-ports.py")
configure_ports = run_path(str(SCRIPT))["configure_ports"] if SCRIPT.exists() else None


class SupabaseTestPortConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "config.toml"
        self.original = (
            'project_id = "disposable"\n\n'
            "[api]\n"
            "enabled = true\n"
            "port = 54321\n\n"
            "[db]\n"
            "port = 54322\n"
            "shadow_port = 54320\n"
            "major_version = 17\n\n"
            "[db.seed]\n"
            "enabled = true\n"
        )
        self.path.write_text(self.original)

    def test_configuration_script_exists(self):
        self.assertTrue(SCRIPT.exists(), "Add the disposable Supabase port configurator.")

    @unittest.skipUnless(configure_ports, "port configurator not implemented yet")
    def test_replaces_all_three_fixed_service_ports_with_distinct_available_ports(self):
        listeners = []
        try:
            for port in (54320, 54321, 54322):
                listener = socket.socket()
                try:
                    listener.bind(("0.0.0.0", port))
                    listener.listen()
                    listeners.append(listener)
                except OSError:
                    listener.close()

            configured = configure_ports(self.path)
            parsed = tomllib.loads(self.path.read_text())
            ports = {parsed["api"]["port"], parsed["db"]["port"], parsed["db"]["shadow_port"]}
            self.assertEqual(ports, set(configured.values()))
            self.assertEqual(len(ports), 3)
            self.assertTrue(ports.isdisjoint({54320, 54321, 54322}))
            for listener in listeners:
                self.assertNotIn(listener.getsockname()[1], ports)
        finally:
            for listener in listeners:
                listener.close()

    @unittest.skipUnless(configure_ports, "port configurator not implemented yet")
    def test_cli_exports_selected_api_endpoint_without_discarding_existing_environment(self):
        root = Path(self.directory.name)
        (root / "supabase").mkdir()
        config_path = root / "supabase/config.toml"
        config_path.write_text(self.original)
        environment_path = root / "github-env"
        environment_path.write_text("EXISTING=value\n")
        subprocess.run(
            ["python", str(SCRIPT.resolve())],
            cwd=root,
            check=True,
            env={**os.environ, "GITHUB_ENV": str(environment_path)},
        )
        configured = tomllib.loads(config_path.read_text())
        self.assertEqual(
            environment_path.read_text(),
            f"EXISTING=value\nSUPABASE_TEST_API_URL=http://127.0.0.1:{configured['api']['port']}\n",
        )

    @unittest.skipUnless(configure_ports, "port configurator not implemented yet")
    def test_invalid_config_is_unchanged(self):
        original = "[broken"
        self.path.write_text(original)
        with self.assertRaises(tomllib.TOMLDecodeError):
            configure_ports(self.path)
        self.assertEqual(self.path.read_text(), original)

    def test_layout_workflow_configures_service_ports_before_startup(self):
        workflow = Path(__file__).parents[1] / "workflows/profile-layout-review.yml"
        source = workflow.read_text()
        configure = "python .github/scripts/configure-supabase-test-ports.py"
        start = "pnpm exec supabase start"
        self.assertIn(configure, source)
        self.assertLess(source.index(configure), source.index(start))
        for path in (
            ".github/scripts/configure-supabase-test-ports.py",
            ".github/scripts/configure-supabase-test-ports.test.py",
            ".github/scripts/auth-test-helpers.sh",
        ):
            self.assertEqual(
                source.count(f"      - {path}"),
                2,
                f"both push and pull_request path filters must include {path}",
            )

    def test_auth_helper_uses_the_exported_api_endpoint(self):
        helper = Path(__file__).with_name("auth-test-helpers.sh")
        command = f"""
pnpm() {{ printf '%s\\n' 'ANON_KEY=anon' 'SERVICE_ROLE_KEY=service'; }}
source {helper}
load_test_auth
printf '%s' "$TEST_AUTH_API_URL"
"""
        result = subprocess.run(
            ["bash", "-c", command],
            check=True,
            text=True,
            capture_output=True,
            env={**os.environ, "SUPABASE_TEST_API_URL": "http://127.0.0.1:61234"},
        )
        self.assertEqual(result.stdout, "http://127.0.0.1:61234")


if __name__ == "__main__":
    unittest.main()
