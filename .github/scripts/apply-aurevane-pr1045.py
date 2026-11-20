"""Plan or atomically apply the twelve reviewed PR #1045 and #1046 migrations."""

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

helpers = run_path(str(Path(__file__).with_name("apply-aurevane-world-map-geometry.py")))
quote = helpers["sql_literal"]
run = helpers["run"]
fingerprint = helpers["fingerprint"]
BASE_SOURCE = "ef46423c5e4c88566f4970607943efc12157eead"
BASE_VERSION = "20261118171500"
BASE_COUNT = 265
BASE_DIGEST = "6ef5c979eb1c265f19052c9f42ee4c3aa7048584adbc8150a107811e4349b255"
MIGRATIONS = {
    "20261119090000_character_sprite_design_allowance.sql": "f41b4fe795327a932e46eb5f7f177d81516de702df3d037cb5b33a3ece443342",
    "20261119100000_restoration_dialogue_replies.sql": "27e9b563bfd75b42fed1883f8f72553dbf49937d83d8b966563139b9f2f1464c",
    "20261119101500_mainland_ferry_terminal.sql": "3bcd85abe97f5fce20c3eeff237ae0150e1928790b3afce762096999e1d9e77e",
    "20261119113000_npc_greeting_expression.sql": "2868556e738ace69c72ba8f3680856571d0ec1b9d01c30c0409f83ae2fd19d5d",
    "20261119114000_uncharted_coastal_ferry_terminals.sql": "6803b2235aeb8ac93c325c101cc304f82d5d61388091f1e80875ac23669599e9",
    "20261119115000_npc_dialogue_branches.sql": "78fd6eb1eba2d656fe1153e99fe5faf04879480f64bd80e989eda6950e208f51",
    "20261119120000_painted_scout_appearance.sql": "6758b1fa5161ba5b4a1b403e6c61047304b9b3f409b281b7a22f2522e8dcd6c6",
    "20261119121000_event_objective_quorum.sql": "056e438547ba810b0457877f6bd4e28f1ca9e2b0f00b99b14f3ba34a7099ff8e",
    "20261119122000_event_objective_branches.sql": "7f99961174955b01a52bbf5722c00f51200a90c87ce800e46bbca8118c205e54",
    "20261119123000_world_event_battle_results.sql": "192861b4cf8e4bacd69e9bf940d8bd861d4e045d46a507c00cf1b7c790f59837",
    "20261120100000_event_objective_deadlines.sql": "2c98abab0bbac699158257a55f5a0b3e3c882397d83049101e90f154b1a5f424",
    "20261120101000_expanded_painted_wardrobe.sql": "fe425c73e60f9322a1e1087143592bb8d475e3266fd91575da799536be879724",
}
NEW_FUNCTIONS = {
    "public.commit_character_appearance_v3(uuid,uuid,integer,text)": True,
    "app_private.valid_npc_dialogue_replies_v1(jsonb,boolean)": False,
    "app_private.valid_painted_appearance_url_v1(text)": False,
    "app_private.skip_event_phases_v1(uuid,integer,integer,timestamptz)": False,
    "app_private.pinned_world_event_battle_result_v1(jsonb,jsonb)": False,
    "app_private.capture_event_battle_result_v1()": False,
    "app_private.record_event_battle_results_v1(app_private.event_runs,app_private.event_run_phases,timestamptz)": False,
    "app_private.event_quorum_deadline_v1(jsonb,timestamptz)": False,
    "app_private.valid_painted_wardrobe_url_v1(text)": False,
}
PRESERVED_TABLES = {
    "public.characters": None,
    "public.character_profile_display": "confirmed_sprite_designs",
    "app_private.character_world_state": None,
    "app_private.world_ferry_trips": None,
    "app_private.world_ferry_receipts": None,
    "app_private.npc_designs": None,
    "app_private.world_npc_battles": None,
    "app_private.event_definition_versions": None,
    "app_private.event_definition_drafts": None,
    "app_private.event_runs": None,
    "app_private.event_run_phases": None,
    "app_private.event_run_objectives": "battle_result",
    "cron.job": None,
}


def json_sql(value):
    return quote(json.dumps(value, separators=(",", ":"))) + "::jsonb"


def expected_rows():
    return [[name[:14], name[15:-4]] for name in MIGRATIONS]


def expected_hashes():
    return {name[:14]: digest for name, digest in MIGRATIONS.items()}


