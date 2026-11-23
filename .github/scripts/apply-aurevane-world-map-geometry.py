"""Guard the PR1040 four-migration release; default operation is read-only planning.

Apply and cron activation are separate, explicit operations. Never replay PR1039.
The 259-entry baseline was read from production on 2026-11-15, not inferred
from the source inventory (hosted-only and retimed history must stay intact).
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

BASELINE_COUNT = 259
BASELINE_DIGEST = "60aa72680eee7146cdc39bbed56f4890c7c91e8c893516f7094e9b41fe59ad4b"
MIGRATIONS = {
    "20261114110000_world_map_teleport_geometry_v3.sql": "190faf7d7e669429fb33492d76eddd599e5c882548b081a9bc7c39413551e4d1",
    "20261114112500_world_saved_geometry_recovery.sql": "0a1effb68543bfbcd1170cfce232034ebcba526c2ceb58f99d1d32d4e5b6f57a",
    "20261114113000_world_void_pre_rotation_return.sql": "fa7845b2bf711908bdfd54ac2c24eeceabf3876237aeeb1b23d4816faff5e866",
    "20261114114000_world_map_teleport_geometry_v4.sql": "c02091b03c00f39e40c804cd8621f63644dee2af4da47dabd8aa14291e9b3b08",
}
TELEPORT_ARGS = "uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid"
NEW_FUNCTIONS = {
    f"public.teleport_master_player_v3({TELEPORT_ARGS})": True,
    f"public.teleport_master_player_v4({TELEPORT_ARGS})": True,
    "public.recover_world_saved_geometry_v1(uuid,uuid,bigint,text,integer,integer,text,integer,integer,boolean)": True,
    "app_private.world_void_private_sector_v1(text)": False,
    "app_private.world_void_cutoff_v1(bigint)": False,
    "app_private.world_void_return_due_v1(jsonb,bigint)": False,
    "app_private.world_void_private_commit_blocked_v1(jsonb,jsonb,bigint)": False,
    "app_private.world_void_mark_state_v1()": False,
    "app_private.settle_world_void_return_v1(uuid,uuid)": False,
    "app_private.recover_due_world_void_returns_v1(integer)": False,
    "app_private.configure_world_void_return_cron_v1(boolean)": False,
}
LEGACY_FUNCTIONS = [f"public.teleport_master_player_v{n}({TELEPORT_ARGS})" for n in (1, 2)]
PRESERVED_ACL = LEGACY_FUNCTIONS + [
    "public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)",
    "public.read_world_state_v1(uuid,uuid,jsonb)",
    "public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)",
]
CRON_NAME = "aurevane-void-pre-rotation-return-v1"
CRON_COMMAND = "select * from app_private.recover_due_world_void_returns_v1(250);"


def migration_rows():
    return [[name[:14], name[15:-4]] for name in MIGRATIONS]


def production_url(value):
    try:
        url = urlsplit(value)
        allowed = (
            url.scheme in {"postgres", "postgresql"}
            and url.username == "postgres.luazfeupwfgnilohfsya"
            and bool(url.password)
            and re.fullmatch(r"aws-\d+-us-east-2\.pooler\.supabase\.com", url.hostname or "")
            and url.port == 5432 and url.path == "/postgres"
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
        result = subprocess.run(command, env=env, text=True, capture_output=True,
                                timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise SystemExit(f"{description} could not complete; inspect state before retrying.") from None
    if result.returncode:
        raise SystemExit(f"{description} failed; no credentials, SQL or command output were logged.")
    return result.stdout + result.stderr


def query(connection, sql, *, readonly=True):
    output = run(
        ["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "-c",
         "begin isolation level repeatable read" + (" read only" if readonly else ""),
         "-c", sql, "-c", "rollback" if readonly else "commit"],
        "Production state read" if readonly else "Explicit cron activation",
        env={**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port),
             "PGDATABASE": "postgres", "PGUSER": connection.username,
             "PGPASSWORD": unquote(connection.password),
             "PGSSLMODE": connection.query.removeprefix("sslmode="), "PGCONNECT_TIMEOUT": "15",
             "PGOPTIONS": "-c statement_timeout=45000 -c lock_timeout=5000"},
    )
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        raise SystemExit("Production returned an invalid state response.") from None


def verify_migrations(root):
    for name, digest in MIGRATIONS.items():
        try:
            actual = hashlib.sha256((root / "supabase/migrations" / name).read_bytes()).hexdigest()
        except OSError:
            raise SystemExit("A reviewed migration is missing.") from None
        if actual != digest:
            raise SystemExit("A migration differs from the reviewed four-file inventory.")


def verify_plan(output):
    if re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", output) != list(MIGRATIONS):
        raise SystemExit("The CLI did not select exactly the four reviewed migrations in order.")


def stage_migrations(root, workdir, ledger):
    staged = workdir / "supabase/migrations"
    staged.mkdir(parents=True)
    for name in ("supabase/config.toml", "supabase/templates/recovery.html"):
        target = workdir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / name, target)
    for version, name in ledger:
        if not re.fullmatch(r"\d{14}", version) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            raise SystemExit("Production history contains an unexpected migration identifier.")
        (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
    for name in MIGRATIONS:
        shutil.copyfile(root / "supabase/migrations" / name, staged / name)


def fingerprint(expression):
    return f"encode(sha256(convert_to(coalesce(({expression})::text,''),'UTF8')),'hex')"


def state_sql(*, after=False):
    functions = ",".join("'" + name + "'" for name in NEW_FUNCTIONS)
    legacy = ",".join("'" + name + "'" for name in LEGACY_FUNCTIONS)
    preserved = ",".join("'" + name + "'" for name in PRESERVED_ACL)
    # The only backfill change permitted is private-state deadline/realm marking,
    # its exact +1 version, and clearing that private row's command receipt.
    normalized = "case when sector_id like 'void:%' or sector_id like 'uncharted-%' then (to_jsonb(w)-'state'-'last_command_id'-'last_command_fingerprint') || jsonb_build_object('state',(state-'voidReturnAt'-'voidEntryRealm') || jsonb_build_object('version',(state->>'version')::bigint" + ("-1" if after else "") + ")) else to_jsonb(w) end"
    return f"""
