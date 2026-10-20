import { disciplineCorrectionFromForm } from '../../../apps/web/src/master/player-discipline-correction'
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
async function recover(
  battle: Awaited<ReturnType<typeof createBattle>>,
  ids = [character],
  version = 1,
  transform?: (terminal: TestSnapshot) => void,
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
  transform?.(terminal)
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

it('exact old replay lookup returns terminal authority after no contest', async () => {
  const battle = await createBattle()
  await db.query('select * from public.commit_battle_intent_v2($1,$2,$3,$4,$5,1,$6,$7)', [
    other,
    '00000000-0000-4000-8000-000000000066',
    'old-command',
    other,
    battle.battle_session_id,
    battle.snapshot,
    [],
  ])
  await recover(battle, [character], 2)
  const replay = (
    await db.query<{ snapshot: { administrativeOutcome: string }; battle_version: number }>(
      'select * from public.get_battle_intent_replay_v1($1,$2,$3,$4,$5)',
      [
        other,
        '00000000-0000-4000-8000-000000000066',
        'old-command',
        other,
        battle.battle_session_id,
      ],
    )
  ).rows[0]!
  expect(replay.snapshot.administrativeOutcome).toBe('NoContest')
  expect(replay.battle_version).toBe(3)
})
it.each(['character', 'account'])(
  'real %s deletion finalizer removes payload/audit without losing hash-only anti-reopen marker',
  async (kind) => {
    const battle = await createBattle()
    await recover(battle)
    if (kind === 'character') {
      await db.query(
        "insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values($1,$2,now()-interval '2 days',now()-interval '1 day')",
        [character, other],
      )
      await db.query('select app_private.finalize_due_character_deletions_for_user_v1($1)', [other])
    } else {
      await db.query(
        "insert into app_private.account_deletion_requests(user_id,requested_at,delete_after) values($1,now()-interval '2 days',now()-interval '1 day')",
        [other],
      )
      await db.query('select app_private.finalize_account_deletion_for_user_v1($1)', [other])
    }
    expect((await db.query('select * from app_private.battle_sessions')).rows).toEqual([])
    expect((await db.query('select * from app_private.battle_snapshots')).rows).toEqual([])
    expect((await db.query('select * from app_private.battle_no_contests')).rows).toEqual([])
    expect((await db.query('select * from app_private.player_support_audit')).rows).toEqual([])
    expect(
      (await db.query('select * from app_private.battle_no_contest_markers')).rows,
    ).toHaveLength(1)
    await denied(
      () =>
        db.query(
          "insert into app_private.battle_sessions(owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values($1,'players-test',1,1,'active',$2)",
          [owner, battle.snapshot],
        ),
      /NO_CONTEST/,
    )
  },
)
it('late exact creation retry resynchronizes no contest instead of replaying the initial active snapshot', async () => {
  const battle = await createBattle()
  await recover(battle)
  const retry = await createBattle(battle.snapshot)
  expect(
    (retry.snapshot as unknown as { administrativeOutcome: string }).administrativeOutcome,
  ).toBe('NoContest')
  expect(retry.battle_version).toBe(2)
})

it.each(['missing-unit', 'changed-resource', 'changed-policy', 'retained-queue'])(
  'terminal rejects %s without writing a marker',
  async (kind) => {
    const battle = await createBattle()
    await denied(
      () =>
        recover(battle, [character], 1, (terminal) => {
          if (kind === 'missing-unit')
            terminal.tactical.battle.combatants = terminal.tactical.battle.combatants.slice(1)
          if (kind === 'changed-resource') terminal.tactical.battle.combatants[0].hp = 999
          if (kind === 'changed-policy') terminal.effectTimingPolicy = 'invented'
          if (kind === 'retained-queue') terminal.pendingEffects = [{ fake: true }]
        }),
      /SNAPSHOT_INVALID/,
    )
    expect((await db.query('select * from app_private.battle_no_contest_markers')).rows).toEqual([])
  },
)
it('terminal accepts removal of summon bridge rows only', async () => {
  const prepared = await snapshot()
  const raw = prepared
  raw.tactical.battle.combatants.push({ id: 'summon', kind: 'summon', hp: 2, mp: 0 })
  raw.statBridge = {
    schemaVersion: 1,
    combatants: [
      { combatantId: 'enemy', value: 2 },
      { combatantId: 'summon', value: 1 },
    ],
  }
  const battle = await createBattle()
  await db.query('update app_private.battle_sessions set current_snapshot=$1 where id=$2', [
    prepared,
    battle.battle_session_id,
  ])
  battle.snapshot = prepared
  await recover(battle, [character], 1, (terminal) => {
    terminal.tactical.battle.combatants = terminal.tactical.battle.combatants.filter(
      (unit: { id: string }) => unit.id !== 'summon',
    )
    terminal.statBridge!.combatants = terminal.statBridge!.combatants.filter(
      (unit: { combatantId: string }) => unit.combatantId !== 'summon',
    )
  })
})
it('World recovery clears actual block/read battle link while retaining origin, saved progress and prior receipts', async () => {
  await db.query(
    "select * from public.grant_character_xp_v1($1,$2,'prior','test','gameplay','prior-unrelated','test',5)",
    [character, '00000000-0000-4000-8000-000000000098'],
  )
  const grants = (await db.query('select * from app_private.character_xp_grants')).rows
  const state = {
    version: 4,
    position: { sectorId: 'test', x: 2, y: 3 },
    route: [],
    discoveries: { visited: ['test'] },
    safe: true,
  }
  await db.query(
    'insert into app_private.character_world_state(character_id,state) values($1,$2)',
    [character, state],
  )
  const battle = await createBattle()
  await db.query('insert into app_private.world_encounters values($1)', [battle.battle_session_id])
  const world = async () =>
    (
      await db.query<{
        result: { state: unknown; blocked: string | null; battleSessionId: string | null }
      }>('select public.read_world_state_v1($1,$2,$3) result', [other, character, state])
    ).rows[0]!.result
  const beforeWorld = await world()
  expect(beforeWorld.blocked).toBe('WORLD_ACTIVE_BATTLE')
  const receipts = (await db.query('select * from app_private.idempotency_records')).rows
  await recover(battle)
  expect(await world()).toMatchObject({
    state: beforeWorld.state,
    blocked: null,
    battleSessionId: null,
  })
  expect((await db.query('select * from app_private.world_encounters')).rows).toHaveLength(1)
  expect((await db.query('select * from app_private.character_xp_grants')).rows).toEqual(grants)
  expect((await read()).rows[0]!.result.facts).toMatchObject({ xp: 5 })
  expect((await db.query('select * from app_private.idempotency_records')).rows).toEqual(receipts)
  expect(
    (
      await db.query<{ result: unknown }>('select public.ensure_ai_turn_clock_v1($1,$2) result', [
        other,
        battle.battle_session_id,
      ])
    ).rows[0]!.result,
  ).toMatchObject({ active: false })
  expect((await db.query('select * from app_private.ai_turn_clocks')).rows).toEqual([])
})
it.each(['character', 'account'])(
  'shared PvP recovery clears actual clocks, staging, spectators and unselected participant %s deletion payloads',
  async (kind) => {
    const spectator = '00000000-0000-4000-8000-000000000003'
    const peerUser = '00000000-0000-4000-8000-000000000004'
    await db.query('insert into auth.users(id) values($1)', [peerUser])
    await db.query('insert into auth.users(id) values($1)', [spectator])
    const peer = '00000000-0000-4000-8000-000000000012',
      lobby = '00000000-0000-4000-8000-000000000033'
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 select $1,$2,slot_index,rules_version,'Peer','peer',presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at from public.characters where id=$3`,
      [peer, peerUser, character],
    )
    await db.query(
      "insert into app_private.pvp_lobbies(id,lobby_key,mode,owner_user_id,team_a_size,team_b_size) values($1,'AVL-0000-0001','1v1',$2,1,1)",
      [lobby, other],
    )
    await db.query(
      'insert into app_private.pvp_lobby_members(lobby_id,user_id,character_id,team_index,seat_index,ready) values($1,$2,$3,0,0,true),($1,$4,$5,1,0,true)',
      [lobby, other, character, peerUser, peer],
    )
    const prepared = await snapshot()
    prepared.tactical.battle.combatants[1]!.id = `character:${peer}`
    prepared.tactical.battle.combatants.forEach((unit, index) => {
      unit.teamId = `team:${index}`
    })
    const members = [
      {
        combatant_id: `character:${character}`,
        user_id: other,
        character_id: character,
        team_index: 0,
      },
      { combatant_id: `character:${peer}`, user_id: peerUser, character_id: peer, team_index: 1 },
    ]
    const peerBuild = async () =>
      (
        await db.query<{ value: Record<string, unknown> }>(
          'select public.get_character_committed_build_snapshot_v2($1,$2) value',
          [peerUser, peer],
        )
      ).rows[0]!.value
    prepared.buildAuthority.combatants.push({
      ...(await peerBuild()),
      combatantId: `character:${peer}`,
      characterId: peer,
    })
    const peerFingerprint = (
      await db.query<{ value: string }>(
        "select public.read_master_player_v1($1,$2,null)->>'fingerprint' value",
        [owner, peer],
      )
    ).rows[0]!.value
    await db.query('select public.edit_master_player_v1($1,$2,$3,$4,$5,true,null)', [
      owner,
      peer,
      peerFingerprint,
      request,
      { kind: 'support', supportActionId: 'basic.recover.mp' },
    ])
    await denied(
      () =>
        db.query('select * from public.create_pvp_battle_session_v1($1,$2,$3,1,1,$4,$5)', [
          other,
          lobby,
          'players-test',
          prepared,
          members,
        ]),
      /PREPARATION_STALE/,
    )
    expect((await db.query('select * from app_private.battle_sessions')).rows).toEqual([])
    expect((await db.query('select * from app_private.battle_participants')).rows).toEqual([])
    prepared.buildAuthority.combatants[1] = {
      ...(await peerBuild()),
      combatantId: `character:${peer}`,
      characterId: peer,
    }
    const battle = (
      await db.query<Awaited<ReturnType<typeof createBattle>>>(
        'select * from public.create_pvp_battle_session_v1($1,$2,$3,1,1,$4,$5)',
        [other, lobby, 'players-test', prepared, members],
      )
    ).rows[0]!
    await db.query('insert into app_private.ai_turn_clocks values($1,1,$2,now(),now())', [
      battle.battle_session_id,
      `character:${character}`,
    ])
    await db.query(
      'insert into app_private.pvp_active_spectating(user_id,battle_session_id) values($1,$2)',
      [spectator, battle.battle_session_id],
    )
    await db.query(
      'insert into app_private.pvp_battle_spectator_presence(user_id,battle_session_id) values($1,$2)',
      [spectator, battle.battle_session_id],
    )
    expect((await read()).rows[0]!.result.battle).toMatchObject({
      participants: [
        { characterId: character, name: 'Test Player' },
        { characterId: peer, name: 'Peer' },
      ],
    })
    await denied(() => recover(battle, [character]), /PARTICIPANTS_CHANGED/)
    await recover(battle, [peer, character])
    for (const table of [
      'ai_turn_clocks',
      'pvp_turn_clocks',
      'pvp_active_spectating',
      'pvp_battle_spectator_presence',
      'pvp_lobby_members',
    ])
      expect((await db.query(`select * from app_private.${table}`)).rows, table).toEqual([])
    expect(
      (await db.query<{ status: string }>('select status from app_private.pvp_lobbies')).rows[0]!
        .status,
    ).toBe('cancelled')
    expect(
      (
        await db.query<{ result: unknown }>(
          'select public.ensure_pvp_turn_clock_v1($1,$2) result',
          [other, battle.battle_session_id],
        )
      ).rows[0]!.result,
    ).toMatchObject({ active: false })
    await denied(
      () =>
        db.query('select * from public.create_pvp_battle_session_v1($1,$2,$3,1,1,$4,$5)', [
          other,
          lobby,
          'players-test',
          prepared,
          members,
        ]),
      /PVP_LOBBY_NOT_AVAILABLE/,
    )
    if (kind === 'character') {
      await db.query(
        "insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values($1,$2,now()-interval '2 days',now()-interval '1 day')",
        [peer, peerUser],
      )
      await db.query('select app_private.finalize_due_character_deletions_for_user_v1($1)', [
        peerUser,
      ])
    } else {
      await db.query(
        "insert into app_private.account_deletion_requests(user_id,requested_at,delete_after) values($1,now()-interval '2 days',now()-interval '1 day')",
        [peerUser],
      )
      await db.query('select app_private.finalize_account_deletion_for_user_v1($1)', [peerUser])
    }
    expect((await db.query('select * from app_private.battle_sessions')).rows).toEqual([])
    expect((await db.query('select * from app_private.battle_no_contests')).rows).toEqual([])
    expect((await db.query('select * from app_private.player_support_audit')).rows).toEqual([])
    expect(
      (await db.query('select * from app_private.battle_no_contest_markers')).rows,
    ).toHaveLength(1)
    const remainingRead = (await read()).rows[0]!.result
    expect(remainingRead.battle).toBeNull()
    expect(JSON.stringify(remainingRead)).not.toContain(peer)
    expect(JSON.stringify(remainingRead)).not.toContain(peerUser)
  },
)
it('completion-first keeps a real successful trial claim and its repeat receipt', async () => {
  const prepared = await snapshot()
  Object.assign(prepared, {
    statBridge: {
      combatants: [
        {
          combatantId: 'enemy',
          provenance: {
            kind: 'scenario',
            sourceId: 'scenario:p2-7-recruit:vanguard:mastery-trial:standard',
          },
        },
      ],
    },
  })
  const battle = await createBattle(prepared)
  for (const [index, actionId] of [
    'vanguard.forceful-strike',
    'vanguard.cleave',
    'vanguard.forceful-strike',
  ].entries())
    await db.query(
      'insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values($1,1,$2,$3)',
      [
        battle.battle_session_id,
        index,
        { event: 'combat_action_used', actorId: `character:${character}`, actionId },
      ],
    )
  const completed = structuredClone(prepared)
  completed.tactical.battle.lifecycle = 'completed'
  completed.tactical.battle.combatants[1]!.hp = 0
  await db.query(
    "update app_private.battle_sessions set lifecycle='completed',current_snapshot=$1 where id=$2",
    [completed, battle.battle_session_id],
  )
  expect((await recover(battle)).rows[0]!.result.outcome).toBe('AlreadyTerminal')
  const claim = async () =>
    db.query<{ awarded_xp: number; replayed: boolean }>(
      'select * from public.claim_discipline_trial_v1($1,$2)',
      [other, battle.battle_session_id],
    )
  expect((await claim()).rows[0]).toMatchObject({ awarded_xp: 50, replayed: false })
  expect((await claim()).rows[0]).toMatchObject({ awarded_xp: 50, replayed: true })
  expect((await db.query('select * from app_private.discipline_trial_claims')).rows).toHaveLength(1)
})
it('uses the actual level-100 XP ceiling and Primary focus/nonfocus caps', async () => {
  const max = (
    await db.query<{ xp: number }>(
      'select c.cumulative_xp_by_level[c.max_level]::float8 xp from app_private.level_progression_curves c join app_private.progression_cycle_level_curves m on m.curve_version=c.version where m.progression_cycle=1',
    )
  ).rows[0]!.xp
  await denied(() => edit({ ...sourceCommand, xp: max + 1 }), /XP_RANGE/)
  await denied(
    () =>
      edit({ ...sourceCommand, xp: max, attributes: { ...sourceCommand.attributes, might: 61 } }),
    /CAP_EXCEEDED/,
  )
  await denied(
    () =>
      edit({ ...sourceCommand, xp: max, attributes: { ...sourceCommand.attributes, finesse: 41 } }),
    /CAP_EXCEEDED/,
  )
  expect(
    (
      await edit({
        ...sourceCommand,
        xp: max,
        attributes: { ...sourceCommand.attributes, might: 60 },
      })
    ).rows[0]!.result.facts,
  ).toMatchObject({ level: 100, xp: max })
})
it('deleting the initiating Owner removes actor audit linkage but retains the session recovery receipt', async () => {
  const battle = await createBattle()
  await recover(battle)
  await db.query(
    "insert into app_private.account_deletion_requests(user_id,requested_at,delete_after) values($1,now()-interval '2 days',now()-interval '1 day')",
    [owner],
  )
  await db.query('select app_private.finalize_account_deletion_for_user_v1($1)', [owner])
  expect((await db.query('select * from app_private.player_support_audit')).rows).toEqual([])
  expect(
    (await db.query('select terminal_version from app_private.battle_no_contests')).rows,
  ).toHaveLength(1)
})

it('deleting the initiating selected character removes audit actor identity while preserving recovery', async () => {
  const actor = '00000000-0000-4000-8000-000000000055'
  await db.query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    select $1,$2,0,rules_version,'Owner actor','owner-actor',presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at from public.characters where id=$3`,
    [actor, owner, character],
  )
  const fingerprint = String((await read()).rows[0]!.result.fingerprint)
  await db.query('select public.edit_master_player_v1($1,$2,$3,$4,$5,true,$6)', [
    owner,
    character,
    fingerprint,
    request,
    sourceCommand,
    actor,
  ])
  const battle = await createBattle()
  await recover(battle)
  await db.query(
    "insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values($1,$2,now()-interval '2 days',now()-interval '1 day')",
    [actor, owner],
  )
  await db.query('select app_private.finalize_due_character_deletions_for_user_v1($1)', [owner])
  const audit = (await db.query('select * from app_private.player_support_audit')).rows
  expect(JSON.stringify(audit)).not.toContain(actor)
  expect((await db.query('select * from app_private.battle_no_contests')).rows).toHaveLength(1)
})

