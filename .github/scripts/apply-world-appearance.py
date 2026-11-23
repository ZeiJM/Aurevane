"""Plan or apply the reviewed World and character appearance migration batch."""

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

BASE_SOURCE = "834b011a8e8788064b47f892427bd364d524cbe8"
BASE_VERSION = "20261120101000"
BASE_COUNT = 277
BASE_DIGEST = "d8a49ea6d90356aad945f601e8393f64a89c1ec8ad2bf04677c58e6b05b60841"
MIGRATIONS = {
    "20261123010000_reindex_master_teleport_geometry.sql": "1dc2facac839b466c95fdc2139ce6165c46ac618d99a726da317a77007b2cd62",
    "20261123011000_asterwake_ferry.sql": "90157ad8bf8a572226db9bfe9cb86658e18cb1ec3bab499b04189ac7b610c4e5",
    "20261123011735_appearance_token_launch.sql": "75e906cc6d259d8ad62d85e5e583b86316fdb08e66f759711e6ebb8e6cbf2129",
    "20261123011738_starter_titles_and_token_appearance.sql": "7cfe5c8de82b0a001a6c6a46d348361e9473d1ca27fd520d70a7c74267a48c88",
    "20261123011739_painted_player_looks.sql": "c103ca643b196e06b1f9e09ca0a6ecb3bb02b32e961f8094020ab53ed5eaa7fe",
}
NEW_FUNCTIONS = {
    "public.teleport_master_player_v6(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)": True,
    "public.read_character_appearance_tokens_v1(uuid,uuid)": True,
    "public.commit_character_appearance_v4(uuid,uuid,integer,text)": True,
    "app_private.valid_painted_player_look_url_v1(text)": False,
}
PRESERVED_TABLES = {
    "public.characters": ["personal_title", "personal_title_key", "personal_title_set_at"],
    "public.character_profile_display": ["image_url"],
    "app_private.character_item_grants": [],
    "app_private.character_item_stacks": [],
    "app_private.character_world_state": [],
    "app_private.world_ferry_trips": [],
    "app_private.world_ferry_receipts": [],
    "app_private.master_teleport_geometry": [],
    "cron.job": [],
}
EXPECTED_ROWS = [[name[:14], name[15:-4]] for name in MIGRATIONS]
EXPECTED_HASHES = {name[:14]: digest for name, digest in MIGRATIONS.items()}


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(value):
    return sql_text(json.dumps(value, separators=(",", ":"))) + "::jsonb"


def read_sources(root):
    sources = {}
    for name, expected in MIGRATIONS.items():
        source = (root / "supabase/migrations" / name).read_bytes()
        if hashlib.sha256(source).hexdigest() != expected:
            raise SystemExit(f"Source hash differs for {name}.")
        content = source.decode()
        if not re.fullmatch(r"begin;.+commit;\s*", content, re.DOTALL):
            raise SystemExit(f"Unexpected transaction boundaries in {name}.")
        sources[name] = content
    return sources


def state_sql(*, preserve=False):
    signatures = ",".join(map(sql_text, NEW_FUNCTIONS))
    fingerprints = []
    if preserve:
        for table, exclusions in PRESERVED_TABLES.items():
            row = "to_jsonb(t)"
            if exclusions:
                row += " - array[" + ",".join(map(sql_text, exclusions)) + "]"
            aggregate = f"(select jsonb_agg({row} order by ({row})::text) from {table} t)"
            fingerprints.append(f"{sql_text(table)},md5(coalesce({aggregate}::text,'null'))")
    preserved = ", 'preserved',jsonb_build_object(" + ",".join(fingerprints) + ")" if preserve else ""
    return f"""
select jsonb_build_object(
  'ledger',(select jsonb_agg(jsonb_build_array(version,name) order by version) from supabase_migrations.schema_migrations),
  'baseline_digest',(select encode(sha256(convert_to(string_agg(jsonb_build_array(version,name,statements)::text,E'\\n' order by version),'UTF8')),'hex') from supabase_migrations.schema_migrations where version <= '{BASE_VERSION}'),
  'sources',(select coalesce(jsonb_object_agg(version,case when array_length(statements,1)=1 then encode(sha256(convert_to(statements[1],'UTF8')),'hex') else 'UNEXPECTED_STATEMENT_ARRAY' end),'{{}}') from supabase_migrations.schema_migrations where version > '{BASE_VERSION}'),
  'functions',(select jsonb_object_agg(sig,case when to_regprocedure(sig) is null then null else jsonb_build_object(
    'service',has_function_privilege('service_role',to_regprocedure(sig),'EXECUTE'),
    'player',has_function_privilege('authenticated',to_regprocedure(sig),'EXECUTE'),
    'anon',has_function_privilege('anon',to_regprocedure(sig),'EXECUTE'),
    'public',exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=to_regprocedure(sig) and a.grantee=0 and a.privilege_type='EXECUTE')
  ) end) from unnest(array[{signatures}]) sig)
  {preserved}
)"""