select jsonb_build_object(
 'ledger',(select jsonb_agg(jsonb_build_array(version,name) order by version) from supabase_migrations.schema_migrations),
 'baseline_digest',(select encode(sha256(convert_to(string_agg(jsonb_build_array(version,name,statements)::text,E'\\n' order by version),'UTF8')),'hex') from supabase_migrations.schema_migrations where version <= '20261112183130'),
 'new_sources',(select coalesce(jsonb_object_agg(version,case when array_length(statements,1)=1 then encode(sha256(convert_to(statements[1],'UTF8')),'hex') else 'UNEXPECTED_STATEMENT_ARRAY' end),'{{}}') from supabase_migrations.schema_migrations where version > '20261112183130'),
 'geometry',(select jsonb_object_agg(geometry_version,digest) from (select geometry_version,{fingerprint('jsonb_agg(to_jsonb(g) order by realm_id,sector_number)')} as digest from app_private.master_teleport_geometry g group by geometry_version) x),
 'world',{fingerprint('(select jsonb_agg(' + normalized + ' order by character_id) from app_private.character_world_state w)')},
 'backfill_valid',not exists(select 1 from app_private.character_world_state where (sector_id like 'void:%' or sector_id like 'uncharted-%') and (state->>'voidReturnAt' is null or state->>'voidEntryRealm' is null or last_command_id is not null or last_command_fingerprint is not null)),
 'legacy_functions',(select jsonb_object_agg(s,{fingerprint('pg_get_functiondef(to_regprocedure(s))')}) from unnest(array[{legacy}]) s),
 'preserved_acl',(select jsonb_object_agg(s,coalesce((select proacl::text from pg_proc where oid=to_regprocedure(s)),'MISSING')) from unnest(array[{preserved}]) s),
 'functions',(select jsonb_object_agg(s,jsonb_build_object(
   'exists',to_regprocedure(s) is not null,
   'service',coalesce(has_function_privilege('service_role',to_regprocedure(s),'EXECUTE'),false),
   'player',coalesce(has_function_privilege('authenticated',to_regprocedure(s),'EXECUTE'),false),
   'anon',coalesce(has_function_privilege('anon',to_regprocedure(s),'EXECUTE'),false),
   'public',exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure(s) and a.grantee=0 and a.privilege_type='EXECUTE')
 )) from unnest(array[{functions}]) s),
 'trigger',exists(select 1 from pg_trigger where tgname='world_void_mark_state_v1' and tgrelid='app_private.character_world_state'::regclass and tgenabled='O' and not tgisinternal),
 'cron',(select coalesce(jsonb_agg(jsonb_build_object('schedule',schedule,'command',command,'active',active,'username',username,'database',database) order by jobid),'[]') from cron.job where jobname='{CRON_NAME}'),
 'other_cron',{fingerprint("(select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j where jobname <> '" + CRON_NAME + "')")}
)
"""


def read_state(connection, *, after=False):
    return query(connection, state_sql(after=after))


def verify_baseline(state, *, installed=False):
    ledger = state.get("ledger") or []
    expected_count = BASELINE_COUNT + (len(MIGRATIONS) if installed else 0)
    if (len(ledger) != expected_count or state.get("baseline_digest") != BASELINE_DIGEST
            or ledger[BASELINE_COUNT - 1] != ["20261112183130", "town_and_continent_teleport_geometry"]
            or len({row[0] for row in ledger}) != expected_count
            or (installed and ledger[BASELINE_COUNT:] != migration_rows())):
        raise SystemExit("Production history differs from the observed PR1039 baseline / exact PR1040 successor.")
    if not installed and any(value["exists"] for value in state["functions"].values()):
        raise SystemExit("Partial PR1040 installation detected; inspect rather than replaying migrations.")
    if installed:
        verify_functions(state["functions"])
        if state["new_sources"] != {name[:14]: digest for name, digest in MIGRATIONS.items()}:
            raise SystemExit("Installed migration source statements differ from the reviewed files.")
        if not state["trigger"]:
            raise SystemExit("The private-state deadline trigger is not enabled.")


def verify_functions(functions):
    if set(functions) != set(NEW_FUNCTIONS):
        raise SystemExit("Installed function inventory differs from the reviewed release.")
    for name, service in NEW_FUNCTIONS.items():
        if functions[name] != {"exists": True, "service": service, "player": False,
                               "anon": False, "public": False}:
            raise SystemExit("A release function is absent or has unexpected execution access.")


def verify_preservation(before, after):
    if after["ledger"] != before["ledger"] + migration_rows():
        raise SystemExit("Migration history changed outside the four reviewed additions.")
    for key in ("baseline_digest", "geometry", "world", "legacy_functions", "preserved_acl"):
        if after[key] != before[key]:
            raise SystemExit(f"Preservation postflight failed for {key}; inspect production before deployment.")


def verify_activation_source(expected, deployed):
    if not re.fullmatch(r"[0-9a-f]{40}", expected or "") or deployed != expected:
        raise SystemExit("Cron activation requires the exact verified READY production deployment SHA.")


def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"


def atomic_apply_sql(root):
    """One PostgreSQL transaction, including history and pre-commit assertions.

    Account locks are attempted in canonical order before table locks. Nothing
    waits while holding a table lock for a player's advisory lock. NOWAIT table
    locks also avoid lock-upgrade deadlocks with old commands/geometry readers.
    A busy database simply rolls this operation back for a later quiet window.
    """
    verify_migrations(root)
    expected_functions = {name: {"exists": True, "service": service, "player": False,
                                 "anon": False, "public": False}
                          for name, service in NEW_FUNCTIONS.items()}
    sql = """
