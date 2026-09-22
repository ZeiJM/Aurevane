import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
let db: PGlite
const owner = '00000000-0000-4000-8000-000000000001',
  other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011',
  target = '00000000-0000-4000-8000-000000000012'
const initial = {
  version: 1,
  position: { sectorId: 'verdant-expanse', x: 5, y: 4 },
  safe: false,
  route: [],
  nextStepAt: null,
  discoveries: {},
  completedObjectives: [],
}
const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const read = () =>
  db.query<{ result: { state: typeof initial; eventObjectives: unknown[] } }>(
    'select public.read_world_state_v1($1,$2,$3) as result',
    [owner, character, initial],
  )
const commit = (
  version: number,
  kind: string,
  state: unknown,
  command = '00000000-0000-4000-8000-000000000099',
) =>
  db.query('select public.commit_world_state_v1($1,$2,$3,$4,$5,$6)', [
    owner,
    character,
    version,
    command,
    kind,
    state,
  ])
const snapshot = {
  tactical: {
    battle: {
      battleId: 'world-encounter',
      rulesVersion: 1,
      contentVersion: 1,
      lifecycle: 'active',
      combatants: [
        { id: `character:${character}`, teamId: 'team:0' },
        { id: `character:${target}`, teamId: 'team:1' },
      ],
    },
  },
}
const attack = (
  version = 1,
  builds: unknown = { [character]: 1, [target]: 1 },
  snap: unknown = snapshot,
) =>
  db.query<{ result: { battleSessionId: string } }>(
    'select public.start_world_encounter_v1($1,$2,$3,$4,1,$5,$6) as result',
    [owner, character, target, version, snap, builds],
  )
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema app_private; create schema auth;
 create table auth.users(id uuid primary key);
 create table public.characters(id uuid primary key,user_id uuid,name text,level integer,portrait_ref text);
 create table app_private.battle_sessions(id uuid primary key,owner_user_id uuid,lifecycle text,battle_id text,rules_version int,content_version int,current_version bigint,current_snapshot jsonb,created_at timestamptz,updated_at timestamptz);
 create table app_private.battle_participants(battle_session_id uuid,user_id uuid,character_id uuid,participant_role text,combatant_id text);
 create table app_private.battle_snapshots(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz);
 create table app_private.pvp_active_spectating(user_id uuid,battle_session_id uuid);
 create table app_private.training_reports(character_id uuid,status text);
 create table app_private.wayfarers_practice_state(character_id uuid,planned_window text,plan_set_at timestamptz,planned_window_seconds bigint);
 create table app_private.character_active_builds(character_id uuid primary key,build_version bigint);
 create table app_private.pvp_lobbies(id uuid primary key default gen_random_uuid(),lobby_key text,mode text,owner_user_id uuid,team_a_size int,team_b_size int,team_c_size int,status text default 'waiting',battle_session_id uuid,battle_key text,updated_at timestamptz);
 create table app_private.pvp_lobby_members(lobby_id uuid,user_id uuid,character_id uuid,team_index int,seat_index int,ready boolean);
 create table app_private.event_definition_versions(id uuid primary key,definition jsonb);
 create table app_private.event_runs(id uuid primary key,definition_version_id uuid,run_mode text,lifecycle_status text,current_phase_id text,scheduled_end_at timestamptz,scope_type text,scope_key text);
 create function app_private.pvp_key(text) returns text language sql as 'select $1 || gen_random_uuid()::text';
 insert into auth.users values('${owner}'),('${other}');
 insert into characters values('${character}','${owner}','Traveller',1,'portrait'),('${target}','${other}','Other',1,'portrait');
 insert into app_private.character_active_builds values('${character}',1),('${target}',1);`)
  // Use the production deletion table: the slots RPC aliases delete_after;
  // deletion_execute_after is not a physical character column.
  const deletion = migration('20260818145256_pv1f_character_slots_and_deletion.sql')
  await db.exec(
    deletion.slice(
      deletion.indexOf('create table app_private.character_deletion_requests'),
      deletion.indexOf('create index character_deletion_requests'),
    ),
  )
  // Execute the existing production battle creation function, not a success stub.
  const pvp = migration('20260820161500_pvp_function_ambiguity_hardening.sql')
  await db.exec(
    pvp.slice(
      pvp.indexOf('create or replace function public.create_pvp'),
      pvp.indexOf('create or replace function public.commit_battle'),
    ),
  )
  const ownerGuard = migration('20260818145212_pv1f_single_active_game_session.sql')
  await db.exec(
    ownerGuard.slice(
      ownerGuard.indexOf('create or replace function app_private.enforce_single_active_battle_v1'),
      ownerGuard.lastIndexOf('commit;'),
    ),
  )
  await db.exec(migration('20260922203418_living_atlas_world_travel.sql'))
}, 30000)
beforeEach(async () => {
  await db.exec('begin')
  await read()
  await db.query('select public.read_world_state_v1($1,$2,$3)', [
    other,
    target,
    { ...initial, position: { ...initial.position, x: 6 } },
  ])
})
afterEach(async () => {
  await db.exec('rollback')
})
afterAll(async () => {
  await db?.close()
})
// Expected SQL exceptions abort a transaction; isolate them with a savepoint.
async function rejected(operation: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
}
it('denies browser roles direct state and RPC access', async () => {
  const r = await db.query<{ allowed: boolean }>(
    "select has_function_privilege('authenticated','public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)','execute') allowed",
  )
  expect(r.rows[0]?.allowed).toBe(false)
  await db.exec('set local role authenticated')
  await rejected(
    () => db.query('select * from app_private.character_world_state'),
    'permission denied',
  )
  await db.exec('reset role')
})
it('initializes owned state and rejects another account', async () => {
  expect((await read()).rows[0]?.result.state.position).toEqual(initial.position)
  await rejected(
    () => db.query('select public.read_world_state_v1($1,$2,$3)', [other, character, initial]),
    'WORLD_NOT_OWNED',
  )
})
it('makes command replay harmless and rejects stale or premature movement', async () => {
  const route = [{ position: { ...initial.position, x: 6 }, durationMs: 1100 }],
    state = { ...initial, route, nextStepAt: Date.now() + 60000 }
  await commit(1, 'walk', state)
  await commit(1, 'walk', state)
  await rejected(
    () => commit(1, 'stop', initial, '00000000-0000-4000-8000-000000000098'),
    'WORLD_STALE_VERSION',
  )
  await rejected(
    () =>
      commit(
        2,
        'tick',
        { ...initial, position: route[0]!.position },
        '00000000-0000-4000-8000-000000000097',
      ),
    'WORLD_STEP_NOT_DUE',
  )
  expect((await read()).rows[0]?.result.state).toMatchObject({
    version: 2,
    position: initial.position,
  })
})
it('blocks training and interrupts routes for every combat entry', async () => {
  await commit(1, 'walk', {
    ...initial,
    route: [{ position: { ...initial.position, x: 6 }, durationMs: 1100 }],
    nextStepAt: Date.now() + 10000,
  })
  await db.query(
    'insert into app_private.wayfarers_practice_state(character_id,planned_window) values($1,$2)',
    [character, 'short'],
  )
  await rejected(
    () => commit(2, 'walk', initial, '00000000-0000-4000-8000-000000000098'),
    'WORLD_TRAINING_ACTIVE',
  )
  await db.exec('delete from app_private.wayfarers_practice_state')
  await attack(2)
  expect((await read()).rows[0]?.result.state.route).toEqual([])
  await rejected(
    () => commit(3, 'walk', initial, '00000000-0000-4000-8000-000000000098'),
    'WORLD_ACTIVE_BATTLE',
  )
})
it('atomically creates one encounter with both participants and rejects a competing attack', async () => {
  expect((await attack()).rows[0]?.result.battleSessionId).toMatch(/^[0-9a-f-]{36}$/)
  expect((await db.query('select * from app_private.battle_participants')).rows).toHaveLength(2)
  await rejected(() => attack(), 'WORLD_STALE_VERSION')
  expect((await db.query('select * from app_private.battle_sessions')).rows).toHaveLength(1)
})
it('rolls back lobby and route mutations if existing battle validation fails', async () => {
  await rejected(
    () =>
      attack(1, undefined, {
        tactical: { battle: { ...snapshot.tactical.battle, combatants: [] } },
      }),
    'PVP_PARTICIPANT_NOT_IN_SNAPSHOT',
  )
  expect((await db.query('select * from app_private.pvp_lobbies')).rows).toHaveLength(0)
  expect((await read()).rows[0]?.result.state.version).toBe(1)
})
it('rejects missing builds, safe targets and moved targets', async () => {
  await rejected(() => attack(1, { [character]: 1 }), 'WORLD_STALE_BUILD')
  await db.query(
    "update app_private.character_world_state set state=jsonb_set(state,'{safe}','true') where character_id=$1",
    [target],
  )
  await rejected(() => attack(), 'WORLD_TARGET_UNAVAILABLE')
  await db.query(
    "update app_private.character_world_state set state=jsonb_set(jsonb_set(state,'{safe}','false'),'{position,x}','10') where character_id=$1",
    [target],
  )
  await rejected(() => attack(), 'WORLD_TARGET_UNAVAILABLE')
})
it('projects only live production event navigation, never internal definition notes', async () => {
  const id = '00000000-0000-4000-8000-000000000050',
    definition = {
      title: 'Festival',
      internalNotes: 'PRIVATE',
      phases: [
        {
          id: 'first',
          name: 'Find the watch',
          objectives: [
            {
              id: 'watch',
              worldNavigation: {
                sectorId: 'verdant-expanse',
                x: 12,
                y: 4,
                autoPath: false,
                guidance: 'exact',
              },
            },
          ],
        },
      ],
    }
  await db.query('insert into app_private.event_definition_versions values($1,$2)', [
    id,
    definition,
  ])
  await db.query(
    "insert into app_private.event_runs values($1,$1,'production','live','first',null,'global',null)",
    [id],
  )
  const data = (await read()).rows[0]!.result
  expect(data.eventObjectives).toHaveLength(1)
  expect(JSON.stringify(data)).not.toContain('PRIVATE')
  await db.exec("update app_private.event_runs set lifecycle_status='paused'")
  expect((await read()).rows[0]?.result.eventObjectives).toEqual([])
})

it('preserves a world encounter when a prechecked Battle Hall request inserts its session', async () => {
  const battle = (await attack()).rows[0]!.result.battleSessionId
  await rejected(
    () =>
      db.query(
        "insert into app_private.battle_sessions(id,owner_user_id,lifecycle,current_snapshot) values(gen_random_uuid(),$1,'active',$2)",
        [owner, snapshot],
      ),
    'WORLD_ACTIVE_BATTLE',
  )
  expect(
    (
      await db.query<{ lifecycle: string }>(
        'select lifecycle from app_private.battle_sessions where id=$1',
        [battle],
      )
    ).rows[0]?.lifecycle,
  ).toBe('active')
})
it('rechecks a prechecked training start at the write boundary after an encounter', async () => {
  await attack()
  await rejected(
    () =>
      db.query(
        'insert into app_private.wayfarers_practice_state(character_id,planned_window) values($1,$2)',
        [character, 'short'],
      ),
    'WORLD_ACTIVE_BATTLE',
  )
})
it('rechecks a prechecked spectator join at the write boundary after an encounter', async () => {
  const battle = (await attack()).rows[0]!.result.battleSessionId
  await rejected(
    () => db.query('insert into app_private.pvp_active_spectating values($1,$2)', [owner, battle]),
    'PVP_SPECTATE_CONFLICT',
  )
})
it('rebases a delayed successor step on the authoritative commit clock', async () => {
  const route = [
    { position: { ...initial.position, x: 6 }, durationMs: 1100 },
    { position: { ...initial.position, x: 7 }, durationMs: 1100 },
  ]
  // Model a read/resolution followed by queue or lock delay, without sleeping.
  await db.query('update app_private.character_world_state set state=$2 where character_id=$1', [
    character,
    { ...initial, route, nextStepAt: Date.now() - 5000 },
  ])
  const before = Date.now()
  await commit(1, 'tick', {
    ...initial,
    position: route[0]!.position,
    route: route.slice(1),
    nextStepAt: Date.now() - 1000,
  })
  const next = (await read()).rows[0]!.result.state
  expect(next.nextStepAt).toBeGreaterThanOrEqual(before + 1100)
  await rejected(
    () =>
      commit(
        2,
        'tick',
        { ...initial, position: route[1]!.position },
        '00000000-0000-4000-8000-000000000098',
      ),
    'WORLD_STEP_NOT_DUE',
  )
})

it('binds concurrent retries to request intent even when derived deadlines differ', async () => {
  const call = (fingerprint: string, deadline: number) =>
    db.query('select public.commit_world_state_v1($1,$2,1,$3,$4,$5,$6)', [
      owner,
      character,
      '00000000-0000-4000-8000-000000000099',
      'walk',
      {
        ...initial,
        route: [{ position: { ...initial.position, x: 6 }, durationMs: 1100 }],
        nextStepAt: deadline,
      },
      fingerprint,
    ])
  await call('request-one', 100)
  await call('request-one', 900)
  expect((await read()).rows[0]?.result.state.version).toBe(2)
  await rejected(() => call('different-intent', 100), 'WORLD_COMMAND_CONFLICT')
})
it('reports elapsed training using the database clock and keeps incomplete plans blocked', async () => {
  await db.query(
    "insert into app_private.wayfarers_practice_state values($1,'short',clock_timestamp(),10800)",
    [character],
  )
  const active = (await read()).rows[0]!.result
  expect(active).toMatchObject({ trainingExpired: false, blocked: 'WORLD_TRAINING_ACTIVE' })
  await db.exec(
    "update app_private.wayfarers_practice_state set plan_set_at=clock_timestamp()-interval '4 hours'",
  )
  expect((await read()).rows[0]?.result).toMatchObject({
    trainingExpired: true,
    blocked: null,
  })
})

it('allows travel after a second plan expires while an earlier reward remains unclaimed', async () => {
  await db.query(
    "insert into app_private.wayfarers_practice_state values($1,'short',clock_timestamp()-interval '4 hours',10800)",
    [character],
  )
  await db.query("insert into app_private.training_reports values($1,'pending')", [character])
  expect((await read()).rows[0]?.result).toMatchObject({ trainingExpired: false, blocked: null })
  await commit(1, 'walk', {
    ...initial,
    route: [{ position: { ...initial.position, x: 6 }, durationMs: 1100 }],
  })
  expect((await read()).rows[0]?.result.state.version).toBe(2)
  expect((await db.query('select * from app_private.training_reports')).rows).toHaveLength(1)
  await db.exec("update app_private.training_reports set status='claimed'")
  expect((await read()).rows[0]?.result).toMatchObject({ trainingExpired: true, blocked: null })
})

it('excludes pending character deletions from reading, travel and encounter targets', async () => {
  await db.query(
    "insert into app_private.character_deletion_requests values($1,$2,now(),now()+interval '24 hours')",
    [target, other],
  )
  expect((await read()).rows[0]?.result).toMatchObject({ players: [] })
  await rejected(() => attack(), 'WORLD_TARGET_UNAVAILABLE')
  await db.query(
    "insert into app_private.character_deletion_requests values($1,$2,now(),now()+interval '24 hours')",
    [character, owner],
  )
  await rejected(() => read(), 'WORLD_NOT_OWNED')
  await rejected(() => commit(1, 'stop', initial), 'WORLD_NOT_OWNED')
})
