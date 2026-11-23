"""Plan or atomically apply the two reviewed PR1044 migrations."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
from runpy import run_path
import shutil
import tempfile
from urllib.parse import unquote, urlsplit

PR1040 = run_path(str(Path(__file__).with_name("apply-aurevane-world-map-geometry.py")))
BASELINE_VERSION = "20261114114000"
BASELINE_COUNT = 263
BASELINE_DIGEST = "0ed8ed8e65bd4cff3a1c75bd675d749dba3f8dfaedfdcd0bfeefb68f73eb905f"
MIGRATIONS = {
    "20261118170000_world_ferry_active_uncharted.sql": "11a0561b8d5ff36d111959433300b43c283ac9e5850a639883e341fb6dbf3422",
    "20261118171500_offshore_and_water_teleport_geometry.sql": "e8619fbd04071a9fcd5453cffbc57cd1cc67125a7ad78cc168a4a40958588451",
}
TELEPORT_ARGS = PR1040["TELEPORT_ARGS"]
V5_FUNCTION = f"public.teleport_master_player_v5({TELEPORT_ARGS})"
NEW_FUNCTIONS = {
    V5_FUNCTION: True,
    "app_private.world_void_ferry_dock_v1(text)": False,
    "app_private.world_void_ferry_fallback_v1()": False,
}
PRESERVED_FUNCTIONS = [
    *(f"public.teleport_master_player_v{v}({TELEPORT_ARGS})" for v in range(1, 5)),
    "public.read_world_state_v1(uuid,uuid,jsonb)",
    "public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)",
]
ALTERED_FUNCTIONS = [
    "app_private.world_void_mark_state_v1()",
    "app_private.settle_world_ferry_v1(uuid,uuid)",
    "public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)",
    "public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)",
]
quote = PR1040["sql_literal"]
run = PR1040["run"]
fingerprint = PR1040["fingerprint"]


def migration_rows():
    return [[name[:14], name[15:-4]] for name in MIGRATIONS]


def read_sources(root):
    result = {}
    for name, digest in MIGRATIONS.items():
        data = (root / "supabase/migrations" / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise SystemExit(f"The reviewed source hash changed for {name}.")
        source = data.decode("utf-8")
        if not source.strip().startswith("begin;") or not source.strip().endswith("commit;"):
            raise SystemExit(f"Expected transaction boundaries are missing from {name}.")
        result[name] = source
    return result


def json_literal(value):
    return quote(json.dumps(value, separators=(",", ":"))) + "::jsonb"


def state_sql(*, include_player_state=False, installed=False):
    managed = ",".join(map(quote, NEW_FUNCTIONS))
    acl = ",".join(map(quote, ALTERED_FUNCTIONS + PRESERVED_FUNCTIONS))
    preserved = ",".join(map(quote, PRESERVED_FUNCTIONS))
    state_fields = ""
    if include_player_state:
        for key, table, sort, ignored in (
            ("world", "character_world_state", "character_id", ""),
            ("geometry", "master_teleport_geometry", "geometry_version,realm_id,sector_number", ""),
            ("ferry_trips", "world_ferry_trips", "direction,departure_at", "-'active_void'"),
            ("ferry_receipts", "world_ferry_receipts", "character_id,command_id", ""),
        ):
            digest = fingerprint(f"(select jsonb_agg(to_jsonb(r){ignored} order by {sort}) from app_private.{table} r)")
            state_fields += f",'{key}',{digest}\n"
    existing_modes = (
        "(select count(*) from app_private.world_ferry_trips where active_void is distinct from false)"
        if include_player_state and installed else "0"
    )
    return f"""
