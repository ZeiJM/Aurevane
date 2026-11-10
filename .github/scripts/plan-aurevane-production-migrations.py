"""Read the reviewed production ledger and verify or apply only the unified batch."""

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit

LEDGER_COUNT = 221
LEDGER_HASH = "9529cbf5df840fda23858a94d887e3dbe5ea78f033b6a009c03106b0f6b72ea2"
SOURCE_COUNT = 248
INVENTORY_HASH = "52ad63acedf2f8930b147ab1e6e734469523999408d0c3fd2eca61e1be268d31"
FIRST_PENDING = "20261107114807"
PENDING_COUNT = 35
PENDING_HASH = "5ee0788e147447e5c2c0e74078b37a56ccc03367c10a1d87cb5eb500dd9ff8e9"

LEDGER_QUERY = """
select jsonb_build_object(
  'digest', encode(sha256(convert_to(string_agg(
    jsonb_build_array(version, name, statements)::text, E'\\n' order by version
  ) filter (where version < '{first_pending}'), 'UTF8')), 'hex'),
  'pending_digest', encode(sha256(convert_to(string_agg(
    jsonb_build_array(version, name, statements)::text, E'\\n' order by version
  ) filter (where version >= '{first_pending}'), 'UTF8')), 'hex'),
  'rows', jsonb_agg(jsonb_build_array(version, name) order by version)
)
from supabase_migrations.schema_migrations;
""".format(first_pending=FIRST_PENDING)


def production_url(value):
    try:
        url = urlsplit(value)
        allowed = (
            url.scheme in {"postgres", "postgresql"}
            and url.username == "postgres.luazfeupwfgnilohfsya"
            and bool(url.password)
            and re.fullmatch(r"aws-\d+-us-east-2\.pooler\.supabase\.com", url.hostname or "")
            and url.port == 5432
            and url.path == "/postgres"
            and url.query in {"sslmode=require", "sslmode=verify-full"}
            and not url.fragment
        )
    except ValueError:
        allowed = False
    if not allowed:
        raise SystemExit("Supply the production project's TLS session-pooler URL.")
    return value


def run_checked(command, description, *, timeout=90, **kwargs):
    try:
        result = subprocess.run(command, text=True, capture_output=True, timeout=timeout, **kwargs)
    except (OSError, subprocess.TimeoutExpired):
        raise SystemExit(f"{description} could not complete.") from None
    if result.returncode:
        error = result.stderr.lower()
        if "password authentication failed" in error or "tenant or user not found" in error:
            raise SystemExit(f"{description} failed: authentication rejected.")
        raise SystemExit(f"{description} failed. No connection details were logged.")
    return result


def read_ledger(uri, expected_pending=()):
    connection = urlsplit(uri)
    result = run_checked(
        ["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "-c", "begin read only",
         "-c", LEDGER_QUERY, "-c", "rollback"],
        "Read-only production ledger check",
        env={
            **os.environ,
            "PGHOST": connection.hostname,
            "PGPORT": str(connection.port),
            "PGDATABASE": connection.path.removeprefix("/"),
            "PGUSER": connection.username,
            "PGPASSWORD": unquote(connection.password),
            "PGSSLMODE": connection.query.removeprefix("sslmode="),
            "PGCONNECT_TIMEOUT": "15",
        },
    )
    try:
        ledger = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise SystemExit("The production ledger response was invalid.") from None
    if not isinstance(ledger, dict) or ledger.get("digest") != LEDGER_HASH:
        raise SystemExit("Production migration history differs from the reviewed baseline.")
    rows = ledger.get("rows")
    if not isinstance(rows, list) or len(rows) != LEDGER_COUNT + len(expected_pending) or any(
        not isinstance(row, list)
        or len(row) != 2
        or not all(isinstance(field, str) for field in row)
        or not re.fullmatch(r"\d{14}", row[0])
        or not re.fullmatch(r"[A-Za-z0-9_-]+", row[1])
        for row in rows
    ) or len({row[0] for row in rows}) != len(rows):
        raise SystemExit("Production migration versions differ from the reviewed baseline.")
    pending = [row for row in rows if row[0] >= FIRST_PENDING]
    if pending != list(expected_pending):
        raise SystemExit("Production pending migration versions differ from the reviewed batch.")
    if expected_pending and ledger.get("pending_digest") != PENDING_HASH:
        raise SystemExit("The applied migration bodies differ from the reviewed batch.")
    return ledger


def dry_run(root, cli, uri, *, apply=False):
    source = sorted((root / "supabase" / "migrations").glob("*.sql"))
    inventory = "\n".join(f"{p.name}\t{hashlib.sha256(p.read_bytes()).hexdigest()}" for p in source)
    if len(source) != SOURCE_COUNT or hashlib.sha256(inventory.encode()).hexdigest() != INVENTORY_HASH:
        raise SystemExit("Source migrations differ from the reviewed unified inventory.")
    pending = [p for p in source if p.name[:14] >= FIRST_PENDING]
    if len(pending) != PENDING_COUNT or pending[0].name[:14] != FIRST_PENDING:
        raise SystemExit("The source does not contain the reviewed pending migration batch.")
    ledger = read_ledger(uri)
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        staged = workdir / "supabase" / "migrations"
        staged.mkdir(parents=True)
        for path in ("supabase/config.toml", "supabase/templates/recovery.html"):
            target = workdir / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / path, target)
        # These versions are already installed, including hosted-only operations
        # and retimed entries. Keep the remote ledger intact.
        for version, name in ledger["rows"]:
            (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
        for path in pending:
            shutil.copyfile(path, staged / path.name)
        push = [str(cli), "db", "push", "--workdir", str(workdir), "--db-url", uri, "--include-all"]
        result = run_checked([*push, "--dry-run"], "Production migration dry run")
        planned = re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", result.stdout + result.stderr)
        if planned != [p.name for p in pending]:
            raise SystemExit("The CLI did not return the exact reviewed migration sequence.")
        if read_ledger(uri) != ledger:
            raise SystemExit("Production migration history changed during the dry run.")
        if apply:
            print(f"Applying {PENDING_COUNT} reviewed production migrations.", flush=True)
            run_checked([*push, "--yes"], "Production migration apply", timeout=240)
            expected = [path.stem.split("_", 1) for path in pending]
            final = read_ledger(uri, expected)
            if final["rows"][:LEDGER_COUNT] != ledger["rows"]:
                raise SystemExit("An existing production migration entry changed during apply.")
            print(f"Verified {len(final['rows'])} production migrations and all existing entries preserved.")
            return
    print(f"Verified {LEDGER_COUNT} installed entries and {PENDING_COUNT} ordered pending migrations.")
    for path in pending:
        print(path.name)


if __name__ == "__main__":
    uri = production_url(os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    dry_run(Path.cwd(), Path(sys.argv[1]), uri, apply=sys.argv[2:] == ["--apply"])
