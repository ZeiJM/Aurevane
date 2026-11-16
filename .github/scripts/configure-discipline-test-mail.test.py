import errno
import os
from pathlib import Path
from runpy import run_path
import socket
import subprocess
import sys
import tempfile
import tomllib
import unittest


configure_mail = run_path(
    str(Path(__file__).with_name("configure-discipline-test-mail.py"))
)["configure_mail"]


class DisciplineMailConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "config.toml"
        self.original = (
            'project_id = "disposable"\n[api]\nport = 54321\n'
            '[auth.email]\nenable_confirmations = true\n'
        )
        self.path.write_text(self.original)

    def test_cli_exports_selected_mail_endpoint_to_later_browser_steps(self):
        root = Path(self.directory.name)
        (root / "supabase").mkdir()
        config_path = root / "supabase/config.toml"
        config_path.write_text(self.original)
        environment_path = root / "github-env"
        environment_path.write_text("EXISTING=value\n")
        script = Path(__file__).with_name("configure-discipline-test-mail.py").resolve()
        subprocess.run(
            [sys.executable, str(script)], cwd=root, check=True,
            env={**os.environ, "GITHUB_ENV": str(environment_path)},
        )
        port = tomllib.loads(config_path.read_text())["local_smtp"]["port"]
        self.assertEqual(
            environment_path.read_text(),
            f"EXISTING=value\nINBUCKET_URL=http://127.0.0.1:{port}\n",
        )
        self.assertNotEqual(port, 54324)

    def test_occupied_default_port_does_not_disable_confirmation_email(self):
        with socket.socket() as occupied:
            try:
                occupied.bind(("0.0.0.0", 54324))
                occupied.listen()
            except OSError as error:
                # A runner already using this port is the same regression case.
                self.assertEqual(error.errno, errno.EADDRINUSE)
            port = configure_mail(self.path)
            self.assertNotEqual(port, 54324)
            with socket.socket() as mail:
                mail.bind(("0.0.0.0", port))
            configured = tomllib.loads(self.path.read_text())
            self.assertEqual(configured.pop("local_smtp"), {"enabled": True, "port": port})
            self.assertEqual(configured, tomllib.loads(self.original))

    def test_preserves_existing_mail_configuration_instead_of_duplicating_tables(self):
        for section in ("local_smtp", "inbucket"):
            with self.subTest(section=section):
                original = self.original + f"\n[{section}]\nport = 12345\n"
                self.path.write_text(original)
                with self.assertRaises(ValueError):
                    configure_mail(self.path)
                self.assertEqual(self.path.read_text(), original)

    def test_invalid_config_is_unchanged(self):
        original = "[broken"
        self.path.write_text(original)
        with self.assertRaises(tomllib.TOMLDecodeError):
            configure_mail(self.path)
        self.assertEqual(self.path.read_text(), original)

    def test_every_supabase_workflow_selects_mail_port_before_startup(self):
        workflows = Path(__file__).parents[1] / "workflows"
        configure = "python .github/scripts/configure-discipline-test-mail.py"
        start = "pnpm exec supabase start"
        checked = []
        for path in sorted(workflows.glob("*.yml")):
            workflow = path.read_text()
            if start not in workflow:
                continue
            checked.append(path.name)
            self.assertIn(configure, workflow, path.name)
            self.assertLess(workflow.index(configure), workflow.index(start), path.name)
        self.assertGreaterEqual(len(checked), 14)


if __name__ == "__main__":
    unittest.main()
