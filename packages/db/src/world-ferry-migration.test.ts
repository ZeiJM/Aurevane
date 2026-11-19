import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const user = '11111111-1111-4111-8111-111111111111'
const player = '22222222-2222-4222-8222-222222222222'
const second = '33333333-3333-4333-8333-333333333333'
const command = '44444444-4444-4444-8444-444444444444'
const disembark = '55555555-5555-4555-8555-555555555555'
const departure = 1_800_000_000_000
const dock = { sectorId: 'atlas:126:32', x: 5, y: 4 }
const state = { position: dock, version: 1, route: [], nextStepAt: null }
const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}.sql`, import.meta.url), 'utf8')
const embarkationSql = '20261118170000_world_ferry_active_uncharted'
let db: PGlite

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema app_private;
    create table public.characters (id uuid primary key, user_id uuid not null);
    create table app_private.character_deletion_requests (character_id uuid primary key);
    create table app_private.character_world_state (
      character_id uuid primary key, state jsonb not null, last_command_id uuid,
      last_command_fingerprint text, last_seen_at timestamptz
    );
    create table app_private.world_environment_settings (
      warped_shift_minutes integer not null, singleton boolean default true,
      void_realm_override text, void_realm_override_until_ms bigint
    );
    create table app_private.test_ferry_clock (now_ms bigint not null, block text);
    insert into app_private.world_environment_settings(warped_shift_minutes) values (1440);
    insert into app_private.test_ferry_clock values (0, null);
    create function app_private.world_block_reason_v1(uuid, uuid) returns text
      language sql as $$ select block from app_private.test_ferry_clock $$;
    create function public.read_world_state_v1(p_user_id uuid, p_character_id uuid, p_initial_state jsonb)
      returns jsonb language sql as $$ select state from app_private.character_world_state
        where character_id=p_character_id $$;
    insert into public.characters values ('${player}', '${user}'), ('${second}', '${second}');
  `)
  await db.exec(migration('20261107123900_world_ferry_passages'))
  await db.exec(`create or replace function app_private.world_ferry_now_v1() returns bigint
    language sql volatile as $$ select now_ms from app_private.test_ferry_clock $$;`)
  const rotation = migration('20261112114943_void_realm_rotation')
  await db.exec(
    rotation.slice(rotation.indexOf('-- Same seeded draw'), rotation.indexOf('-- Extend both')),
  )
  const evacuation = migration('20261114113000_world_void_pre_rotation_return')
  await db.exec(
    evacuation
      .slice(evacuation.indexOf('create function'), evacuation.indexOf('-- Upgrade already'))
      .replace(
        'floor(extract(epoch from clock_timestamp()) * 1000)::bigint',
        'app_private.world_ferry_now_v1()',
      ),
  )
  await db.exec(migration(embarkationSql))
}, 30_000)
beforeEach(async () => {
  await db.exec(`
    delete from app_private.world_ferry_receipts;
    delete from app_private.world_ferry_trips;
    delete from app_private.character_world_state;
    update app_private.world_environment_settings set warped_shift_minutes=1440,
      void_realm_override=null, void_realm_override_until_ms=null;
    insert into app_private.character_world_state(character_id,state)
      values ('${player}', '${JSON.stringify(state)}'), ('${second}', '${JSON.stringify(state)}');
  `)
  await clock(departure - 300_000)
})
afterAll(async () => await db.close())