set local statement_timeout = '45s';
set local lock_timeout = '5s';
set local transaction_timeout = '60s';
do $release_lock$
declare v_user uuid;
begin
  for v_user in select distinct c.user_id from public.characters c
    join app_private.character_world_state w on w.character_id=c.id
    order by c.user_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(v_user::text,1)) then
      raise exception 'RELEASE_ACCOUNT_BUSY' using errcode='55P03';
    end if;
  end loop;
end;
$release_lock$;
lock table app_private.character_world_state in access exclusive mode nowait;
lock table app_private.master_teleport_geometry in access exclusive mode nowait;
lock table supabase_migrations.schema_migrations in access exclusive mode nowait;
-- Close the new-world-row race between the first account scan and table lock.
-- Under the exclusive world lock the account set cannot grow. Never wait for
-- an omitted busy account while holding the table lock: fail and roll back.
do $release_recheck$
declare v_user uuid;
begin
  for v_user in select distinct c.user_id from public.characters c
    join app_private.character_world_state w on w.character_id=c.id
    order by c.user_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(v_user::text,1)) then
      raise exception 'RELEASE_ACCOUNT_BUSY' using errcode='55P03';
    end if;
  end loop;
end;
$release_recheck$;
"""
    sql += "create temporary table aurevane_release_before (snapshot) on commit drop as " + state_sql() + ";\n"
    sql += f"""
