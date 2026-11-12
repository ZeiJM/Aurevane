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
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,updated_at timestamptz,created_at timestamptz default now());
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
    if (
      process.env.TASK3_PREDECESSOR === '1' &&
      name.endsWith('_player_correction_allocation_capacity.sql')
    )
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
async function denied(operation: () => Promise<unknown>, message: RegExp) {
  await db.exec('savepoint denied')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint denied')
}
it('exposes only a service-role teleport commit with canonical page authorization', async () => {
  const result = await db.query<{
    allowed: boolean
    client: boolean
  }>(`select has_function_privilege('service_role','public.teleport_master_player_v1(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)','execute') allowed,
  has_function_privilege('authenticated','public.teleport_master_player_v1(uuid,uuid,bigint,uuid,text,integer,integer,integer,text,boolean,uuid)','execute') client`)
  expect(result.rows[0]).toEqual({ allowed: true, client: false })
})

const sectorId = 'atlas:62:28'
const sectorNumber = 28 * 128 + 62 + 1
const geometry = [
  {
    sectorId,
    realmId: null,
    sectorNumber,
    rows: Array(9)
      .fill('.............')
      .map((row, y) => (y === 0 ? '#~l..........' : row)),
    safeCells: [58],
  },
]
const state = {
  version: 5,
  position: { sectorId: 'aureth-crown', x: 1, y: 1 },
  route: [{ position: { sectorId: 'aureth-crown', x: 2, y: 1 }, durationMs: 1100 }],
  nextStepAt: 1,
  routeDestination: { sectorId: 'frostmere', x: 1, y: 2 },
  routeObjectiveId: 'kept-objective',
  discoveries: { 'aureth-crown': [14] },
  completedObjectives: ['preserved'],
  warpedDiscoveries: ['old-observation'],
}
async function seed() {
  await db.query(
    'insert into app_private.character_world_state(character_id,state,last_command_id,last_command_fingerprint) values($1,$2,$3,$4)',
    [character, state, request, 'old'],
  )
  await db.query('select public.install_master_teleport_geometry_v1($1,$2,$3,null)', [
    owner,
    '2026-11-12-v1',
    geometry,
  ])
}
const teleport = (
  expectedVersion = 5,
  x = 6,
  y = 4,
  actor = owner,
  key = request,
  map = 'mainland',
  number = sectorNumber,
) =>
  db.query<{
    result: {
      position: { sectorId: string; x: number; y: number }
      version: number
      replayed: boolean
    }
  }>('select public.teleport_master_player_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,true,null) result', [
    actor,
    character,
    expectedVersion,
    key,
    map,
    number,
    x,
    y,
    'Reviewed stuck player recovery',
  ])
