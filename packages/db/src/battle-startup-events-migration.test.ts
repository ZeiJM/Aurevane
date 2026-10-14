import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'

let db: PGlite
const owner = '00000000-0000-4000-8000-000000000001',
  other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011',
  target = '00000000-0000-4000-8000-000000000012'
const key = '00000000-0000-4000-8000-000000000099'
const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8')
const start = {
  tactical: {
    battle: {
      battleId: 'startup',
      rulesVersion: 1,
      contentVersion: 1,
      lifecycle: 'active',
      currentTurn: { combatantId: `character:${character}` },
      combatants: [
        { id: `character:${character}`, teamId: 'team:0', hp: 10 },
        { id: `character:${target}`, teamId: 'team:1', hp: 10 },
      ],
    },
  },
}
const final = { ...start, startupPaid: true }
const events = [
  { event: 'mp_spent', combatantId: `character:${target}`, amount: 1, remaining: 9 },
  { event: 'combat_action_used', actorId: `character:${target}`, actionId: 'hidden.child' },
]
const journal = {
  schemaVersion: 1,
  commandVisibility: { kind: 'public' },
  eventVisibilityOverrides: [
    { eventIndex: 1, visibility: { kind: 'team-only', teamId: 'team:1' } },
  ],
}
const participants = [
  { combatant_id: `character:${character}`, participant_role: 'player', character_id: character },
  { combatant_id: `character:${target}`, participant_role: 'opponent', character_id: null },
]
const create = (
  overrides: {
    user?: string
    fingerprint?: string
    events?: unknown
    journal?: unknown
    final?: unknown
  } = {},
) =>
  db.query<{ battle_session_id: string; snapshot: typeof final; replayed: boolean }>(
    'select * from public.create_battle_session_v2($1,$2,$3,$4,$5,1,1,$6,$7,$8,$9,$10)',
    [
      owner,
      key,
      overrides.fingerprint ?? 'same',
      overrides.user ?? owner,
      'startup',
      overrides.final ?? final,
      participants,
      start,
      overrides.events ?? events,
      overrides.journal ?? journal,
    ],
  )
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema app_private;
    create table auth.users(id uuid primary key); create table public.characters(id uuid primary key,user_id uuid);
    insert into auth.users values('${owner}'),('${other}'); insert into public.characters values('${character}','${owner}'),('${target}','${other}');`)
  const foundation = migration('20260815205500_server_architecture_foundation.sql')
  await db.exec(foundation)
  await db.exec(migration('20260817021658_battle_session_persistence.sql'))
  await db.exec(`create table app_private.pvp_lobbies(id uuid primary key,owner_user_id uuid,status text,battle_session_id uuid,battle_key text,team_a_size int,team_b_size int,team_c_size int,updated_at timestamptz);
    create table app_private.pvp_lobby_members(lobby_id uuid,user_id uuid,character_id uuid,team_index int,ready boolean);
    create table app_private.pvp_active_spectating(user_id uuid,battle_session_id uuid);
    create function app_private.pvp_key(text) returns text language sql as 'select $1 || gen_random_uuid()::text';`)
  const pvp = migration('20260820161500_pvp_function_ambiguity_hardening.sql')
  await db.exec(
    pvp.slice(
      pvp.indexOf('create or replace function public.create_pvp'),
      pvp.indexOf('create or replace function public.commit_battle'),
    ),
  )
  await db.exec(migration('20260916140000_battle_privacy_journal_foundation.sql'))
  await db.exec(migration('20260917174436_csr3_battle_history_privacy.sql'))
  await db.exec(migration('20261010210515_captured_ability_startup_events.sql'))
}, 30000)
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})
afterAll(async () => {
  await db?.close()
})
async function rejected(operation: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
}
it('defines the additive service-only atomic creation interface', async () => {
  const result = await db.query<{ allowed: boolean | null }>(
    "select has_function_privilege('service_role',to_regprocedure('public.create_battle_session_v2(text,uuid,text,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)'), 'execute') allowed",
  )
  expect(result.rows[0]!.allowed).toBe(true)
})
it('persists startup state, complete receipts and private visibility once under the predecessor idempotency authority', async () => {
  const created = (await create()).rows[0]!
  expect(created.snapshot).toEqual(final)
  expect(created.replayed).toBe(false)
  expect((await create({ events: [] })).rows[0]!.replayed).toBe(true)
  const persisted = await db.query<{ event: unknown }>(
    'select event from app_private.battle_events where battle_session_id=$1 order by event_index',
    [created.battle_session_id],
  )
  expect(persisted.rows.map((row) => row.event)).toEqual(events)
  const privateHistory = await db.query<{
    journals: { battleVersion: number; eventCount: number; eventVisibilityOverrides: unknown }[]
  }>('select * from public.get_battle_history_privacy_v1($1,$2,array[1]::bigint[])', [
    owner,
    created.battle_session_id,
  ])
  expect(privateHistory.rows[0]!.journals).toEqual([
    expect.objectContaining({
      battleVersion: 1,
      eventCount: 2,
      eventVisibilityOverrides: journal.eventVisibilityOverrides,
    }),
  ])
  await rejected(() => create({ fingerprint: 'changed' }), 'IDEMPOTENCY_CONFLICT')
  await rejected(() => create({ user: other }), 'BATTLE_NOT_AVAILABLE')
})
it.each([
  { events: [null] },
  {
    journal: {
      ...journal,
      eventVisibilityOverrides: [{ eventIndex: 8, visibility: { kind: 'public' } }],
    },
  },
  { final: { ...final, tactical: { battle: { ...start.tactical.battle, battleId: 'foreign' } } } },
])(
  'rolls back predecessor session, snapshot, idempotency and startup rows on invalid startup data',
  async (invalid) => {
    await rejected(() => create(invalid), 'BATTLE_STARTUP_INVALID')
    for (const table of [
      'battle_sessions',
      'battle_snapshots',
      'battle_events',
      'battle_privacy_journal',
      'idempotency_records',
    ])
      expect(
        (await db.query<{ n: number }>(`select count(*)::int n from app_private.${table}`)).rows[0]!
          .n,
      ).toBe(0)
    expect((await create()).rows[0]!.replayed).toBe(false)
  },
)
it('preserves old creation and prevents browser access to startup state, events and RPCs', async () => {
  await db.query('select * from public.create_battle_session_v1($1,$2,$3,$4,$5,1,1,$6,$7)', [
    owner,
    key,
    'same',
    owner,
    'startup',
    start,
    participants,
  ])
  expect(
    (await db.query<{ n: number }>('select count(*)::int n from app_private.battle_events'))
      .rows[0]!.n,
  ).toBe(0)
  await db.exec('set local role authenticated')
  await rejected(() => create(), 'permission denied')
  await rejected(
    () => db.query('select * from app_private.battle_privacy_journal'),
    'permission denied',
  )
  await db.exec('reset role')
})

it.each([false, true])(
  'keeps actual locked PvP lobby admission, startup rollback, terminal result and duplicate receipts coherent (terminal %s)',
  async (terminal) => {
    const lobby = '00000000-0000-4000-8000-000000000033'
    await db.query(
      "insert into app_private.pvp_lobbies values($1,$2,'waiting',null,null,1,1,0,now())",
      [lobby, owner],
    )
    await db.query(
      'insert into app_private.pvp_lobby_members values($1,$2,$3,0,true),($1,$4,$5,1,true)',
      [lobby, owner, character, other, target],
    )
    const members = [
      {
        combatant_id: `character:${character}`,
        user_id: owner,
        character_id: character,
        team_index: 0,
      },
      { combatant_id: `character:${target}`, user_id: other, character_id: target, team_index: 1 },
    ]
    const terminalFinal = terminal
      ? {
          ...final,
          tactical: {
            battle: { ...start.tactical.battle, lifecycle: 'completed', currentTurn: null },
          },
        }
      : final
    const pvp = (user = owner, privacy: unknown = journal, payload: unknown = members) =>
      db.query<{ battle_session_id: string; snapshot: unknown }>(
        'select * from public.create_pvp_battle_session_v2($1,$2,$3,1,1,$4,$5,$6,$7,$8)',
        [user, lobby, 'startup', terminalFinal, payload, start, events, privacy],
      )
    await rejected(() => pvp('00000000-0000-4000-8000-000000000004'), 'PVP_LOBBY_NOT_AVAILABLE')
    await rejected(
      () => pvp(owner, journal, [{ ...members[0], user_id: other }, members[1]]),
      'PVP_PARTICIPANT_MISMATCH',
    )
    await rejected(
      () =>
        pvp(owner, {
          ...journal,
          eventVisibilityOverrides: [{ eventIndex: 88, visibility: { kind: 'public' } }],
        }),
      'BATTLE_STARTUP_INVALID',
    )
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from app_private.battle_sessions'))
        .rows[0]!.n,
    ).toBe(0)
    expect(
      (await db.query<{ status: string }>('select status from app_private.pvp_lobbies')).rows[0]!
        .status,
    ).toBe('waiting')
    const first = (await pvp()).rows[0]!
    expect(first.snapshot).toEqual(terminalFinal)
    expect((await pvp(other)).rows[0]!.battle_session_id).toBe(first.battle_session_id)
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from app_private.battle_events'))
        .rows[0]!.n,
    ).toBe(2)
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from app_private.battle_privacy_journal',
        )
      ).rows[0]!.n,
    ).toBe(1)
    expect(
      (await db.query<{ lifecycle: string }>('select lifecycle from app_private.battle_sessions'))
        .rows[0]!.lifecycle,
    ).toBe(terminal ? 'completed' : 'active')
    const grants = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','public.create_pvp_battle_session_v2(uuid,uuid,text,integer,integer,jsonb,jsonb,jsonb,jsonb,jsonb)','execute') allowed",
    )
    expect(grants.rows[0]!.allowed).toBe(false)
  },
)

it.each(['battle_events', 'battle_privacy_journal'])(
  'rolls back the creation transaction when actual %s insertion fails, then retries once',
  async (table) => {
    await db.exec(`create function app_private.inject_startup_failure() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_STARTUP_INSERT'; end; $$;
    create trigger inject_startup_failure before insert on app_private.${table} for each row execute function app_private.inject_startup_failure();`)
    await rejected(() => create(), 'INJECTED_STARTUP_INSERT')
    for (const name of [
      'battle_sessions',
      'battle_snapshots',
      'battle_events',
      'battle_privacy_journal',
      'idempotency_records',
    ])
      expect(
        (await db.query<{ n: number }>(`select count(*)::int n from app_private.${name}`)).rows[0]!
          .n,
      ).toBe(0)
    await db.exec(
      `drop trigger inject_startup_failure on app_private.${table}; drop function app_private.inject_startup_failure();`,
    )
    const retried = (await create()).rows[0]!
    expect(retried.replayed).toBe(false)
    expect((await create()).rows[0]!.snapshot).toEqual(final)
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from app_private.battle_events'))
        .rows[0]!.n,
    ).toBe(2)
  },
)