do $release_before$
declare b jsonb;
begin
  select snapshot into b from aurevane_release_before;
  if jsonb_array_length(b->'ledger') <> {BASELINE_COUNT}
    or b->>'baseline_digest' <> {sql_literal(BASELINE_DIGEST)}
    or b->'ledger'->{BASELINE_COUNT - 1} <> '["20261112183130","town_and_continent_teleport_geometry"]'::jsonb
    or exists(select 1 from jsonb_each(b->'functions') f where (f.value->>'exists')::boolean)
    or b->'cron' <> '[]'::jsonb or (b->>'trigger')::boolean
  then raise exception 'RELEASE_BASELINE_CHANGED'; end if;
end;
$release_before$;
"""
    for name in MIGRATIONS:
        original = (root / "supabase/migrations" / name).read_text()
        source = original.strip()
        if not source.startswith("begin;") or not source.endswith("commit;"):
            raise SystemExit("A reviewed migration no longer has its expected transaction boundary.")
        sql += source[len("begin;"):-len("commit;")].strip() + "\n"
        # Preserve the exact source as the new entry's statement array. Existing
        # hosted statements are never repaired, replaced, deleted or replayed.
        sql += "insert into supabase_migrations.schema_migrations(version,name,statements) values ("
        sql += ",".join([sql_literal(name[:14]), sql_literal(name[15:-4]),
                         "array[" + sql_literal(original) + "]::text[]"]) + ");\n"
    sql += "create temporary table aurevane_release_after (snapshot) on commit drop as " + state_sql(after=True) + ";\n"
    fields = ("baseline_digest", "geometry", "world", "legacy_functions", "preserved_acl", "other_cron")
    comparisons = "\n    or ".join(f"a->{sql_literal(key)} is distinct from b->{sql_literal(key)}" for key in fields)
    sql += f"""
do $release_after$
declare a jsonb; b jsonb;
begin
  select snapshot into b from aurevane_release_before;
  select snapshot into a from aurevane_release_after;
  if a->'ledger' is distinct from (b->'ledger' || {sql_literal(json.dumps(migration_rows()))}::jsonb)
    or {comparisons}
    or a->'functions' is distinct from {sql_literal(json.dumps(expected_functions))}::jsonb
    or a->'new_sources' is distinct from {sql_literal(json.dumps({name[:14]: digest for name, digest in MIGRATIONS.items()}))}::jsonb
    or not (a->>'trigger')::boolean or not (a->>'backfill_valid')::boolean
    or a->'cron' <> '[]'::jsonb
  then raise exception 'PRESERVATION_POSTFLIGHT'; end if;