def verify_candidate_delta():
    delta = run(["git", "diff", "--name-status", BASE_SOURCE, "HEAD", "--", "supabase/migrations"],
                "Candidate migration inventory").splitlines()
    if delta != [f"A\tsupabase/migrations/{name}" for name in MIGRATIONS]:
        raise SystemExit("The candidate changes migrations outside the reviewed combined inventory.")


def read_sources(root):
    sources = {}
    for name, digest in MIGRATIONS.items():
        data = (root / "supabase/migrations" / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise SystemExit(f"The reviewed source hash changed for {name}.")
        original = data.decode("utf-8")
        if not re.fullmatch(r"begin;.+commit;\s*", original, re.DOTALL):
            raise SystemExit(f"Unexpected transaction boundaries in {name}.")
        sources[name] = original
    return sources


def state_sql(*, preserve=False):
    managed_signatures = ",".join(map(quote, NEW_FUNCTIONS))
    preserved = []
    if preserve:
        for table, column in PRESERVED_TABLES.items():
            row = "to_jsonb(t)" + (f"-{quote(column)}" if column else "")
            digest = fingerprint(f"(select jsonb_agg({row} order by ({row})::text) from {table} t)")
            preserved.append(f"{quote(table)},{digest}")
    preservation = ", 'preserved',jsonb_build_object(" + ",".join(preserved) + ")" if preserve else ""
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
  ) end) from unnest(array[{managed_signatures}]) sig),
  'cron',{fingerprint('(select jsonb_agg(to_jsonb(j) order by jobid) from cron.job j)')}
  {preservation}
)"""


def expected_acl():
    return {sig: {"service": service, "player": False, "anon": False, "public": False}
            for sig, service in NEW_FUNCTIONS.items()}


def verify_ledger(state, *, installed):
    ledger = state["ledger"]
    tail = expected_rows() if installed else []
    if (len(ledger) != BASE_COUNT + len(tail)
            or ledger[BASE_COUNT - 1][0] != BASE_VERSION
            or state["baseline_digest"] != BASE_DIGEST
            or ledger[BASE_COUNT:] != tail
            or state["sources"] != (expected_hashes() if installed else {})
            or state["functions"] != (expected_acl() if installed else dict.fromkeys(NEW_FUNCTIONS))):
        raise SystemExit("Production history or function permissions differ from the verified combined release state.")


def atomic_apply_sql(sources, baseline_count=BASE_COUNT, baseline_digest=BASE_DIGEST):
    sql = """
set transaction isolation level repeatable read;
set local statement_timeout = '45s';
set local lock_timeout = '5s';
set local transaction_timeout = '60s';
lock table public.character_profile_display,app_private.npc_designs,
  app_private.event_run_objectives,app_private.world_npc_battles,
  supabase_migrations.schema_migrations in access exclusive mode nowait;
"""
    sql += "create temporary table aurevane_release_before (snapshot) on commit drop as " + state_sql(preserve=True) + ";\n"
    sql += f"""
do $preflight$
declare b jsonb;
begin
  select snapshot into b from aurevane_release_before;
  if jsonb_array_length(b->'ledger') <> {baseline_count}
    or b->'ledger'->{baseline_count - 1}->>0 <> '{BASE_VERSION}'
    or b->>'baseline_digest' <> {quote(baseline_digest)}
    or b->'sources' <> '{{}}'::jsonb
    or b->'functions' <> {json_sql(dict.fromkeys(NEW_FUNCTIONS))}
  then raise exception 'RELEASE_BASELINE_CHANGED'; end if;
end;
$preflight$;
"""
    for name, original in sources.items():
        sql += original.strip()[len("begin;"):-len("commit;")] + "\n"
        row = ",".join(map(quote, (name[:14], name[15:-4])))
        sql += f"insert into supabase_migrations.schema_migrations(version,name,statements) values ({row},array[{quote(original)}]::text[]);\n"
    sql += "create temporary table aurevane_release_after (snapshot) on commit drop as " + state_sql(preserve=True) + ";\n"
    sql += f"""