def expected_acl(installed):
    if not installed:
        return dict.fromkeys(NEW_FUNCTIONS)
    return {sig: {"service": enabled, "player": False, "anon": False, "public": False}
            for sig, enabled in NEW_FUNCTIONS.items()}


def verify_ledger(state, *, installed):
    ledger = state["ledger"]
    tail = EXPECTED_ROWS if installed else []
    if (len(ledger) != BASE_COUNT + len(tail)
            or ledger[BASE_COUNT - 1][0] != BASE_VERSION
            or state["baseline_digest"] != BASE_DIGEST
            or ledger[BASE_COUNT:] != tail
            or state["sources"] != (EXPECTED_HASHES if installed else {})
            or state["functions"] != expected_acl(installed)):
        raise SystemExit("Production history or permissions differ from the reviewed rollout state.")


def atomic_sql(sources, baseline_count=BASE_COUNT, baseline_version=BASE_VERSION,
               baseline_digest=BASE_DIGEST):
    sql = """
set transaction isolation level repeatable read;
set local statement_timeout = '45s';
set local lock_timeout = '5s';
set local transaction_timeout = '60s';
lock table public.characters, public.character_profile_display,
  app_private.world_ferry_trips, app_private.master_teleport_geometry,
  supabase_migrations.schema_migrations in access exclusive mode nowait;
"""
    sql += "create temp table rollout_before (snapshot) on commit drop as " + state_sql(preserve=True) + ";\n"
    sql += f"""
do $preflight$
declare b jsonb;
begin
  select snapshot into strict b from rollout_before;
  if jsonb_array_length(b->'ledger') <> {baseline_count}
    or b->'ledger'->{baseline_count - 1}->>0 <> {sql_text(baseline_version)}
    or b->>'baseline_digest' <> {sql_text(baseline_digest)}
    or b->'sources' <> '{{}}'::jsonb
    or b->'functions' <> {json_sql(expected_acl(False))}
    or exists (
      select 1 from public.characters c
      where c.created_at <= timestamptz '2026-11-23 01:21:54.587976+00'
        and not exists (
          select 1 from app_private.character_item_grants g
          where g.character_id = c.id and g.grant_key = 'appearance-token-launch'
        )
    )
  then raise exception 'WORLD_APPEARANCE_BASELINE_CHANGED'; end if;
end;
$preflight$;
"""
    for name, original in sources.items():
        sql += original.strip()[len("begin;"):-len("commit;")] + "\n"
        row = ",".join(map(sql_text, (name[:14], name[15:-4])))
        sql += f"insert into supabase_migrations.schema_migrations(version,name,statements) values ({row},array[{sql_text(original)}]::text[]);\n"
    sql += "create temp table rollout_after (snapshot) on commit drop as " + state_sql(preserve=True) + ";\n"
    sql += f"""
do $postflight$
declare a jsonb; b jsonb;
begin
  select snapshot into strict a from rollout_after;
  select snapshot into strict b from rollout_before;
  if a->'ledger' is distinct from (b->'ledger' || {json_sql(EXPECTED_ROWS)})
    or a->'baseline_digest' is distinct from b->'baseline_digest'
    or a->'sources' is distinct from {json_sql(EXPECTED_HASHES)}
    or a->'functions' is distinct from {json_sql(expected_acl(True))}
    or a->'preserved' is distinct from b->'preserved'
    or exists (
      select 1 from public.characters
      where personal_title is not null or personal_title_key is not null or personal_title_set_at is not null
    )
    or exists (select 1 from public.character_profile_display where image_url is not null)
  then raise exception 'WORLD_APPEARANCE_PRESERVATION'; end if;
end;
$postflight$;
"""
    return sql