it('atomically relocates, cancels movement, preserves progress, reveals only nearby cells and audits once', async () => {
  await seed()
  const result = (await teleport()).rows[0]!.result
  expect(result).toMatchObject({ position: { sectorId, x: 6, y: 4 }, version: 6, replayed: false })
  const saved = (
    await db.query<{
      state: typeof state
      last_command_id: string | null
      last_command_fingerprint: string | null
    }>('select * from app_private.character_world_state where character_id=$1', [character])
  ).rows[0]!
  expect(saved.state).toMatchObject({
    route: [],
    nextStepAt: null,
    routeDestination: null,
    routeObjectiveId: null,
    completedObjectives: ['preserved'],
    warpedDiscoveries: ['old-observation'],
    discoveries: { 'aureth-crown': [14] },
  })
  expect(saved.state.discoveries[sectorId as keyof typeof saved.state.discoveries]).toHaveLength(25)
  expect(saved.last_command_id).toBeNull()
  expect(saved.last_command_fingerprint).toBeNull()
  expect((await teleport()).rows[0]!.result).toMatchObject({ version: 6, replayed: true })
  expect(
    (
      await db.query(
        "select * from app_private.player_support_audit where action='player.teleport'",
      )
    ).rows,
  ).toHaveLength(1)
  await denied(() => teleport(5, 7), /IDEMPOTENCY/)
})
it('rejects forbidden actors, stale movement versions, unavailable sectors, water, lava and walls without moving', async () => {
  await seed()
  await denied(() => teleport(5, 6, 4, other), /PAGE_ACCESS_REQUIRED/)
  await denied(() => teleport(4), /STALE/)
  await denied(() => teleport(5, 0, 0), /DESTINATION/)
  await denied(() => teleport(5, 1, 0), /DESTINATION/)
  await denied(() => teleport(5, 2, 0), /DESTINATION/)
  await denied(() => teleport(5, 6, 4, owner, request, 'mainland', 1), /DESTINATION/)
  expect(
    (
      await db.query<{ state: typeof state }>(
        'select state from app_private.character_world_state where character_id=$1',
        [character],
      )
    ).rows[0]!.state,
  ).toEqual(state)
})
interface TestSnapshot {
  [key: string]: unknown
  tactical: {
    battle: {
      battleId: string
      rulesVersion: number
      contentVersion: number
      lifecycle: string
      currentTurn: { combatantId: string } | null
      rng: Record<string, unknown>
      combatants: {
        id: string
        teamId?: string
        kind?: string
        hp: number
        mp: number
        temporaryResources?: { key: string; current: number; maximum: number }[]
      }[]
    }
  }
  buildAuthority: {
    combatants: (Record<string, unknown> & { combatantId: string; characterId: string })[]
  }
  statBridge?: {
    schemaVersion?: number
    combatants: ({ combatantId: string } & Record<string, unknown>)[]
  }
}
async function snapshot(): Promise<TestSnapshot> {
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

it('rejects active battle sessions and in-transit ferry state', async () => {
  await seed()
  await db.query(
    `update app_private.character_world_state set state=state||$2::jsonb where character_id=$1`,
    [character, { ferry: { direction: 'outbound', departureAt: 1, arrivalAt: 9999999999999 } }],
  )
  await denied(() => teleport(), /FERRY/)
  await db.query(
    `update app_private.character_world_state set state=state-'ferry' where character_id=$1`,
    [character],
  )
  await createBattle()
  const version = Number(
    (
      await db.query<{ version: number }>(
        "select (state->>'version')::integer version from app_private.character_world_state where character_id=$1",
        [character],
      )
    ).rows[0]!.version,
  )
  await denied(() => teleport(version), /BATTLE_ACTIVE/)
})
it('rejects geometry replacement in the same release and denies browser registry access', async () => {
  await seed()
  await denied(
    () =>
      db.query('select public.install_master_teleport_geometry_v1($1,$2,$3,null)', [
        owner,
        '2026-11-12-v1',
        [{ ...geometry[0], rows: Array(9).fill('sssssssssssss') }],
      ]),
    /GEOMETRY_CONFLICT/,
  )
  const privileges = await db.query<{ allowed: boolean }>(
    `select has_function_privilege('authenticated','public.install_master_teleport_geometry_v1(uuid,text,jsonb,uuid)','execute') allowed`,
  )
  expect(privileges.rows[0]!.allowed).toBe(false)
})
it('chooses the current forced realm from locked settings rather than a caller realm ID', async () => {
  await seed()
  const realms = ['ivory-veil', 'amber-drowned']
  await db.query('select public.install_master_teleport_geometry_v1($1,$2,$3,null)', [
    owner,
    '2026-11-12-v1',
    realms.map((realmId) => ({
      ...geometry[0],
      sectorId: `void:${realmId}:1:1`,
      realmId,
      sectorNumber: 34,
    })),
  ])
  await db.exec(
    `update app_private.world_environment_settings set void_realm_override='amber-drowned', void_realm_override_until_ms=9999999999999`,
  )
  const result = (await teleport(5, 6, 4, owner, request, 'currentVoid', 34)).rows[0]!.result
  expect(result.position.sectorId).toBe('void:amber-drowned:1:1')
  await denied(
    () => teleport(6, 6, 4, owner, '00000000-0000-4000-8000-000000000098', 'ivory-veil', 34),
    /DESTINATION/,
  )
})
it('teleport and ordinary movement invalidate each other through the real world version', async () => {
  await seed()
  await teleport()
  await denied(
    () =>
      db.query("select public.commit_world_state_v1($1,$2,5,$3,'stop',$4,'old-path')", [
        other,
        character,
        '00000000-0000-4000-8000-000000000077',
        { ...state, route: [], nextStepAt: null },
      ]),
    /STALE/,
  )
  const current = (
    await db.query<{ state: typeof state }>(
      'select state from app_private.character_world_state where character_id=$1',
      [character],
    )
  ).rows[0]!.state
  await db.query("select public.commit_world_state_v1($1,$2,6,$3,'stop',$4,'stop-new-head')", [
    other,
    character,
    '00000000-0000-4000-8000-000000000076',
    { ...current, route: [], nextStepAt: null },
  ])
  await denied(() => teleport(6, 6, 4, owner, '00000000-0000-4000-8000-000000000075'), /STALE/)
  expect(
    (
      await db.query<{ version: number }>(
        "select (state->>'version')::integer version from app_private.character_world_state where character_id=$1",
        [character],
      )
    ).rows[0]!.version,
  ).toBe(7)
})
it('uses fresh selected-character page authority and denies a live page revocation even on replay', async () => {
  await seed()
  const defaults = (
    await db.query<{ v: { revision: number; roles: Record<string, string[]> } }>(
      'select public.read_master_panel_role_defaults_v1($1) v',
      [owner],
    )
  ).rows[0]!.v
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
    owner,
    defaults.revision,
    { ...defaults.roles, moderator: ['players'] },
  ])
  await db.query(
    'select public.set_master_panel_character_access_v2($1,$2,$3,$4::text[],$5::text[],null,0,true)',
    [owner, other, character, ['moderator'], []],
  )
  const selectedTeleport = (actorCharacter: string | null) =>
    db.query(
      "select public.teleport_master_player_v1($1,$2,5,$3,'mainland',$4,6,4,'Reviewed recovery',true,$5)",
      [other, character, request, sectorNumber, actorCharacter],
    )
  await denied(() => selectedTeleport(null), /PAGE_ACCESS_REQUIRED/)
  await selectedTeleport(character)
  const nowDefaults = (
    await db.query<{ v: { revision: number; roles: Record<string, string[]> } }>(
      'select public.read_master_panel_role_defaults_v1($1) v',
      [owner],
    )
  ).rows[0]!.v
  await db.query('select public.save_master_panel_role_defaults_v1($1,$2,$3)', [
    owner,
    nowDefaults.revision,
    { ...nowDefaults.roles, moderator: [] },
  ])
  await denied(() => selectedTeleport(character), /PAGE_ACCESS_REQUIRED/)
})
it('can initialize an offline character without fabricating a live presence', async () => {
  await db.query('select public.install_master_teleport_geometry_v1($1,$2,$3,null)', [
    owner,
    '2026-11-12-v1',
    geometry,
  ])
  expect((await teleport(0)).rows[0]!.result.version).toBe(1)
  expect(
    (
      await db.query<{ online: boolean }>(
        "select last_seen_at > clock_timestamp()-interval '40 seconds' online from app_private.character_world_state where character_id=$1",
        [character],
      )
    ).rows[0]!.online,
  ).toBe(false)
})

it('requires a bounded staff reason and binds it into request replay identity', async () => {
  await seed()
  const withReason = (reason: unknown) =>
    db.query("select public.teleport_master_player_v1($1,$2,5,$3,'mainland',$4,6,4,$5,true,null)", [
      owner,
      character,
      request,
      sectorNumber,
      reason,
    ])
  for (const reason of [null, '', '  ', 'ab', 'x'.repeat(241)])
    await denied(() => withReason(reason), /REASON/)
  await withReason('  Reviewed location repair  ')
  await withReason('Reviewed location repair')
  await denied(() => withReason('A different reason'), /IDEMPOTENCY/)
  expect(
    (
      await db.query<{ reason: string }>(
        "select after_facts->>'reason' reason from app_private.player_support_audit where action='player.teleport'",
      )
    ).rows[0]!.reason,
  ).toBe('Reviewed location repair')
})
