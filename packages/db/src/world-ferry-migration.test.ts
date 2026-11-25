import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const user = '11111111-1111-4111-8111-111111111111'
const player = '22222222-2222-4222-8222-222222222222'
const second = '33333333-3333-4333-8333-333333333333'
const command = '44444444-4444-4444-8444-444444444444'
const disembark = '55555555-5555-4555-8555-555555555555'
const departure = 1_800_000_000_000
const currentDeparture = 1_800_002_460_000
const terminal = { sectorId: 'atlas:126:33', x: 6, y: 8 }
const dock = { ...terminal, x: 5 }
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
  await db.exec(migration('20261119101500_mainland_ferry_terminal'))
  await db.exec(migration('20261119114000_uncharted_coastal_ferry_terminals'))
  await db.exec(migration('20261123011000_asterwake_ferry'))
  await db.exec(migration('20261124110000_world_ferry_boarding_tickets'))
  await clock(departure - 1)
  await db.exec(`
    insert into app_private.character_world_state(character_id,state)
      values ('${player}', '${JSON.stringify({
        ...state,
        ferryTicket: { direction: 'outbound', departureAt: departure, sectorId: dock.sectorId },
      })}'), ('${second}', '${JSON.stringify({
        ...state,
        ferry: { direction: 'outbound', departureAt: departure, arrivalAt: departure + 300_000 },
      })}');
  `)
  await db.exec(migration('20261124200902_world_ferry_crossing_schedule'))
  const { rows } = await db.query<{ state: Record<string, unknown> }>(
    'select state from app_private.character_world_state order by character_id',
  )
  expect(rows.map((row) => row.state)).toEqual([
    {
      ...state,
      version: 2,
      ferryTicket: {
        direction: 'outbound',
        departureAt: currentDeparture,
        sectorId: dock.sectorId,
      },
    },
    {
      ...state,
      ferry: { direction: 'outbound', departureAt: departure, arrivalAt: departure + 300_000 },
    },
  ])
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
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position}',$2::jsonb) where character_id=$1",
      [player, JSON.stringify({ sectorId: 'atlas:126:32', x: 6, y: 4 })],
    )
    await expect(passage()).rejects.toThrow('WORLD_FERRY_PORT')
    await clock(departure)
    await db.query(
      "update app_private.character_world_state set state=jsonb_set(state,'{position}',$2::jsonb) where character_id=$1",
      [player, JSON.stringify(dock)],
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
      position: { sectorId: 'void:glass-tides:1:11', x: 1, y: 4 },
      discoveries: { 'void:glass-tides:1:11': expect.arrayContaining([26, 53, 81]) },
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
      position: terminal,
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
      position: { sectorId: 'void:cinder-choir:6:12', x: 4, y: 6 },
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

it('boards and settles both Asterwake legs at their real terminals and preserves shared receipts', async () => {
  const north = { sectorId: 'atlas:126:30', x: 6, y: 0 }
  const island = { sectorId: 'atlas:4:15', x: 6, y: 8 }
  const outbound = departure + 900_000
  const inbound = departure + 2_700_000
  await db.query(
    "update app_private.character_world_state set state=jsonb_set(state,'{position}',$2::jsonb) where character_id=$1",
    [player, JSON.stringify(north)],
  )
  await clock(outbound - 300_001)
  await expect(passage()).rejects.toThrow('WORLD_FERRY_WINDOW')
  await clock(outbound - 300_000)
  const boarded = await passage()
  expect(boarded).toMatchObject({
    position: { sectorId: `ferry:asterwake-outbound:${outbound}`, x: 6, y: 4 },
    ferry: { direction: 'asterwake-outbound', origin: north, arrivalAt: outbound + 300_000 },
    version: 2,
  })
  await expect(passage()).resolves.toEqual(boarded)
  await clock(outbound + 300_000)
  await expect(read()).resolves.toMatchObject({ position: island, version: 3 })
  await clock(inbound - 300_000)
  await expect(passage(disembark, 3)).resolves.toMatchObject({
    position: { sectorId: `ferry:asterwake-return:${inbound}`, x: 6, y: 4 },
    ferry: { direction: 'asterwake-return', origin: island, arrivalAt: inbound + 300_000 },
    version: 4,
  })
  await clock(inbound + 300_000)
  await expect(read()).resolves.toMatchObject({ position: north, version: 5 })
})

describe('boarding reservations for a scheduled sailing', () => {
  const boarding = '77777777-7777-4777-8777-777777777777'
  const retry = '88888888-8888-4888-8888-888888888888'
  const reboard = '99999999-9999-4999-8999-999999999999'

  async function ticketCommand(
    kind: string,
    version: number,
    id: string,
    sailing = currentDeparture,
  ) {
    const { rows } = await db.query<{ state: unknown }>(
      'select public.commit_world_ferry_v3($1,$2,$3,$4,$5,$6,$7) as state',
      [user, player, version, id, kind, id, kind === 'leave-ferry' ? null : sailing],
    )
    return rows[0]?.state
  }

  it('buys early at no cost and requires the ticket for boarding and reboarding', async () => {
    await clock(currentDeparture - 2_700_000)
    const purchased = await ticketCommand('buy-ferry-boarding', 1, command)
    const ferryTicket = {
      direction: 'outbound',
      departureAt: currentDeparture,
      sectorId: dock.sectorId,
    }
    expect(purchased).toMatchObject({ version: 2, position: dock, ferryTicket })
    expect(purchased).not.toHaveProperty('ferry')
    await expect(ticketCommand('buy-ferry-boarding', 1, command)).resolves.toEqual(purchased)
    await expect(ticketCommand('buy-ferry-boarding', 2, retry)).resolves.toEqual(purchased)
    await clock(currentDeparture - 600_001)
    await expect(ticketCommand('board-ferry', 2, boarding)).rejects.toThrow(
      'WORLD_FERRY_BOARDING_CLOSED',
    )
    await clock(currentDeparture - 600_000)
    await expect(ticketCommand('board-ferry', 2, boarding)).resolves.toMatchObject({
      version: 3,
      position: { sectorId: `ferry:outbound:${currentDeparture}`, x: 6, y: 4 },
      ferry: { departureAt: currentDeparture, arrivalAt: currentDeparture + 1_500_000 },
    })
    await expect(ticketCommand('leave-ferry', 3, disembark)).resolves.toMatchObject({
      version: 4,
      position: dock,
      ferryTicket,
    })
    await expect(ticketCommand('board-ferry', 4, reboard)).resolves.toMatchObject({
      version: 5,
      ferry: { departureAt: currentDeparture },
    })
    await clock(currentDeparture)
    await expect(
      ticketCommand('leave-ferry', 5, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).rejects.toThrow('WORLD_FERRY_UNDERWAY')
    await clock(currentDeparture + 1_500_000)
    const landed = await read()
    expect(landed).not.toHaveProperty('ferryTicket')
    expect(landed).not.toHaveProperty('ferry')
  })

  it('rejects a missed or stale sailing without moving the passenger or transferring the ticket', async () => {
    await clock(currentDeparture - 1)
    await ticketCommand('buy-ferry-boarding', 1, command)
    await clock(currentDeparture)
    await expect(ticketCommand('board-ferry', 2, boarding)).rejects.toThrow('WORLD_FERRY_WINDOW')
    await expect(ticketCommand('buy-ferry-boarding', 2, retry)).rejects.toThrow(
      'WORLD_FERRY_WINDOW',
    )
    const later = currentDeparture + 4_200_000
    await expect(ticketCommand('board-ferry', 2, boarding, later)).rejects.toThrow(
      'WORLD_FERRY_BOARDING_CLOSED',
    )
    await clock(later - 600_000)
    await expect(ticketCommand('board-ferry', 2, boarding, later)).rejects.toThrow(
      'WORLD_FERRY_TICKET_REQUIRED',
    )
    await expect(read()).resolves.toMatchObject({ version: 2, position: dock })
    await expect(ticketCommand('buy-ferry-boarding', 2, retry, later)).resolves.toMatchObject({
      version: 3,
      position: dock,
      ferryTicket: { departureAt: later },
    })
  })

  it('gives only the service role access to boarding authority', async () => {
    const { rows } = await db.query(`
      select has_function_privilege('authenticated','public.commit_world_ferry_v3(uuid,uuid,bigint,uuid,text,text,bigint)','execute') as direct,
             has_function_privilege('service_role','public.commit_world_ferry_v3(uuid,uuid,bigint,uuid,text,text,bigint)','execute') as service,
             has_function_privilege('anon','public.commit_world_ferry_v3(uuid,uuid,bigint,uuid,text,text,bigint)','execute') as anonymous,
             has_function_privilege('service_role','public.commit_world_ferry_v2(uuid,uuid,bigint,uuid,text,text,bigint)','execute') as previous,
             has_function_privilege('service_role','public.commit_world_ferry_v1(uuid,uuid,bigint,uuid,text,text)','execute') as legacy
    `)
    expect(rows).toEqual([
      { direct: false, service: true, anonymous: false, previous: false, legacy: false },
    ])
  })
})