it.each([
  "select public.search_master_players_v1($1,'Test',$2)",
  'select public.read_master_player_v1($1,$2,$2)',
  "select public.edit_master_player_v1($1,$2,'bad',gen_random_uuid(),'{}',true,$2)",
  'select public.recover_master_player_battle_v1($1,$2,gen_random_uuid(),1,array[$2::uuid],gen_random_uuid(),null,true,$2)',
])('real new operation denies non-Owner even with explicit actor: %s', async (query) => {
  await denied(() => db.query(query, [other, character]), /OWNER_REQUIRED/)
})

it.each(['secondary-add', 'secondary-remove', 'primary-pure', 'primary-retain-secondary'])(
  'actual Discipline authority accepts form command %s and preserves omitted fields',
  async (kind) => {
    const initial = (await read()).rows[0]!.result
    const catalog = initial.disciplines as { id: string; primary: boolean; secondary: boolean }[]
    const secondary = catalog.find((row) => row.secondary && row.id !== 'vanguard')!.id
    const primary = catalog.find(
      (row) => row.primary && row.id !== 'vanguard' && row.id !== secondary,
    )!.id
    if (kind === 'secondary-remove' || kind === 'primary-retain-secondary') {
      await edit({ kind: 'disciplines', secondary })
      // Model elapsed attunement time for the removal case; preserve actual policy.
      if (kind === 'secondary-remove')
        await db.query(
          "update app_private.character_active_builds set secondary_attunement_locked_until=now()-interval '1 day' where character_id=$1",
          [character],
        )
    }
    const before = (await read()).rows[0]!.result
      .facts as import('../../../apps/web/src/master/players').MasterPlayerFacts
    const data = new FormData()
    data.set('primary', kind.startsWith('primary') ? primary : before.build.primary.disciplineId)
    data.set(
      'secondary',
      kind === 'secondary-add' || kind === 'primary-retain-secondary' ? secondary : '',
    )
    const command = disciplineCorrectionFromForm(before.build, data)
    const result = (await edit(command, '00000000-0000-4000-8000-000000000078')).rows[0]!.result
      .facts
    expect(result.build).toMatchObject({
      primary: { disciplineId: kind.startsWith('primary') ? primary : 'vanguard' },
      secondary:
        kind === 'secondary-add' || kind === 'primary-retain-secondary'
          ? { disciplineId: secondary }
          : null,
    })
    expect(result.build.buildVersion).toBeGreaterThan(before.build.buildVersion)
    expect(result.xp).toBe(before.xp)
  },
)

