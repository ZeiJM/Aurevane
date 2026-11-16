"""Local-only PG17 source/diagnostic probe; creates and drops its own isolated database.
Requires psycopg[binary], Node with TypeScript stripping, and
AUREVANE_LOCAL_DIAGNOSTIC_DSN pointing to a disposable localhost cluster.
This verifies the lock/diagnostic boundary, not full Supabase/browser acceptance.
"""

from pathlib import Path
import concurrent.futures
import json
import os
import subprocess
import uuid

import psycopg
from psycopg import sql

D = os.environ["AUREVANE_LOCAL_DIAGNOSTIC_DSN"]
params = psycopg.conninfo.conninfo_to_dict(D)
if params.get("host") not in ("127.0.0.1", "localhost"):
    raise ValueError("Only a disposable local PostgreSQL cluster is permitted.")
D = psycopg.conninfo.make_conninfo(D, hostaddr="127.0.0.1")
admin = psycopg.connect(D, autocommit=True)
assert admin.info.server_version // 10000 == 17, "PostgreSQL17 required"
database = "aurevane_world_diag_" + uuid.uuid4().hex[:12]
D = psycopg.conninfo.make_conninfo(D, dbname=database, client_encoding="UTF8")
root = Path(__file__).resolve().parents[2]
s = (
    root / "supabase/migrations/20261103075225_quality_point_item_inventory.sql"
).read_text()


def fn(name):
    a = s.index("create function " + name + "(")
    b = s.index("$$;", s.index("as $$", a)) + 3
    return s[a:b]


u = "11111111-1111-1111-1111-111111111111"
ch = "22222222-2222-2222-2222-222222222222"
admin.execute(sql.SQL("create database {}").format(sql.Identifier(database)))
try:
    c = psycopg.connect(D, autocommit=True)
    c.execute(
        "create schema app_private; create table public.characters(id uuid primary key,user_id uuid);"
    )
    c.execute(
        """create table app_private.character_active_builds(character_id uuid,user_id uuid,support_action_id text);
 create table app_private.character_item_inventory(character_id uuid primary key,revision bigint default 0,equipment jsonb default '{}',selected_support jsonb,previous_basic_support text);
 create table app_private.account_deletion_requests(user_id uuid); create table app_private.character_deletion_requests(character_id uuid);
 create table app_private.battle_sessions(id uuid,lifecycle text); create table app_private.battle_participants(character_id uuid,user_id uuid,battle_session_id uuid);
 create function app_private.character_item_snapshot_v1(p_character_id uuid) returns jsonb language sql stable as $$select jsonb_build_object('revision',revision) from app_private.character_item_inventory where character_id=p_character_id$$;
 create function app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb) returns integer language sql as $$select 0$$;
 create table app_private.character_item_stacks(id uuid,character_id uuid,item_id text);
 create function app_private.current_runtime_item_v1(text) returns jsonb language sql as $$select '{}'::jsonb$$;"""
    )
    c.execute(fn("app_private.lock_character_item_inventory_v1"))
    c.execute(fn("public.read_character_item_inventory_v1"))
    c.execute(fn("public.assert_character_item_admission_v1"))
    c.execute(
        "create function public.probe_capture(p_user_id uuid,p_character_id uuid) returns jsonb language plpgsql as $$declare inventory jsonb;begin inventory:=public.read_character_item_inventory_v1(p_user_id,p_character_id);return public.assert_character_item_admission_v1(p_user_id,p_character_id,(inventory->>'revision')::bigint);end;$$;"
    )
    c.execute("insert into public.characters values(%s,%s)", (ch, u))
    c.execute(
        "insert into app_private.character_active_builds values(%s,%s,'guard')", (ch, u)
    )

    def read():
        with psycopg.connect(D) as t:
            try:
                return t.execute(
                    "select public.probe_capture(%s,%s)", (u, ch)
                ).fetchone()[0]
            except psycopg.Error as e:
                return {"code": e.sqlstate, "message": e.diag.message_primary}

    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        for n in range(30):
            c.execute("delete from app_private.character_item_inventory")
            one = pool.submit(read)
            two = pool.submit(read)
            a, b = one.result(), two.result()
            assert "code" not in a and "code" not in b, (a, b)
    print(
        "PG17:30 cold paired captures pass; ordinary equipment reads serialize safely."
    )
    # Replace only the public fixture reader with the exact diagnostic transformation.
    battle = (
        root / "supabase/migrations/20261103110843_battle_equipment_admission.sql"
    ).read_text()
    a = battle.index("create function public.read_character_battle_equipment_v1(")
    b = battle.index("$$;", battle.index("as $$", a)) + 3
    definition = battle[a:b]
    c.execute(
        "create function app_private.battle_equipment_capture_v1(jsonb) returns jsonb language sql as $$select $1$$;"
    )
    script = (
        "import {diagnoseWorldEquipmentDefinition} from "
        + json.dumps(str(root / "apps/web/e2e/world-contention-gate.ts"))
        + "; process.stdout.write(diagnoseWorldEquipmentDefinition(JSON.parse(process.argv[1]),'atlas-gate-1234',[process.argv[2]]));"
    )
    wrapped = subprocess.check_output(
        [
            "node",
            "--experimental-strip-types",
            "--input-type=module",
            "-e",
            script,
            json.dumps(definition),
            ch,
        ],
        text=True,
    )
    c.execute(wrapped)
    notices = []
    c.add_notice_handler(lambda notice: notices.append(notice.message_primary))
    c.execute("set client_min_messages='log'")
    for key, seed, category in [
        (u, 1, "ITEM_ADMISSION_RETRY"),
        ("combat-catalogue-publication", 0, "ITEM_CATALOGUE_RETRY"),
    ]:
        with psycopg.connect(D, autocommit=True) as holder:
            holder.execute(
                "select pg_advisory_lock(hashtextextended(%s,%s))", (key, seed)
            )
            try:
                c.execute(
                    "select public.read_character_battle_equipment_v1(%s,%s)", (u, ch)
                )
                raise AssertionError("Expected contention rejection")
            except psycopg.Error as error:
                assert (
                    error.sqlstate == "40001" and error.diag.message_primary == category
                ), (error.sqlstate, error.diag.message_primary)
            assert "AUREVANE_ATLAS_ITEM atlas-gate-1234 40001 " + category in notices
            lock_name = "account1" if seed == 1 else "catalogue"
            lock_rows = [
                json.loads(n.split("AUREVANE_ATLAS_LOCK atlas-gate-1234 ")[1])
                for n in notices
                if n.startswith("AUREVANE_ATLAS_LOCK atlas-gate-1234 ")
            ]
            assert any(
                {"lock": lock_name, "rpc": "other"} in rows for rows in lock_rows
            )
    print(
        "PG17:exact admission/catalogue40001 failures and sanitized competing locks retained."
    )
finally:
    if "c" in locals():
        c.close()
    admin.execute(
        sql.SQL("drop database {} with (force)").format(sql.Identifier(database))
    )
    admin.close()
