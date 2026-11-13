"""Apply only the reviewed World map geometry migration to production."""

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

MIGRATION = "20261112183130_town_and_continent_teleport_geometry.sql"
SOURCE_HASH = "a7978ef2e12f2a3b3c75eeedf8ae1a30826505273dc00cc496b407010062f44c"
BASELINE_COUNT = 258
BASELINE_DIGEST = "62837f675aae28d2021387351524be531b99ef7c747826164779f85b96a6b90c"
TELEPORT_V2 = (
    "public.teleport_master_player_v2(uuid,uuid,bigint,uuid,text,integer,integer,"
    "integer,text,boolean,uuid)"
)

STATE_QUERY = f"""
select jsonb_build_object(
 'ledger', (select jsonb_agg(jsonb_build_array(version,name) order by version)
            from supabase_migrations.schema_migrations),
 'digest', (select encode(sha256(convert_to(string_agg(
              jsonb_build_array(version,name,statements)::text, E'\\n' order by version
            ),'UTF8')),'hex') from supabase_migrations.schema_migrations),
 'v1', (select jsonb_agg(jsonb_build_array(realm_id,sector_number,geometry_hash)
                 order by realm_id,sector_number)
          from app_private.master_teleport_geometry
          where geometry_version='2026-11-12-v1'),
 'v2_count', (select count(*) from app_private.master_teleport_geometry
              where geometry_version='2026-11-12-v2'),
 'v2_function', to_regprocedure('{TELEPORT_V2}') is not null,
 'service_access', coalesce(has_function_privilege('service_role',
                    to_regprocedure('{TELEPORT_V2}'),'EXECUTE'),false),
 'player_access', coalesce(has_function_privilege('authenticated',
                   to_regprocedure('{TELEPORT_V2}'),'EXECUTE'),false)
)
"""


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


def run(command, description, *, env=None, timeout=120):
    try:
        result = subprocess.run(
            command, env=env, text=True, capture_output=True, timeout=timeout, check=False
        )
    except (OSError, subprocess.TimeoutExpired):
        raise SystemExit(f"{description} could not complete.") from None
    if result.returncode:
        # Never log the CLI output: it can include the database URL.
        raise SystemExit(f"{description} failed; no credentials or SQL were logged.")
    return result.stdout + result.stderr


def read_state(connection):
    output = run(
        ["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "-c", "begin read only",
         "-c", STATE_QUERY, "-c", "rollback"],
        "Read-only production state check",
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
        return json.loads(output)
    except json.JSONDecodeError:
        raise SystemExit("The production state response was invalid.") from None


def main():
    uri = production_url(os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    connection = urlsplit(uri)
    migration = Path("supabase/migrations") / MIGRATION
    if hashlib.sha256(migration.read_bytes()).hexdigest() != SOURCE_HASH:
        raise SystemExit("The World geometry migration differs from the reviewed source.")
    before = read_state(connection)
    ledger = before["ledger"]
    if (len(ledger) != BASELINE_COUNT or before["digest"] != BASELINE_DIGEST
            or ledger[-1] != ["20261112115655", "master_player_teleport"]
            or len(before["v1"] or []) != 18 or before["v2_count"] != 0
            or before["v2_function"]):
        raise SystemExit("Production no longer matches the reviewed v1 baseline.")

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        staged = workdir / "supabase/migrations"
        staged.mkdir(parents=True)
        for name in ("supabase/config.toml", "supabase/templates/recovery.html"):
            target = workdir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(name, target)
        for version, name in ledger:
            if not re.fullmatch(r"\d{14}", version) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                raise SystemExit("Production ledger has an unexpected migration identifier.")
            (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
        shutil.copyfile(migration, staged / MIGRATION)
        cli = sys.argv[1]
        push = [cli, "db", "push", "--workdir", str(workdir), "--db-url", uri,
                "--include-all"]
        planned = run([*push, "--dry-run"], "World geometry dry run")
        names = re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", planned)
        if names != [MIGRATION] or read_state(connection) != before:
            raise SystemExit("The dry run changed state or selected an unexpected migration.")
        print(f"Verified {BASELINE_COUNT} unchanged entries; applying {MIGRATION}.", flush=True)
        run([*push, "--yes"], "World geometry migration apply")

    after = read_state(connection)
    if (after["ledger"] != ledger + [["20261112183130", "town_and_continent_teleport_geometry"]]
            or after["v1"] != before["v1"] or after["v2_count"] != 0
            or not after["v2_function"] or not after["service_access"]
            or after["player_access"]):
        raise SystemExit("World geometry postflight failed; inspect production before deployment.")
    print("Production geometry v2 installed; v1 rows and all prior migration entries preserved.")


if __name__ == "__main__":
    main()