select jsonb_build_object(
 'ledger',(select jsonb_agg(jsonb_build_array(version,name) order by version) from supabase_migrations.schema_migrations),
 'baseline_digest',(select encode(sha256(convert_to(string_agg(jsonb_build_array(version,name,statements)::text,E'\\n' order by version),'UTF8')),'hex') from supabase_migrations.schema_migrations where version <= '{BASELINE_VERSION}'),
 'sources',(select coalesce(jsonb_object_agg(version,case when array_length(statements,1)=1 then encode(sha256(convert_to(statements[1],'UTF8')),'hex') else 'UNEXPECTED_STATEMENT_ARRAY' end),'{{}}') from supabase_migrations.schema_migrations where version > '{BASELINE_VERSION}'),
 'legacy',(select jsonb_object_agg(s,{fingerprint('pg_get_functiondef(to_regprocedure(s))')}) from unnest(array[{preserved}]) s),
 'acl',(select jsonb_object_agg(s,(select jsonb_build_object('owner',proowner,'acl',proacl,'definer',prosecdef,'config',proconfig) from pg_proc where oid=to_regprocedure(s))) from unnest(array[{acl}]) s),
 'cron',{fingerprint('(select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j)')},
 'trigger',exists(select 1 from pg_trigger where tgname='world_void_mark_state_v1' and tgrelid='app_private.character_world_state'::regclass and tgenabled='O' and not tgisinternal),
 'active_void_column',exists(select 1 from information_schema.columns where table_schema='app_private' and table_name='world_ferry_trips' and column_name='active_void' and data_type='boolean' and is_nullable='NO' and column_default='false'),
 'unpreserved_trips',{existing_modes},
 'functions',(select jsonb_object_agg(s,case when to_regprocedure(s) is null then null else jsonb_build_object(
   'service',has_function_privilege('service_role',to_regprocedure(s),'EXECUTE'),
   'player',has_function_privilege('authenticated',to_regprocedure(s),'EXECUTE'),
   'anon',has_function_privilege('anon',to_regprocedure(s),'EXECUTE'),
   'public',exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure(s) and a.grantee=0 and a.privilege_type='EXECUTE')
 ) end) from unnest(array[{managed}]) s)
 {state_fields}
)
"""


def new_acl():
    return {
        name: {"service": service, "player": False, "anon": False, "public": False}
        for name, service in NEW_FUNCTIONS.items()
    }


def source_hashes():
    return {name[:14]: digest for name, digest in MIGRATIONS.items()}


def verify_ledger(state, *, installed):
    prior_count = BASELINE_COUNT
    expected_count = prior_count + (len(MIGRATIONS) if installed else 0)
    ledger = state["ledger"]
    if (len(ledger) != expected_count or ledger[prior_count - 1][0] != BASELINE_VERSION
            or state["baseline_digest"] != BASELINE_DIGEST
            or len({row[0] for row in ledger}) != expected_count
            or ledger[prior_count:] != (migration_rows() if installed else [])):
        raise SystemExit("The Production ledger differs from the verified baseline or entire PR1044 batch.")
    if (state["sources"] != (source_hashes() if installed else {})
            or state["functions"] != (new_acl() if installed else dict.fromkeys(NEW_FUNCTIONS))
            or state["active_void_column"] != installed or not state["trigger"]
            or not all(state["acl"].values())):
        raise SystemExit("The Production schema and ledger do not agree with the intended PR1044 state.")


def atomic_apply_sql(sources, *, baseline_count, baseline_digest):
    # Same account-before-table ordering as the established World release.
    # NOWAIT also protects against an active boarding/settlement or geometry write.
    account_locks = """
do $release_accounts$
declare player uuid;
begin
  for player in select distinct c.user_id from public.characters c
    join app_private.character_world_state w on w.character_id=c.id
    order by c.user_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(player::text,1)) then
      raise exception 'RELEASE_ACCOUNT_BUSY' using errcode='55P03';
    end if;
  end loop;
end;
$release_accounts$;
"""
    sql = """
set local statement_timeout = '45s';
set local lock_timeout = '5s';
set local transaction_timeout = '60s';
"""
    sql += account_locks + """
lock table app_private.character_world_state in access exclusive mode nowait;
lock table app_private.world_ferry_trips in access exclusive mode nowait;
lock table app_private.world_ferry_receipts in access exclusive mode nowait;
lock table app_private.master_teleport_geometry in access exclusive mode nowait;
lock table supabase_migrations.schema_migrations in access exclusive mode nowait;
""" + account_locks
    sql += "create temporary table aurevane_release_before (snapshot) on commit drop as " + state_sql(include_player_state=True) + ";\n"
    sql += f"""
do $release_before$
declare b jsonb;
begin
  select snapshot into b from aurevane_release_before;
  if jsonb_array_length(b->'ledger') <> {baseline_count}
    or b->>'baseline_digest' <> {quote(baseline_digest)}
    or b->'ledger'->{baseline_count - 1}->>0 <> '{BASELINE_VERSION}'
    or b->'sources' <> '{{}}'::jsonb or (b->>'active_void_column')::boolean
    or b->'functions' <> {json_literal(dict.fromkeys(NEW_FUNCTIONS))}
    or exists(select 1 from jsonb_each(b->'acl') f where f.value = 'null'::jsonb)
    or not (b->>'trigger')::boolean
  then raise exception 'RELEASE_BASELINE_CHANGED'; end if;
