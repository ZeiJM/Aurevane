import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const owner = '00000000-0000-0000-0000-000000000001'
const staff = '00000000-0000-0000-0000-000000000002'
const character = '00000000-0000-0000-0000-000000000003'
const migration = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20261026063220_master_panel_weekly_activity.sql',
  ),
  'utf8',
)

it('atomically records real panel changes, limits private data and clears only the weekly feed', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema app_private; create schema cron;
      create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid $$;
      create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '${owner}'::uuid then raise exception using errcode='42501',message='GAME_OWNER_REQUIRED'; end if; end $$;
      create table public.characters(id uuid primary key,user_id uuid,name text);
      create table app_private.master_panel_role_assignments(user_id uuid,role text,enabled boolean);
      create table app_private.master_panel_character_access(user_id uuid,character_id uuid);
      insert into app_private.master_panel_role_assignments values('${owner}','game-owner',true);
      insert into public.characters values('${character}','${staff}','Mira');
      insert into app_private.master_panel_character_access values('${staff}','${character}');
      create table app_private.combat_content_versions(id uuid primary key,definition jsonb);
      create table app_private.combat_content_publications(version_id uuid,updated_by uuid,content_key text);
      create table app_private.master_panel_access_audit(actor_user_id uuid,target_character_id uuid,action text,subject text,before_state jsonb,after_state jsonb);
      create table app_private.master_panel_role_defaults(updated_by uuid,roles jsonb);
      create table app_private.player_support_audit(actor_user_id uuid,actor_character_id uuid,character_id uuid,action text,before_facts jsonb,after_facts jsonb);
      create table app_private.world_environment_audit(actor_user_id uuid,before_settings jsonb,after_settings jsonb);
      create table app_private.combat_effect_timing_policy_versions(published_by uuid,modes jsonb);
      create table app_private.battlefield_elevation_policy_versions(published_by uuid);
      create table public.site_music_configuration(updated_by uuid,default_track jsonb,route_overrides jsonb);
      create table app_private.event_definition_versions(id uuid primary key,event_key text,definition jsonb,published_at timestamptz default now());
      create table app_private.event_runs(id uuid primary key,event_key text,definition_version_id uuid);
      create table app_private.event_authoring_audit(actor_user_id uuid,event_key text,action text,result jsonb);
      create table app_private.event_operations_audit(actor_user_id uuid,run_id uuid,action text,command text);
    `)
    await db.exec(migration)
    expect((await db.query('select schedule,command from cron.job')).rows).toEqual([
      { schedule: '0 0 * * 1', command: 'select app_private.clear_master_panel_activity_v1();' },
    ])
    const read = (actor = owner) =>
      db.query<{
        value: {
          entries: { actor: string; action: string; subject: string; detail: string }[]
          weekStartsAt: string
          resetsAt: string
        }
      }>('select public.read_master_panel_activity_v1($1,100,null) value', [actor])
    await expect(read(staff)).rejects.toThrow('GAME_OWNER_REQUIRED')
    await db.exec(`
      insert into app_private.combat_content_versions values('${character}','{"name":"Ember","secret":"private payload"}');
      insert into app_private.combat_content_publications values('${character}','${staff}','skill.ember');
      insert into app_private.master_panel_access_audit values('${owner}','${character}','role.granted','character-access',null,'{"roles":["moderator"],"user_id":"${staff}","access_version":1}');
      insert into app_private.master_panel_role_defaults values('${owner}','{}');
      update app_private.master_panel_role_defaults set roles='{"moderator":["master.access"]}';
      insert into app_private.player_support_audit values('${owner}',null,'${character}','player.edit','{"xp":0,"build":{}}','{"xp":1,"build":{"secret":"private payload"}}');
      insert into app_private.player_support_audit values('${owner}',null,'${character}','battle.no-contest','{}','{}');
      insert into app_private.world_environment_audit values('${owner}','{"weatherOverride":null}','{"weatherOverride":"rain"}');
      insert into app_private.combat_effect_timing_policy_versions values('${owner}','{}');
      insert into app_private.battlefield_elevation_policy_versions values('${owner}');
      insert into public.site_music_configuration values('${owner}','{}','[]');
      update public.site_music_configuration set default_track='{"label":"A song","private":"private payload"}';
      insert into app_private.event_definition_versions(id,event_key,definition) values('${character}','crisis.ember','{"name":"Ember Crisis"}');
      insert into app_private.event_runs values('${character}','crisis.ember','${character}');
      insert into app_private.event_authoring_audit values('${staff}','crisis.ember','publish','{}');
      insert into app_private.event_operations_audit values('${staff}','${character}','lifecycle','pause');
    `)
    const result = (await read()).rows[0]!.value
    expect(result.entries).toHaveLength(11)
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        action: 'Changed Staff access',
        subject: 'Mira',
        detail: 'Changed: Roles',
      }),
    )
    const firstPage = (
      await db.query<{ value: { entries: { id: string }[]; nextCursor: string } }>(
        'select public.read_master_panel_activity_v1($1,2,null) value',
        [owner],
      )
    ).rows[0]!.value
    expect(firstPage.entries.map((entry) => entry.id)).toEqual(['11', '10'])
    expect(firstPage.nextCursor).toBe('10')
    const secondPage = (
      await db.query<{ value: { entries: { id: string }[] } }>(
        'select public.read_master_panel_activity_v1($1,2,$2) value',
        [owner, firstPage.nextCursor],
      )
    ).rows[0]!.value
    expect(secondPage.entries.map((entry) => entry.id)).toEqual(['9', '8'])
    await expect(
      db.query('select public.read_master_panel_activity_v1($1,101,null)', [owner]),
    ).rejects.toThrow('INVALID_ACTIVITY_PAGE')
    expect(result.entries).toContainEqual(
      expect.objectContaining({ actor: 'Mira', action: 'Published content', subject: 'Ember' }),
    )
    expect(result.entries).toContainEqual(
      expect.objectContaining({
        actor: 'Game Owner',
        action: 'Corrected player',
        subject: 'Mira',
        detail: 'Changed: Build, Experience',
      }),
    )
    expect(result.entries).toContainEqual(expect.objectContaining({ subject: 'Ember Crisis' }))
    expect(JSON.stringify(result)).not.toContain('private payload')
    expect(JSON.stringify(result)).not.toContain(character)
    expect(Date.parse(result.resetsAt) - Date.parse(result.weekStartsAt)).toBe(
      7 * 24 * 60 * 60 * 1000,
    )
    // Failed surrounding transactions cannot leave misleading activity.
    await db.exec('begin')
    await db.exec(
      `insert into app_private.battlefield_elevation_policy_versions values('${owner}')`,
    )
    await db.exec('rollback')
    expect((await read()).rows[0]!.value.entries).toHaveLength(11)
    await db.exec(
      "update app_private.master_panel_activity set occurred_at=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'-interval '1 second'",
    )
    expect((await read()).rows[0]!.value.entries).toEqual([])
    await db.exec('select app_private.clear_master_panel_activity_v1()')
    expect(
      (await db.query('select count(*)::int n from app_private.master_panel_activity')).rows[0],
    ).toEqual({ n: 0 })
    expect(
      (await db.query('select count(*)::int n from app_private.player_support_audit')).rows[0],
    ).toEqual({ n: 2 })
    expect(
      (await db.query('select count(*)::int n from app_private.combat_content_versions')).rows[0],
    ).toEqual({ n: 1 })
    await db.exec('set role authenticated')
    await expect(read()).rejects.toThrow('permission denied')
    await expect(db.query('select app_private.clear_master_panel_activity_v1()')).rejects.toThrow(
      'permission denied',
    )
    await db.exec('reset role;set role service_role')
    await read()
    await expect(db.query('select * from app_private.master_panel_activity')).rejects.toThrow(
      'permission denied',
    )
    await expect(db.query('select app_private.clear_master_panel_activity_v1()')).rejects.toThrow(
      'permission denied',
    )
  } finally {
    await db.close()
  }
}, 30000)