it.each(['initial-host', 'guest-after-correction-and-reward'])(
  'native character fixture is independently valid: %s',
  async (phase) => {
    const native = readFileSync(
      resolve(process.cwd(), '../../.github/scripts/verify-master-players-recovery.py'),
      'utf8',
    )
    const statements = [...native.matchAll(/sql\(f"""([\s\S]*?)"""\)/gu)].map((match) => match[1]!)
    const fixtureUser = '00000000-0000-4000-8000-000000000004'
    const fixtureCharacter = '00000000-0000-4000-8000-000000000014'
    let statement: string
    const replacements: Record<string, string> = {
      user: fixtureUser,
      char: fixtureCharacter,
      guest: fixtureUser,
      guestchar: fixtureCharacter,
    }
    if (phase === 'initial-host') {
      statement = statements.find(
        (sql) => sql.includes('insert into public.characters') && !sql.includes('{guestchar}'),
      )!
    } else {
      await edit(sourceCommand)
      await db.query(
        "select * from public.grant_character_xp_v1($1,$2,'native-fixture','test','gameplay','native-fixture-reward','test',50)",
        [character, '00000000-0000-4000-8000-000000000097'],
      )
      const before = (await read()).rows[0]!.result
        .facts as import('../../../apps/web/src/master/players').MasterPlayerFacts
      expect(before.xp).toBe(50)
      expect(Object.values(before.attributes).reduce((sum, value) => sum + value, 0)).toBe(35)
      await db.query('insert into auth.users(id) values($1)', [fixtureUser])
      statement = statements.find(
        (sql) => sql.includes('insert into public.characters') && sql.includes('{guestchar}'),
      )!
      replacements.char = character
    }
    expect(statement).toBeDefined()
    // Execute the actual Python harness SQL body, not a separately copied seed.
    await db.exec(
      statement.replace(
        /\{(user|char|guest|guestchar)\}/gu,
        (_, key: string) => replacements[key]!,
      ),
    )
    expect(
      (
        await db.query(
          'select level,xp,might+finesse+vitality+agility+intellect+resolve total from public.characters where id=$1',
          [fixtureCharacter],
        )
      ).rows[0],
    ).toMatchObject({ level: 1, xp: 0, total: 36 })
    expect(
      (
        await db.query(
          'select might+finesse+vitality+agility+intellect+resolve spent from app_private.character_attribute_personal_allocations where character_id=$1',
          [fixtureCharacter],
        )
      ).rows[0],
    ).toEqual({ spent: 5 })
  },
)
