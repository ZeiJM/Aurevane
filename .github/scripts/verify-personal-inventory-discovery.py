#!/usr/bin/env python3
"""Verify the fragment grant interleaving on the disposable CI database.

Run after other fixtures. Committed test data is discarded with the stack.
"""

import json
import subprocess
import tempfile
import time
import uuid


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def json_sql(value):
    return quote(json.dumps(value)) + "::jsonb"


def verify():
    containers = subprocess.check_output(
        ["docker", "ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], text=True
    ).splitlines()
    assert len(containers) == 1 and containers[0].startswith("supabase_db_"), (
        "Exactly one disposable local Supabase DB is required"
    )
    psql = ["docker", "exec", "-i", containers[0], "psql", "-X", "-qAt",
            "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"]

    def sql(statement):
        return subprocess.run(
            psql, input=f"set statement_timeout='10s';\n{statement}\n",
            text=True, stdout=subprocess.PIPE, check=True, timeout=15
        ).stdout.strip()

    owner = uuid.UUID(sql("""
        select user_id from app_private.master_panel_role_assignments
        where role='game-owner' and enabled;
    """))
    player = uuid.uuid4()
    visible_peer, outside_peer = uuid.uuid4(), uuid.uuid4()
    event = f"event.native-discovery-{player}"
    tag = f"discovery-grant-{player}"
    first, second = (f"fixture.native-discovery-{player}.{part}" for part in ("first", "second"))
    items = subprocess.check_output(
        ["node", "--input-type=module", "-e", """
            import { itemFixture } from './packages/game-core/src/content/items-test-fixtures.ts'
            console.log(JSON.stringify(process.argv.slice(1).map(id => itemFixture({
              id, name: 'Race fragment', itemClass: 'general', inventoryCategory: 'general',
              equipment: null, qualityPoints: 0, maximumStack: 5,
            }))))
        """, first, second], text=True, timeout=10
    )
    definition = {
        "schemaVersion": 1, "eventKey": event, "templateKey": "template.native-discovery",
        "contentVersion": 1, "title": "The fragment mystery", "summary": "Disposable discovery.",
        "internalNotes": "CI fixture.", "family": "lore-revelation", "category": "hidden-discoveries",
        "scope": {"type": "global"}, "rewardPackageRefs": [], "aftermathRefs": [],
        "inventoryDiscovery": {"firstItemId": first, "secondItemId": second, "clue": "The fragments fit."},
        "phases": [{"id": "discovery", "name": "Discovery", "objectives": [], "effects": [],
                    "cleanupEffects": [], "transition": {"type": "manual"}}],
    }
    initial = {"version": 1, "position": {"sectorId": "verdant-expanse", "x": 2, "y": 4},
               "route": [], "nextStepAt": None}
    world_version = initial["version"]
    scene_sector = initial["position"]["sectorId"]
    outside = {**initial, "position": {**initial["position"], "sectorId": "aureth-crown"}}
    sql(f"""
        insert into auth.users(id,email,email_confirmed_at) values
          ('{player}','{player}@example.test',now()),('{visible_peer}','{visible_peer}@example.test',now());
        insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
          presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
          might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        select actor.id,actor.user_id,actor.slot,1,'Discovery fixture','discovery-'||actor.id,
          'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()
        from (values ('{player}'::uuid,'{player}'::uuid,0),
          ('{visible_peer}','{visible_peer}',0),('{outside_peer}','{visible_peer}',1)) actor(id,user_id,slot);
        insert into app_private.character_world_state(character_id,state) values
          ('{visible_peer}',{json_sql(initial)}),('{outside_peer}',{json_sql(outside)});
        set role service_role;
        select public.seed_runtime_item_sources_v1({json_sql(json.loads(items))});
        select * from public.publish_event_definition_v2('{owner}',null::uuid,'{event}',
          {json_sql(definition)},null,gen_random_uuid(),null,true);
    """)
    run = uuid.UUID(sql(f"""
        set role service_role;
        select run_id from public.schedule_event_run_v2('{owner}',null::uuid,'{event}',
          gen_random_uuid(),'fixture:{player}',clock_timestamp()+interval '1 hour',
          clock_timestamp()+interval '2 hours',null,true);
    """))

    def grant(revision, item):
        return f"""select public.grant_character_items_v1('{player}','{player}',{revision},
            'fixture:grant:{revision}',{json_sql([{'itemId': item, 'quantity': 1}])});"""

    def quests():
        world = json.loads(sql(f"""
            set role service_role;
            select public.read_world_state_v1('{player}','{player}',{json_sql(initial)});
        """))
        assert world["state"]["version"] == world_version, "Discovery must preserve the World version"
        return world["personalQuests"]

    def scene_call(version):
        return f"""public.read_world_scene_players_v{version}('{player}','{player}',{world_version},
            array[{quote(scene_sector)}],{json_sql(initial['position'])})"""

    def assert_scene(version):
        scene = json.loads(sql(f"set role service_role; select {scene_call(version)};"))
        assert scene["version"] == world_version, "Scene must match the requested World version"
        peers = {peer["characterId"] for peer in scene["players"]}
        assert str(visible_peer) in peers, "Scene must return a peer in the requested sector"
        assert str(outside_peer) not in peers and all(
            peer["position"]["sectorId"] == scene_sector for peer in scene["players"]
        ), "Scene must exclude peers outside the requested sector"

    sql(f"set role service_role; {grant(0, first)}")
    assert quests() == [], "A scheduled discovery must stay hidden"

    with tempfile.TemporaryFile(mode="w+t") as errors, subprocess.Popen(
        psql, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errors, text=True
    ) as holder:
        try:
            holder.stdin.write(f"""set application_name='{tag}';
                set statement_timeout='10s'; set idle_in_transaction_session_timeout='60s';
                begin; set local role service_role; {grant(1, second)}\n""")
            holder.stdin.flush()
            deadline = time.monotonic() + 10
            while sql(f"""
                select count(*) from pg_stat_activity
                where application_name='{tag}' and state='idle in transaction'
                  and ltrim(query) like 'select public.grant_character_items_v1(%';
            """) != "1":
                assert holder.poll() is None and time.monotonic() < deadline, (
                    "Fragment grant never reached the uncommitted transaction barrier"
                )
                time.sleep(0.05)

            # Advance the fixture clock boundary and activate in one transaction
            # so the scheduled-event worker cannot race the explicit Start.
            sql(f"""begin;
                update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second'
                where id='{run}';
                set local role service_role;
                select * from public.operate_event_run_v2('{owner}',null::uuid,'{run}',1,
                  gen_random_uuid(),'start',null,true);
                commit;""")
            assert quests() == [], "World must not reveal an uncommitted fragment"
            sql(f"""
                set role service_role;
                do $contention$
                begin
                  perform {scene_call(2)};
                  raise exception 'Scene registration unexpectedly succeeded while the grant held the character';
                exception when sqlstate '55P03' then
                  null;
                end;
                $contention$;
            """)
            assert_scene(1)
            assert sql(f"""
                select count(*) from app_private.world_scene_subscriptions where character_id='{player}';
            """) == "0", "The fallback scene must not register live presence"
            holder.communicate("commit;\n", timeout=15)
            assert holder.returncode == 0, "Fragment grant failed to commit"
        finally:
            if holder.poll() is None:
                holder.kill()
                holder.wait(timeout=5)
            errors.seek(0)
            diagnostics = errors.read()
            if diagnostics:
                print(diagnostics, end="")

    clue = {"runId": str(run), "title": "The fragment mystery", "body": "The fragments fit.", "discovery": True}
    assert quests() == [clue], "World missed the committed fragment after activation reconciliation"
    assert_scene(2)
    assert json.loads(sql(f"""
        select jsonb_build_object('version',registered_version,'sectors',scene_sector_ids)
        from app_private.world_scene_subscriptions where character_id='{player}' and user_id='{player}';
    """)) == {"version": world_version, "sectors": [scene_sector]}, "Post-commit live registration must match the owned scene"
    assert quests() == [clue], "Refreshing must retain a single discovery"
    assert sql(f"""
        select count(*) from app_private.event_personal_quest_attempts where run_id='{run}';
    """) == "1", "Discovery must record one receipt"
    assert sql(f"""
        select item_id || ':' || quantity from app_private.character_item_stacks
        where character_id='{player}' order by item_id;
    """).splitlines() == [f"{first}:1", f"{second}:1"], "Discovery must leave both fragments carried"
    print("PASS fragment reconciliation and World scene fallback across two PostgreSQL sessions")


if __name__ == "__main__":
    verify()
