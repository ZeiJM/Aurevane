import errno
from pathlib import Path
from runpy import run_path
import socket
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


if __name__ == "__main__":
    unittest.main()