def verify_plan(root, cli, uri, ledger, run):
    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        staged = workdir / "supabase/migrations"
        staged.mkdir(parents=True)
        for config in ("supabase/config.toml", "supabase/templates/recovery.html"):
            destination = workdir / config
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / config, destination)
        for version, name in ledger:
            if not re.fullmatch(r"\d{14}", version) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                raise SystemExit("Unexpected installed migration identifier.")
            (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
        for name in MIGRATIONS:
            shutil.copyfile(root / "supabase/migrations" / name, staged / name)
        output = run([cli, "db", "push", "--workdir", tmp, "--db-url", uri,
                      "--include-all", "--dry-run"], "World and appearance ordered dry run")
        if re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", output) != list(MIGRATIONS):
            raise SystemExit("The CLI did not select the five reviewed migrations in order.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cli")
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--staged-source")
    parser.add_argument("--staged-deployment")
    args = parser.parse_args()
    root = Path.cwd()
    helpers = run_path(str(root / ".github/scripts/apply-aurevane-world-map-geometry.py"))
    run = helpers["run"]

    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_source):
        raise SystemExit("Supply the exact verified source SHA.")
    if args.apply and (args.staged_source != args.expected_source
                       or not re.fullmatch(r"dpl_[A-Za-z0-9]+", args.staged_deployment or "")):
        raise SystemExit("Apply requires the verified staged Production source and deployment.")
    if run(["git", "rev-parse", "HEAD"], "Source identity").strip() != args.expected_source:
        raise SystemExit("Current checkout differs from the verified source.")
    run(["git", "diff", "--exit-code", "HEAD", "--", "."], "Clean tracked-source check")
    delta = run(["git", "diff", "--name-status", BASE_SOURCE, "HEAD", "--", "supabase/migrations"],
                "Candidate migration inventory").splitlines()
    if delta != [f"A\tsupabase/migrations/{name}" for name in MIGRATIONS]:
        raise SystemExit("Candidate changes migrations outside the reviewed inventory.")
    if run([args.cli, "--version"], "Pinned CLI version").strip() != "2.114.0":
        raise SystemExit("Use Supabase CLI 2.114.0.")
    sources = read_sources(root)
    uri = helpers["production_url"](os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    connection = urlsplit(uri)
    query = helpers["query"]
    before = query(connection, state_sql() + ";")
    installed = len(before["ledger"]) == BASE_COUNT + len(sources)
    verify_ledger(before, installed=installed)
    if installed:
        print("The reviewed batch is already installed and all hashes match.")
        return
    verify_plan(root, args.cli, uri, before["ledger"], run)
    if query(connection, state_sql() + ";") != before:
        raise SystemExit("Production history or permissions changed during planning.")
    for name, digest in MIGRATIONS.items():
        print(f"{name} {digest}")
    if not args.apply:
        print("Read-only plan verified the five reviewed migrations.")
        return
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "world-appearance.sql"
        path.write_text(atomic_sql(sources))
        run(["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file", str(path)],
            "Atomic World and appearance migration batch",
            env={**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port),
                 "PGDATABASE": "postgres", "PGUSER": connection.username,
                 "PGPASSWORD": unquote(connection.password), "PGCONNECT_TIMEOUT": "15",
                 "PGSSLMODE": connection.query.removeprefix("sslmode=")}, timeout=75)
    verify_ledger(query(connection, state_sql() + ";"), installed=True)
    print("Recorded the five reviewed migrations with preserved World, appearance, ferry and inventory state.")


if __name__ == "__main__":
    main()
