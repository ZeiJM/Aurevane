import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'

const root = resolve(process.cwd(), '../../supabase/migrations')
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
const request = '00000000-0000-4000-8000-000000000099'
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  // Only Supabase's platform identity and unavailable scheduler are fixtures.
  // Every Aurevane table, authorization function, producer and finalizer is real migration SQL.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema realtime; create table realtime.messages(extension text,topic text,payload jsonb);
    create function realtime.topic() returns text language sql as $$ select null::text $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages values($2,$3,$1) $$;
    create schema cron; create table cron.job(jobid bigint generated always as identity,jobname text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname) values($1) returning jobid $$;
    create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true $$;`)
  for (const name of readdirSync(root)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (process.env.TASK9_PREDECESSOR === '1' && name.endsWith('_master_players_recovery.sql'))
      continue
    // PGlite has no LZ4 codec; this storage-only setting does not alter authority.
    const sql = readFileSync(resolve(root, name), 'utf8')
      .replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi, '')
      .replace(/set compression lz4/gi, 'set compression pglz')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
    }
  }
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${other}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})
const read = (user = owner) =>
  db.query<{ result: Record<string, unknown> }>(
    'select public.read_master_player_v1($1,$2,null) result',
    [user, character],
  )
async function denied(operation: () => Promise<unknown>, message: RegExp) {
  await db.exec('savepoint denied')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint denied')
}
it('neutral_reader_no_world_mutation and existing real Owner authority', async () => {
  await denied(() => read(other), /OWNER_REQUIRED/)
  const result = (await read()).rows[0]!.result
  expect(result.name).toBe('Test Player')
  expect(result.world).toBeNull()
  expect((await db.query('select * from app_private.character_world_state')).rows).toEqual([])
})
it('registers four service-only actor-context operations without weakening original Staff authority', async () => {
  const rows = (
    await db.query<{ proname: string; allowed: boolean }>(
      `select p.proname,has_function_privilege('authenticated',p.oid,'execute') allowed from pg_proc p where p.proname in ('search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1')`,
    )
  ).rows
  expect(rows).toHaveLength(4)
  expect(rows.every((row) => !row.allowed)).toBe(true)
})

async function edit(command: unknown, key = request, fingerprint?: string) {
  const expected = fingerprint ?? String((await read()).rows[0]!.result.fingerprint)
  return db.query<{
    result: {
      replayed: boolean
      facts: { level: number; xp: number; build: { buildVersion: number } }
    }
  }>('select public.edit_master_player_v1($1,$2,$3,$4,$5,true,null) result', [
    owner,
    character,
    expected,
    key,
    command,
  ])
}
const sourceCommand = {
  kind: 'source',
  xp: 0,
  attributes: { might: 11, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
}
async function snapshot() {
  const build = (
    await db.query<{ value: Record<string, unknown> }>(
      'select public.get_character_committed_build_snapshot_v2($1,$2) value',
      [other, character],
    )
  ).rows[0]!.value
  return {
    tactical: {
      battle: {
        battleId: 'players-test',
        rulesVersion: 1,
        contentVersion: 1,
        lifecycle: 'active',
        currentTurn: { combatantId: `character:${character}` },
        rng: { algorithm: 'xorshift32-v1', seed: 7, state: 7, draws: 0 },
        combatants: [
          {
            id: `character:${character}`,
            teamId: 'players',
            hp: 100,
            mp: 10,
            temporaryResources: [{ key: 'pv1f.action-economy', current: 3, maximum: 5 }],
          },
          { id: 'enemy', teamId: 'enemies', hp: 100, mp: 10, temporaryResources: [] },
        ],
      },
    },
    buildAuthority: {
      combatants: [{ ...build, combatantId: `character:${character}`, characterId: character }],
    },
  }
}
async function createBattle(prepared?: Awaited<ReturnType<typeof snapshot>>) {
  const initial = prepared ?? (await snapshot())
  return (
    await db.query<{
      battle_session_id: string
      snapshot: Awaited<ReturnType<typeof snapshot>>
      battle_version: number
    }>('select * from public.create_battle_session_v1($1,$2,$3,$4,$5,1,1,$6,$7)', [
      other,
      request,
      'creation',
      other,
      'players-test',
      initial,
      [
        {
          combatant_id: `character:${character}`,
          participant_role: 'player',
          character_id: character,
        },
        { combatant_id: 'enemy', participant_role: 'opponent', character_id: null },
      ],
    ])
  ).rows[0]!
}
async function recover(
  battle: Awaited<ReturnType<typeof createBattle>>,
  ids = [character],
  version = 1,
) {
  const terminal = {
    ...battle.snapshot,
    administrativeOutcome: 'NoContest',
    rewardOutcome: 'NoRewards',
    tactical: {
      ...battle.snapshot.tactical,
      battle: { ...battle.snapshot.tactical.battle, lifecycle: 'abandoned', currentTurn: null },
    },
  }
  return db.query<{ result: { outcome: string; replayed: boolean; version: number } }>(
    'select public.recover_master_player_battle_v1($1,$2,$3,$4,$5,$6,$7,true,null) result',
    [
      owner,
      character,
      battle.battle_session_id,
      version,
      ids,
      '00000000-0000-4000-8000-000000000088',
      terminal,
    ],
  )
}
it('caps_derived_preserved, no_identity_role_edit, CAS and repeat support correction', async () => {
  const before = (await read()).rows[0]!.result
  await denied(() => edit({ ...sourceCommand, role: 'game-owner' }), /FIELDS_INVALID/)
  await denied(
    () => edit({ ...sourceCommand, attributes: { ...sourceCommand.attributes, might: 61 } }),
    /POINT_POOL_EXCEEDED|CAP_EXCEEDED/,
  )
  const changed = (await edit(sourceCommand)).rows[0]!.result
  expect(changed.facts).toMatchObject({ level: 1, xp: 0 })
  expect(changed.facts.build.buildVersion).toBeGreaterThan(
    (before.facts as { build: { buildVersion: number } }).build.buildVersion,
  )
  expect(
    (await edit(sourceCommand, request, String(before.fingerprint))).rows[0]!.result.replayed,
  ).toBe(true)
  await denied(
    () => edit({ ...sourceCommand, xp: 100 }, request, String(before.fingerprint)),
    /IDEMPOTENCY_CONFLICT/,
  )
  await denied(
    () => edit(sourceCommand, '00000000-0000-4000-8000-000000000077', String(before.fingerprint)),
    /VERSION_STALE/,
  )
})
it('edit-first stale preparation rolls back head and participants; fresh preparation succeeds then blocks edits', async () => {
  const old = await snapshot()
  await edit(sourceCommand)
  await denied(() => createBattle(old), /PREPARATION_STALE/)
  expect((await db.query('select id from app_private.battle_sessions')).rows).toEqual([])
  expect((await db.query('select * from app_private.battle_participants')).rows).toEqual([])
  await createBattle()
  await denied(() => edit(sourceCommand, '00000000-0000-4000-8000-000000000077'), /BATTLE_ACTIVE/)
})
it.each([undefined, null, '8', 1.5, -1])(
  'every corrected admission requires numeric whole current build capture: %s',
  async (buildVersion) => {
    await edit(sourceCommand)
    const initial = await snapshot()
    initial.buildAuthority.combatants[0]!.buildVersion = buildVersion
    await denied(() => createBattle(initial), /PREPARATION_STALE/)
    expect((await db.query('select id from app_private.battle_sessions')).rows).toEqual([])
  },
)
it('every support-only correction requires BOTH source hash and generation', async () => {
  const old = await snapshot()
  await edit({ kind: 'support', supportActionId: 'basic.recover.mp' })
  const fresh = await snapshot()
  expect(fresh.buildAuthority.combatants[0]!.sourceHash).toEqual(
    old.buildAuthority.combatants[0]!.sourceHash,
  )
  await denied(() => createBattle(old), /PREPARATION_STALE/)
  delete fresh.buildAuthority.combatants[0]!.sourceHash
  await denied(() => createBattle(fresh), /PREPARATION_STALE/)
})
it('shared_recovery_names_all, durable no contest, exact replay, late claims and direct reopening', async () => {
  const battle = await createBattle()
  await denied(() => recover(battle, []), /PARTICIPANTS_CHANGED/)
  await denied(() => recover(battle, [character], 9), /VERSION_STALE/)
  expect((await recover(battle)).rows[0]!.result).toMatchObject({
    outcome: 'NoContest',
    version: 2,
    replayed: false,
  })
  expect((await recover(battle)).rows[0]!.result.replayed).toBe(true)
  for (const name of [
    'commit_battle_intent_v1',
    'commit_battle_intent_v2_inner',
    'commit_battle_intent_v2',
    'commit_battle_intent_v3',
  ]) {
    const args: unknown[] = [
      other,
      request,
      'late-worker',
      other,
      battle.battle_session_id,
      2,
      battle.snapshot,
      [],
    ]
    if (name.endsWith('v3')) args.push(null)
    const result = await db.query<{
      snapshot: { administrativeOutcome: string }
      battle_version: number
    }>(`select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)
    expect(result.rows[0]!.snapshot.administrativeOutcome, name).toBe('NoContest')
    expect(result.rows[0]!.battle_version).toBe(2)
  }
  await denied(
    () =>
      db.query('select * from public.claim_discipline_trial_v1($1,$2)', [
        other,
        battle.battle_session_id,
      ]),
    /NO_REWARDS/,
  )
  await denied(
    () =>
      db.query(
        "update app_private.battle_sessions set lifecycle='active',current_snapshot=$1 where id=$2",
        [battle.snapshot, battle.battle_session_id],
      ),
    /NO_CONTEST/,
  )
  expect(
    (
      await db.query(
        "select * from app_private.product_validation_events where event_name='combat_abandoned'",
      )
    ).rows,
  ).toEqual([])
  expect((await db.query('select * from app_private.discipline_trial_claims')).rows).toEqual([])
  expect((await db.query('select * from app_private.character_xp_grants')).rows).toEqual([])
})
it('normal completion that wins is preserved without administrative attribution', async () => {
  const battle = await createBattle()
  await db.query(
    "update app_private.battle_sessions set lifecycle='completed',current_snapshot=jsonb_set(current_snapshot,'{tactical,battle,lifecycle}','\"completed\"') where id=$1",
    [battle.battle_session_id],
  )
  expect((await recover(battle)).rows[0]!.result.outcome).toBe('AlreadyTerminal')
  expect((await db.query('select * from app_private.battle_no_contest_markers')).rows).toEqual([])
})
it('cleanup failure rolls back marker, head, history and audit together', async () => {
  const battle = await createBattle()
  await db.exec(`create function app_private.task9_fail_cleanup() returns trigger language plpgsql as $$ begin raise exception 'TEST_CLEANUP_FAILURE'; end $$;
    create trigger task9_fail_cleanup before delete on app_private.ai_turn_clocks for each statement execute function app_private.task9_fail_cleanup();`)
  await denied(() => recover(battle), /TEST_CLEANUP_FAILURE/)
  expect((await db.query('select * from app_private.battle_no_contest_markers')).rows).toEqual([])
  expect((await db.query('select * from app_private.player_support_audit')).rows).toEqual([])
  expect(
    (await db.query<{ lifecycle: string }>('select lifecycle from app_private.battle_sessions'))
      .rows[0]!.lifecycle,
  ).toBe('active')
})
