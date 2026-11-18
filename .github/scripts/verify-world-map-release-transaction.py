"""Exercise the real PR1040 transaction only in the disposable local PG17 stack.

Reset the same local stack once to its source PR1039 baseline, prove a real
postflight violation rolls all four migrations back, then apply successfully.
No production connection, token or release CLI baseline override is supported.
"""

import json
import os
from pathlib import Path
import re
from runpy import run_path
import select
import shlex
import shutil
import subprocess
import tempfile
import tomllib
from urllib.parse import urlsplit
import uuid


CONTAINER = "supabase_db_aurevane"


def validate_local_target(config, uri, container):
    try:
        parsed = urlsplit(uri)
        port = config["db"]["port"]
        bindings = container["NetworkSettings"]["Ports"]["5432/tcp"]
        allowed = (
            config["project_id"] == "aurevane"
            and config["db"]["major_version"] == 17
            and type(port) is int and 1 <= port <= 65535
            and parsed.scheme in ("postgres", "postgresql")
            and parsed.hostname in ("127.0.0.1", "localhost", "::1")
            and parsed.port == port and parsed.username == "postgres"
            and parsed.path == "/postgres" and not parsed.query and not parsed.fragment
            and container["Name"] == "/" + CONTAINER
            and container["State"]["Running"] is True
            and re.search(r"(?:^|/)postgres:17[.-]", container["Config"]["Image"])
            and isinstance(bindings, list) and bool(bindings)
            and all(binding["HostPort"] == str(port)
                    and binding["HostIp"] in ("0.0.0.0", "127.0.0.1", "::", "::1")
                    for binding in bindings)
        )
    except (ValueError, KeyError, TypeError):
        allowed = False
    if not allowed:
        raise SystemExit("Only the configured loopback Aurevane Docker PG17 stack is allowed.")


def stage_baseline(root, workdir, release):
    release["verify_migrations"](root)
    source = sorted((root / "supabase/migrations").glob("*.sql"))
    names = list(release["MIGRATIONS"])
    first, last = names[0][:14], names[-1][:14]
    if [p.name for p in source if first <= p.name[:14] <= last] != names:
        raise SystemExit("The historical release window must contain exactly the reviewed four Nov14 additions.")
    for name in ("supabase/config.toml", "supabase/templates/recovery.html"):
        target = workdir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    staged = workdir / "supabase/migrations"
    staged.mkdir(parents=True)
    for path in source:
        if path.name[:14] < first:
            shutil.copyfile(path, staged / path.name)
    return [p.name for p in source if p.name[:14] > last]


def force_postflight_failure(sql):
    boundary = "create temporary table aurevane_release_after"
    if sql.count(boundary) != 1:
        raise SystemExit("The atomic transaction postflight boundary changed.")
    violation = "update app_private.character_world_state set state=state || '{\"releaseInvariantInjected\":true}'::jsonb;\n"
    return sql.replace(boundary, violation + boundary, 1)


def command(args, *, sql=None, timeout=30, failure=None):
    try:
        result = subprocess.run(args, input=sql, text=True, capture_output=True,
                                timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise SystemExit("Disposable transaction verification command could not complete.") from None
    if failure:
        if result.returncode == 0 or failure not in result.stderr:
            # This branch executes only fixed SQL in the already-guarded local
            # Docker DB, so its primary SQL error contains no connection keys.
            primary = re.search(r"ERROR:[^\n]{1,200}", result.stderr)
            detail = primary[0] if primary else "no matching preservation error"
            raise SystemExit(f"The forced transaction did not reach its real postflight: {detail}.")
    elif result.returncode:
        # Local CLI status can contain keys. Never print subprocess output.
        error = re.search(r"ERROR:\s*([^\n]{1,160})", result.stderr)
        detail = error[1] if error and re.fullmatch(r"[A-Z0-9_ .:-]+", error[1]) else "see disposable PG/CI diagnostics"
        raise SystemExit(f"Disposable transaction verification failed: {detail}.")
    return result.stdout.strip()


def verify_new_account_busy(psql, sql, user, saved, quote):
    """A row omitted by scan one must be caught by the locked recheck.

    The holder has no World row initially. Injecting its first row between
    scans deterministically models the race without arbitrary sleeps.
    """
    holder = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True)
    try:
        holder.stdin.write("begin; select 'RELEASE_LOCK_READY' from pg_advisory_xact_lock(hashtextextended(" + quote(user) + ",1));\n")
        holder.stdin.flush()
        if not select.select([holder.stdout], [], [], 5)[0] or holder.stdout.readline().strip() != "RELEASE_LOCK_READY":
            raise SystemExit("The bounded disposable account-lock fixture did not become ready.")
        boundary = "lock table app_private.character_world_state"
        row = "insert into app_private.character_world_state(character_id,state) values (" + quote(user) + "," + quote(json.dumps(saved)) + "::jsonb);\n"
        if sql.count(boundary) != 1:
            raise SystemExit("The world-lock recheck boundary changed.")
        command(psql + ["--single-transaction"], sql=sql.replace(boundary, row + boundary, 1),
                timeout=15, failure="RELEASE_ACCOUNT_BUSY")
    finally:
        try:
            holder.communicate("rollback;\n\\q\n", timeout=10)
        except (subprocess.TimeoutExpired, BrokenPipeError):
            holder.kill()
            holder.communicate(timeout=5)