end;
$release_after$;
select jsonb_build_object('migrations',4,'prior_entries',{BASELINE_COUNT},'cron_enabled',false,'preservation','verified_before_commit');
"""
    return sql


def apply_sql_file(connection, sql_file):
    # --single-transaction plus ON_ERROR_STOP makes any migration/assertion/
    # lock error roll back all four migrations and their four history rows.
    run(["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "--single-transaction",
         "--file", str(sql_file)], "Atomic PR1040 migration and preservation transaction",
        env={**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port),
             "PGDATABASE": "postgres", "PGUSER": connection.username,
             "PGPASSWORD": unquote(connection.password),
             "PGSSLMODE": connection.query.removeprefix("sslmode="), "PGCONNECT_TIMEOUT": "15",
             "PGOPTIONS": "-c statement_timeout=45000 -c lock_timeout=5000 -c transaction_timeout=60000"},
        timeout=75)


def main(*, force_dry_run=False):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cli", help="Pinned Supabase CLI path (2.114.0)")
    parser.add_argument("--expected-source", required=True, help="Exact reviewed checkout SHA")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--activate-cron", action="store_true")
    parser.add_argument("--deployment-ready-sha", default="", help="Operator-verified READY production SHA; cron activation only")
    args = parser.parse_args()
    if force_dry_run and (args.apply or args.activate_cron):
        raise SystemExit("The planning entry point is read-only.")
    if not shutil.which("psql"):
        raise SystemExit("Install the PostgreSQL client (psql) before planning or applying this release.")
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_source):
        raise SystemExit("Supply the full reviewed candidate SHA.")
    if run(["git", "rev-parse", "HEAD"], "Source identity").strip() != args.expected_source:
        raise SystemExit("The checkout differs from the requested source.")
    run(["git", "diff", "--exit-code", "HEAD", "--", "."], "Clean tracked-source check")
    root = Path.cwd()
    verify_migrations(root)
    if run([args.cli, "--version"], "Pinned CLI version").strip() != "2.114.0":
        raise SystemExit("Use the reviewed Supabase CLI 2.114.0.")
    connection_uri = production_url(os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    connection = urlsplit(connection_uri)
    before = read_state(connection, after=args.activate_cron)
    verify_baseline(before, installed=args.activate_cron)
    if args.activate_cron:
        verify_activation_source(args.expected_source, args.deployment_ready_sha)
        expected_cron = [{"schedule": "* * * * *", "command": CRON_COMMAND,
                          "active": True, "username": "postgres", "database": "postgres"}]
        if before["cron"] not in ([], expected_cron):
            raise SystemExit("The cron job differs from the intended bounded return worker.")
        if not before["cron"]:
            query(connection, "select to_jsonb(app_private.configure_world_void_return_cron_v1(true))", readonly=False)
        after = read_state(connection, after=True)
        # The activated worker may legitimately relocate a due private player
        # before this read. It never changes catalogue, ledger, geometry or ACLs.
        if after["cron"] != expected_cron or any(after[key] != before[key] for key in before if key not in ("cron", "world", "backfill_valid")):
            raise SystemExit("Cron activation postflight failed; inspect production before proceeding.")
        print("Verified one minute cron, batch 250; migration, geometry, ACL and legacy RPC snapshots preserved.")
        return
    if before["cron"]:
        raise SystemExit("Return cron is already active before the migration window; inspect production.")
    with tempfile.TemporaryDirectory() as directory:
        workdir = Path(directory)
        stage_migrations(root, workdir, before["ledger"])
        push = [args.cli, "db", "push", "--workdir", str(workdir), "--db-url", connection_uri, "--include-all"]
        verify_plan(run([*push, "--dry-run"], "Exact four-migration production dry run"))
        planned_state = read_state(connection)
        for key in ("ledger", "baseline_digest", "legacy_functions", "preserved_acl", "functions", "trigger", "cron", "other_cron"):
            if planned_state[key] != before[key]:
                raise SystemExit("Production schema/history changed during planning; inspect before applying.")
        print(f"Verified {BASELINE_COUNT} installed entries and exactly four ordered additions.", flush=True)
        for name in MIGRATIONS:
            print(name, flush=True)
        if not args.apply:
            print("Read-only plan complete; no migrations applied and cron remains disabled.")
            return
    with tempfile.TemporaryDirectory() as directory:
        sql_file = Path(directory) / "reviewed-pr1040.sql"
        sql_file.write_text(atomic_apply_sql(root))
        apply_sql_file(connection, sql_file)
    print("Four migrations committed atomically; prior ledger, geometry, RPCs, ACLs and saved progress preserved. Cron remains disabled.")


if __name__ == "__main__":
    main()