end;
$release_before$;
"""
    for name, original in sources.items():
        sql += original.strip()[len("begin;"):-len("commit;")].strip() + "\n"
        row = ",".join(map(quote, (name[:14], name[15:-4])))
        sql += f"insert into supabase_migrations.schema_migrations(version,name,statements) values ({row},array[{quote(original)}]::text[]);\n"
    sql += "create temporary table aurevane_release_after (snapshot) on commit drop as " + state_sql(include_player_state=True, installed=True) + ";\n"
    sql += f"""
do $release_after$
declare a jsonb; b jsonb;
begin
  select snapshot into a from aurevane_release_after;
  select snapshot into b from aurevane_release_before;
  if a->'ledger' is distinct from (b->'ledger' || {json_literal(migration_rows())})
    or a->'sources' is distinct from {json_literal(source_hashes())}
    or a->'functions' is distinct from {json_literal(new_acl())}
    or not (a->>'active_void_column')::boolean or a->>'unpreserved_trips' <> '0'
    or (a - array['ledger','sources','functions','active_void_column'])
       is distinct from (b - array['ledger','sources','functions','active_void_column'])
  then raise exception 'PRESERVATION_POSTFLIGHT'; end if;
end;
$release_after$;
"""
    return sql


def verify_plan(root, cli, uri, ledger):
    with tempfile.TemporaryDirectory() as directory:
        workdir = Path(directory)
        staged = workdir / "supabase/migrations"
        staged.mkdir(parents=True)
        for config in ("supabase/config.toml", "supabase/templates/recovery.html"):
            target = workdir / config
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / config, target)
        for version, name in ledger:
            if not re.fullmatch(r"\d{14}", version) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                raise SystemExit("Unexpected installed migration identifier.")
            (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
        for name in MIGRATIONS:
            shutil.copyfile(root / "supabase/migrations" / name, staged / name)
        command = [cli, "db", "push", "--workdir", directory, "--db-url", uri, "--include-all", "--dry-run"]
        output = run(command, "PR1044 Production migration dry run")
        if re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", output) != list(MIGRATIONS):
            raise SystemExit("The dry run did not select exactly the two PR1044 migrations in order.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cli")
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--staged-source")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_source):
        raise SystemExit("Supply the full reviewed source SHA.")
    if args.apply and args.staged_source != args.expected_source:
        raise SystemExit("Apply requires the operator-verified READY staged Production source.")
    if run(["git", "rev-parse", "HEAD"], "Source identity").strip() != args.expected_source:
        raise SystemExit("The checkout differs from the reviewed source.")
    run(["git", "diff", "--exit-code", "HEAD", "--", "."], "Clean tracked-source check")
    if run([args.cli, "--version"], "Pinned CLI version").strip() != "2.114.0":
        raise SystemExit("Use the reviewed Supabase CLI 2.114.0.")
    root = Path.cwd()
    sources = read_sources(root)
    uri = PR1040["production_url"](os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    connection = urlsplit(uri)
    before = PR1040["query"](connection, state_sql() + ";")
    installed = len(before["ledger"]) == BASELINE_COUNT + len(MIGRATIONS)
    verify_ledger(before, installed=installed)
    if installed:
        print("PR1044 is already fully installed. No migration replay.")
        return
    verify_plan(root, args.cli, uri, before["ledger"])
    if before != PR1040["query"](connection, state_sql() + ";"):
        raise SystemExit("Production history, schema, or cron changed during planning.")
    for name, digest in MIGRATIONS.items():
        print(f"{name} {digest}", flush=True)
    if not args.apply:
        print("Read-only PR1044 migration plan verified.")
        return

    with tempfile.TemporaryDirectory() as directory:
        filename = Path(directory) / "pr1044.sql"
        filename.write_text(atomic_apply_sql(sources, baseline_count=BASELINE_COUNT, baseline_digest=BASELINE_DIGEST))
        run(["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file", str(filename)],
            "Atomic PR1044 migration and preservation transaction",
            env={**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port),
                 "PGDATABASE": "postgres", "PGUSER": connection.username,
                 "PGPASSWORD": unquote(connection.password), "PGCONNECT_TIMEOUT": "15",
                 "PGSSLMODE": connection.query.removeprefix("sslmode=")}, timeout=75)
    after = PR1040["query"](connection, state_sql() + ";")
    verify_ledger(after, installed=True)
    if any(after[key] != before[key] for key in ("baseline_digest", "legacy", "acl", "cron", "trigger")):
        raise SystemExit("Post-commit schema preservation changed. Inspect the database before promotion.")
    print("Exactly two PR1044 migrations recorded. Existing ledger entries, saved World state, ferry passages, geometry, privileges and cron were preserved.")


if __name__ == "__main__":
    main()