async function clock(now: number, block: string | null = null) {
  await db.query('update app_private.test_ferry_clock set now_ms=$1, block=$2', [now, block])
}
async function forceRealm(realm: string) {
  await db.query(
    'update app_private.world_environment_settings set void_realm_override=$1, void_realm_override_until_ms=$2',
    [realm, departure + 86_400_000],
  )
}
async function legacyTrip() {
  await db.query(
    "insert into app_private.world_ferry_trips(direction,departure_at,warped_phase) values ('outbound',$1,$2)",
    [departure, Math.floor(departure / 86_400_000)],
  )
}
async function passage(
  id = command,
  version = 1,
  kind = 'board-ferry',
  actor = user,
  character = player,
  signature = id,
) {
  const { rows } = await db.query<{ state: unknown }>(
    'select public.commit_world_ferry_v1($1,$2,$3,$4,$5,$6) as state',
    [actor, character, version, id, kind, signature],
  )
  return rows[0]?.state
}
async function read() {
  const { rows } = await db.query<{ state: unknown }>(
    "select public.read_world_state_v1($1,$2,'{}'::jsonb) as state",
    [user, player],
  )
  return rows[0]?.state
}

describe('durable world ferry authority', () => {
  it('checks the real cutoff, ownership, range and ordinary activity block', async () => {
    await clock(departure - 300_001)
    await expect(passage()).rejects.toThrow('WORLD_FERRY_WINDOW')
    await clock(departure - 300_000, 'WORLD_ACTIVE_BATTLE')
    await expect(passage()).rejects.toThrow('WORLD_ACTIVE_BATTLE')
    await clock(departure - 300_000)
    await expect(passage(command, 1, 'board-ferry', second)).rejects.toThrow('WORLD_NOT_OWNED')
    await expect(passage(command, 2)).rejects.toMatchObject({ code: 'PT409' })
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','3') where character_id=$1",
      [player],
    )
    await expect(passage()).rejects.toThrow('WORLD_FERRY_PORT')
    await clock(departure)
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','5') where character_id=$1",
      [player],
    )
    await expect(passage()).rejects.toThrow('WORLD_FERRY_WINDOW')
    await expect(read()).resolves.toMatchObject(state)
  })

  it('boards both characters on one pinned trip and disembarks only before departure', async () => {
    const boarded = await passage()
    expect(boarded).toMatchObject({
      version: 2,
      position: { sectorId: `ferry:outbound:${departure}`, x: 6, y: 4 },
      ferry: { departureAt: departure, arrivalAt: departure + 300_000 },
    })
    await db.exec('update app_private.world_environment_settings set warped_shift_minutes=720')
    await expect(passage(command, 1, 'board-ferry', second, second)).resolves.toEqual(boarded)
    await expect(passage()).resolves.toEqual(boarded)
    await expect(passage(command, 1, 'board-ferry', user, player, 'forged')).rejects.toThrow(
      'WORLD_COMMAND_CONFLICT',
    )
    await expect(passage(disembark, 2, 'leave-ferry')).resolves.toMatchObject({
      version: 3,
      position: dock,
    })
    await expect(passage()).resolves.toMatchObject({ version: 3, position: dock })
    await clock(departure)
    await expect(passage(disembark, 2, 'leave-ferry', second, second)).rejects.toThrow(
      'WORLD_FERRY_UNDERWAY',
    )
  })

  it('settles once after reconnect, preserves battle until safe, and returns on the hourly reverse leg', async () => {
    await passage()
    await forceRealm('glass-tides')
    await clock(departure + 299_999)
    await expect(read()).resolves.toMatchObject({ version: 2, ferry: { direction: 'outbound' } })
    await clock(departure + 300_000, 'WORLD_ACTIVE_BATTLE')
    await expect(read()).resolves.toMatchObject({ version: 2, ferry: { direction: 'outbound' } })
    await clock(departure + 300_001)
    const landed = {
      version: 3,
      position: { sectorId: 'void:glass-tides:3:11', x: 6, y: 4 },
      discoveries: { 'void:glass-tides:3:11': expect.arrayContaining([30, 58, 86]) },
    }
    await expect(read()).resolves.toMatchObject(landed)
    await expect(read()).resolves.toMatchObject(landed)
    expect(await read()).not.toHaveProperty('warpedPhase')
    const reverse = departure + 1_800_000
    await clock(reverse - 300_000)
    await expect(passage(disembark, 3)).resolves.toMatchObject({
      version: 4,
      ferry: { direction: 'return', departureAt: reverse },
    })
    await clock(reverse + 300_000)
    const returned = await read()
    expect(returned).toMatchObject({
      version: 5,
      position: { sectorId: 'atlas:126:32', x: 6, y: 4 },
    })
    expect(returned).not.toHaveProperty('ferry')
    expect(returned).not.toHaveProperty('warpedPhase')
  })

  it('keeps an old expedition while away and changes the phase only at the idle landing', async () => {
    await legacyTrip()
    await passage()
    await clock(departure + 300_000)
    const old = Math.floor((departure + 300_000) / 86_400_000)
    await expect(read()).resolves.toMatchObject({ version: 3, warpedPhase: old })
    await clock(departure + 86_400_000, 'WORLD_ACTIVE_BATTLE')
    await expect(read()).resolves.toMatchObject({ version: 3, warpedPhase: old })
    await clock(departure + 86_400_000)
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','5') where character_id=$1",
      [player],
    )
    await expect(read()).resolves.toMatchObject({ version: 3, warpedPhase: old })
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','6') where character_id=$1",
      [player],
    )
    await expect(read()).resolves.toMatchObject({ version: 4, warpedPhase: old + 1 })
    await expect(read()).resolves.toMatchObject({ version: 4, warpedPhase: old + 1 })
  })

  it('returns an expired outbound passage to Umbral March once', async () => {
    await passage()
    await clock(departure + 86_400_000)
    const returned = { version: 3, position: { sectorId: 'umbral-march', x: 6, y: 4 } }
    await expect(read()).resolves.toMatchObject(returned)
    await expect(read()).resolves.toMatchObject(returned)
  })

  it('keeps an on-time arrival out of the final minute before rotation', async () => {
    await db.exec('update app_private.world_environment_settings set warped_shift_minutes=6')
    await passage()
    await clock(departure + 300_000)
    await expect(read()).resolves.toMatchObject({
      version: 3,
      position: { sectorId: 'umbral-march', x: 6, y: 4 },
    })
  })

  it('keeps the evacuation deadline when disembarking early and sends expired origins to Umbral March', async () => {
    await db.exec('update app_private.world_environment_settings set warped_shift_minutes=30')
    await passage()
    await forceRealm('cinder-choir')
    await clock(departure + 300_000)
    await read()
    const reverse = departure + 1_800_000
    const returnAt = reverse - 60_000
    await db.exec('update app_private.world_environment_settings set warped_shift_minutes=1440')
    await clock(reverse - 300_000)
    await passage(disembark, 3)
    const cancel = '66666666-6666-4666-8666-666666666666'
    await passage(cancel, 4, 'leave-ferry')
    await expect(read()).resolves.toMatchObject({
      version: 5,
      position: { sectorId: 'void:cinder-choir:4:13', x: 6, y: 4 },
      voidReturnAt: returnAt,
    })
    await passage('77777777-7777-4777-8777-777777777777', 5)
    await clock(returnAt)
    await expect(
      passage('88888888-8888-4888-8888-888888888888', 6, 'leave-ferry'),
    ).resolves.toMatchObject({
      version: 7,
      position: { sectorId: 'umbral-march', x: 6, y: 4 },
    })
  })

  it('keeps trip data and direct mutation functions inaccessible to player roles', async () => {
    const { rows } = await db.query<{ board: boolean; settle: boolean; trips: boolean }>(`
      select has_function_privilege('authenticated','public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)','execute') as board,
             has_function_privilege('authenticated','app_private.settle_world_ferry_v1(uuid,uuid)','execute') as settle,
             has_table_privilege('authenticated','app_private.world_ferry_trips','select') as trips
    `)
    expect(rows[0]).toEqual({ board: false, settle: false, trips: false })
  })
})