def main():
    if os.environ.get("AUREVANE_PRODUCTION_DB_URL"):
        raise SystemExit("Production credentials must not be present in disposable verification.")
    root = Path.cwd()
    release = run_path(str(Path(__file__).with_name("apply-aurevane-world-map-geometry.py")))
    release["verify_migrations"](root)
    config = tomllib.loads((root / "supabase/config.toml").read_text())
    status = command(["pnpm", "exec", "supabase", "status", "-o", "env"])
    values = {}
    for line in status.splitlines():
        if line.startswith("DB_URL="):
            values["DB_URL"] = shlex.split(line.split("=", 1)[1])[0]
    inspected = json.loads(command(["docker", "inspect", CONTAINER]))
    if len(inspected) != 1:
        raise SystemExit("Exactly one configured disposable DB container is required.")
    validate_local_target(config, values.get("DB_URL", ""), inspected[0])
    psql = ["docker", "exec", "-i", CONTAINER, "psql", "-XqAtw",
            "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]

    def query(sql):
        return json.loads(command(psql, sql="set statement_timeout='15s';\n" + sql, timeout=20))

    def state(after=False):
        return query(release["state_sql"](after=after) + ";")

    version = query("select to_jsonb(current_setting('server_version_num')::integer);")
    if not 170000 <= version < 180000:
        raise SystemExit("Disposable transaction acceptance requires PostgreSQL 17.")
    with tempfile.TemporaryDirectory() as directory:
        workdir = Path(directory)
        successors = stage_baseline(root, workdir, release)
        # --local only, fixed configured project identity; no remote URL enters
        # this command. Existing services keep the same local ports and keys.
        command(["pnpm", "exec", "supabase", "db", "reset", "--local", "--no-seed",
                 "--workdir", str(workdir)], timeout=180)
    validate_local_target(config, values["DB_URL"], json.loads(command(["docker", "inspect", CONTAINER]))[0])

    users = [str(uuid.uuid4()) for _ in range(3)]
    quote = release["sql_literal"]
    rows = quote(json.dumps(["............."] * 9)) + "::jsonb"
    user_values = ",".join(f"({quote(user)}::uuid,{quote(user + '@example.test')},now())" for user in users)
    fixture = f"insert into auth.users(id,email,email_confirmed_at) values {user_values};\n"
    fixture += """insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
      presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
      might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
      select u.id,u.id,0,1,'Release fixture','release-'||u.id,'default','they','portrait','appearance',
      'vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now() from auth.users u where u.id in ("""
    fixture += ",".join(quote(user) + "::uuid" for user in users) + ");\n"
    for user, sector in zip(users, ("verdant-expanse", "uncharted-0-0")):
        saved = {"version": 7, "position": {"sectorId": sector, "x": 6, "y": 4},
                 "route": [], "nextStepAt": None, "discoveries": {"release-fixture": {"seen": True}},
                 "quests": {"preserve": "exact"}}
        fixture += f"insert into app_private.character_world_state(character_id,state,last_command_id,last_command_fingerprint,last_seen_at) values ({quote(user)},{quote(json.dumps(saved))}::jsonb,{quote(user)},'fixture-receipt',now()-interval '1 hour');\n"
    for number, version_name in enumerate(("2026-11-12-v1", "2026-11-12-v2"), 8189):
        fixture += f"insert into app_private.master_teleport_geometry(geometry_version,sector_id,realm_id,sector_number,rows,safe_cells,geometry_hash) values ({quote(version_name)},'release-fixture-{number}',null,{number},{rows},'[]','fixture-{number}');\n"
    command(psql + ["--single-transaction"], sql=fixture)
    before = state()
    if before["ledger"][-1] != ["20261112183130", "town_and_continent_teleport_geometry"]:
        raise SystemExit("The disposable reset did not stop at the PR1039 baseline.")
    if before["cron"] or any(f["exists"] for f in before["functions"].values()):
        raise SystemExit("The disposable baseline already has PR1040 objects.")
    # Overrides exist only in this isolated in-memory test import. The production
    # entry point has no argument/environment override for either invariant.
    globals_for_test = release["atomic_apply_sql"].__globals__
    globals_for_test["BASELINE_COUNT"] = len(before["ledger"])
    globals_for_test["BASELINE_DIGEST"] = before["baseline_digest"]
    valid = release["atomic_apply_sql"](root)
    verify_new_account_busy(psql, valid, users[2], {
        "version": 1, "position": {"sectorId": "verdant-expanse", "x": 6, "y": 4},
        "route": [], "discoveries": {},
    }, quote)
    if state() != before:
        raise SystemExit("New-account contention failed to roll back the transaction exactly.")
    print("Verified locked account recheck rejects a newly appeared busy World row without waiting.", flush=True)
    command(psql + ["--single-transaction"], sql=force_postflight_failure(valid),
            timeout=75, failure="PRESERVATION_POSTFLIGHT")
    if state() != before:
        raise SystemExit("Forced postflight failure did not roll back ledger, functions, ACLs, geometry and saved state exactly.")
    print("Verified real postflight failure rolls all four migrations and fixture state back.", flush=True)
    command(psql + ["--single-transaction"], sql=valid, timeout=75)
    after = state(after=True)
    release["verify_baseline"](after, installed=True)
    release["verify_preservation"](before, after)
    if not after["backfill_valid"] or after["cron"] or after["other_cron"] != before["other_cron"]:
        raise SystemExit("Successful atomic transaction did not preserve inactive cron and valid private metadata.")
    ferry = run_path(str(Path(__file__).with_name("apply-aurevane-pr1044.py")))
    ferry_names = list(ferry["MIGRATIONS"])
    if successors[:len(ferry_names)] == ferry_names:
        validate_local_target(config, values["DB_URL"], json.loads(command(["docker", "inspect", CONTAINER]))[0])
        command(psql + ["--single-transaction"], sql="""
          insert into app_private.world_ferry_trips(direction,departure_at,warped_phase)
          values ('outbound',3600000,0);
        """)
        before_ferry = query(ferry["state_sql"](include_player_state=True) + ";")
        ferry_sql = ferry["atomic_apply_sql"](
            ferry["read_sources"](root), baseline_count=len(before_ferry["ledger"]),
            baseline_digest=before_ferry["baseline_digest"],
        )
        command(psql + ["--single-transaction"], sql=force_postflight_failure(ferry_sql),
                timeout=75, failure="PRESERVATION_POSTFLIGHT")
        if query(ferry["state_sql"](include_player_state=True) + ";") != before_ferry:
            raise SystemExit("Forced PR1044 postflight failure did not roll back exactly.")
        command(psql + ["--single-transaction"], sql=ferry_sql, timeout=75)
        ferry_after = query(ferry["state_sql"](include_player_state=True, installed=True) + ";")
        if ferry_after["sources"] != ferry["source_hashes"]() or ferry_after["unpreserved_trips"] != 0:
            raise SystemExit("PR1044 ledger hashes or preexisting ferry modes differ after commit.")
        command(psql + ["--single-transaction"], sql="""
          delete from app_private.world_ferry_trips
          where direction='outbound' and departure_at=3600000;
        """)
        successors = successors[len(ferry_names):]
        print("Verified real PG17 PR1044 atomic rollback and success: two exact migration files, saved state, legacy ferry booking, geometry, permissions and cron.")
    # Remove only these disposable fixtures; leave all four candidate migrations
    # installed for the existing browser/native cases which follow this step.
    cleanup = "delete from auth.users where id in (" + ",".join(quote(user) + "::uuid" for user in users) + ");"
    cleanup += "delete from app_private.master_teleport_geometry where sector_id in ('release-fixture-8189','release-fixture-8190');"
    command(psql + ["--single-transaction"], sql=cleanup)
    print("Verified PG17 atomic success, exact four source-history rows, RPC ACLs, preserved v1/v2 and saved progress; cron remains inactive.")
    if successors:
        # The historical release test deliberately excluded later migrations.
        # Apply them only to this guarded local stack for the candidate browser cases.
        validate_local_target(config, values["DB_URL"], json.loads(command(["docker", "inspect", CONTAINER]))[0])
        command(["pnpm", "exec", "supabase", "migration", "up", "--local"], timeout=120)
        print(f"Applied {len(successors)} successor migrations to the disposable browser database.")


if __name__ == "__main__":
    main()