do $postflight$
declare a jsonb; b jsonb;
begin
  select snapshot into a from aurevane_release_after;
  select snapshot into b from aurevane_release_before;
  if a->'ledger' is distinct from (b->'ledger' || {json_sql(expected_rows())})
    or a->'sources' is distinct from {json_sql(expected_hashes())}
    or a->'functions' is distinct from {json_sql(expected_acl())}
    or (a - array['ledger','sources','functions']) is distinct from (b - array['ledger','sources','functions'])
    or exists (select 1 from public.character_profile_display
      where confirmed_sprite_designs is distinct from
        (appearance_image_url is not null)::integer + (pending_appearance_image_url is not null)::integer)
    or exists (select 1 from app_private.event_run_objectives where battle_result is not null)
  then raise exception 'PRESERVATION_POSTFLIGHT'; end if;
end;
$postflight$;
"""
    return sql


def verify_plan(root, cli, uri, ledger):
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        staged = folder / "supabase/migrations"
        staged.mkdir(parents=True)
        for config in ("supabase/config.toml", "supabase/templates/recovery.html"):
            path = folder / config
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / config, path)
        for version, name in ledger:
            if not re.fullmatch(r"\d{14}", version) or not re.fullmatch(r"[A-Za-z0-9_-]+", name):
                raise SystemExit("Unexpected installed migration identifier.")
            (staged / f"{version}_{name}.sql").write_text("-- Already installed.\n")
        for name in MIGRATIONS:
            shutil.copyfile(root / "supabase/migrations" / name, staged / name)
        output = run([cli, "db", "push", "--workdir", tmp, "--db-url", uri,
                      "--include-all", "--dry-run"], "Combined ordered dry run")
        if re.findall(r"\b\d{14}_[A-Za-z0-9_-]+\.sql\b", output) != list(MIGRATIONS):
            raise SystemExit("The CLI did not select all twelve reviewed migrations in order.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cli")
    parser.add_argument("--expected-source", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--staged-source")
    parser.add_argument("--staged-deployment")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_source):
        raise SystemExit("Supply the full reviewed merged source SHA.")
    if args.apply and (args.staged_source != args.expected_source
                       or not re.fullmatch(r"dpl_[A-Za-z0-9]+", args.staged_deployment or "")):
        raise SystemExit("Apply requires the operator-verified staged Production deployment and source.")
    if run(["git", "rev-parse", "HEAD"], "Source identity").strip() != args.expected_source:
        raise SystemExit("The checkout differs from the reviewed source.")
    run(["git", "diff", "--exit-code", "HEAD", "--", "."], "Clean tracked-source check")
    if run([args.cli, "--version"], "Pinned CLI version").strip() != "2.114.0":
        raise SystemExit("Use the reviewed Supabase CLI 2.114.0.")
    root = Path.cwd()
    verify_candidate_delta()
    sources = read_sources(root)
    uri = helpers["production_url"](os.environ.pop("AUREVANE_PRODUCTION_DB_URL", ""))
    connection = urlsplit(uri)
    query = helpers["query"]
    before = query(connection, state_sql() + ";")
    installed = len(before["ledger"]) == BASE_COUNT + len(sources)
    verify_ledger(before, installed=installed)
    if installed:
        print("The combined batch is fully installed and matches the reviewed hashes. No migration replay.")
        return
    verify_plan(root, args.cli, uri, before["ledger"])
    if query(connection, state_sql() + ";") != before:
        raise SystemExit("Production history, permissions or cron changed during planning.")
    for name, digest in MIGRATIONS.items():
        print(f"{name} {digest}", flush=True)
    if not args.apply:
        print("Read-only plan for all twelve combined migrations verified.")
        return
    print(f"Operator attested serving smoke for {args.staged_deployment} at {args.staged_source}.", flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "pr1045.sql"
        path.write_text(atomic_apply_sql(sources))
        run(["psql", "-XqAtw", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file", str(path)],
            "Atomic PR1045 migration and preservation transaction",
            env={**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port),
                 "PGDATABASE": "postgres", "PGUSER": connection.username,
                 "PGPASSWORD": unquote(connection.password), "PGCONNECT_TIMEOUT": "15",
                 "PGSSLMODE": connection.query.removeprefix("sslmode=")}, timeout=75)
    after = query(connection, state_sql() + ";")
    verify_ledger(after, installed=True)
    if after["cron"] != before["cron"]:
        raise SystemExit("Production cron changed across application. Inspect before promotion.")
    print("Exactly twelve combined migrations recorded, with preserved player state, existing recipes and cron.")


if __name__ == "__main__":
    main()
