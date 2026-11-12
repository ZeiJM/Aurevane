import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it } from 'vitest'

const owner = '00000000-0000-4000-8000-000000000001'
const staff = '00000000-0000-4000-8000-000000000002'
const selected = '00000000-0000-4000-8000-000000000012'
const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema app_private;
    create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin
      if actor is distinct from '${owner}'::uuid then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;
    create function app_private.assert_master_page_v1(actor uuid, chosen uuid, capability text) returns void language plpgsql as $$ begin
      if actor is distinct from '${staff}'::uuid or chosen is distinct from '${selected}'::uuid or capability <> 'world.manage'
      then raise exception using errcode='42501',message='MASTER_PANEL_PAGE_ACCESS_REQUIRED'; end if; end $$;`)
  for (const name of [
    '20261011030821_world_environment_controls.sql',
    '20261007101310_battlefield_elevation_policy.sql',
    '20261023010443_master_operational_rules_and_world_cycle.sql',
    '20261026062526_independent_elevation_and_weather_cadence.sql',
  ])
    await db.exec(migration(name))
  // The installed delegated overload retains the same body with its selected-page assertion.
  await db.exec(`do $$ declare definition text; begin
    definition := pg_get_functiondef('public.set_world_environment_v2(uuid,integer,jsonb)'::regprocedure);
    definition := replace(definition,'p_settings jsonb)', 'p_settings jsonb, p_actor_character_id uuid)');
    definition := replace(definition,'app_private.assert_game_owner_v1(p_actor)', 'app_private.assert_master_page_v1(p_actor,p_actor_character_id,''world.manage'')');
    execute definition;
  end $$;`)
  await db.exec(migration('20261107123000_warped_continent_shift.sql'))
  const legacyPhase = migration('20261107123900_world_ferry_passages.sql').match(
    /create function app_private.world_warped_phase_v1[\s\S]*?\$\$;/,
  )![0]
  await db.exec(legacyPhase)
  await db.exec(`create table app_private.void_test_legacy_state(state jsonb);
    insert into app_private.void_test_legacy_state values ('{"warpedPhase":42,"discoveries":{"warped:42:3:4":[1,2]},"position":{"sectorId":"warped:42:3:4","x":3,"y":5}}');`)
  const before = (await db.query('select * from app_private.void_test_legacy_state')).rows
  const phaseBefore = (
    await db.query('select app_private.world_warped_phase_v1(1800000000000) phase')
  ).rows
  await db.exec(migration('20261112114943_void_realm_rotation.sql'))
  expect((await db.query('select * from app_private.void_test_legacy_state')).rows).toEqual(before)
  expect(
    (await db.query('select app_private.world_warped_phase_v1(1800000000000) phase')).rows,
  ).toEqual(phaseBefore)
}, 30_000)
afterAll(async () => await db?.close())
const change = { dayLengthMinutes: 1440, timeOffsetMinutes: 0, frozenMinuteOfDay: null }
async function read() {
  return (
    await db.query<{ v: Record<string, unknown> }>('select public.read_world_environment_v1() v')
  ).rows[0]!.v
}
async function set(
  version: number,
  extra: Record<string, unknown>,
  actor = owner,
  character?: string,
) {
  const args: unknown[] = [actor, version, JSON.stringify({ ...change, ...extra })]
  if (character !== undefined) args.push(character)
  return (
    await db.query<{ v: Record<string, unknown> }>(
      `select public.set_world_environment_v2($1,$2,$3::jsonb${character === undefined ? '' : ',$4'}) v`,
      args,
    )
  ).rows[0]!.v
}

it('matches shared seeded draw vectors over all eight maps with repeat draws and exact UTC boundaries', async () => {
  expect(await read()).toMatchObject({
    warpedShiftMinutes: 1440,
    voidRealmOverride: null,
    voidRealmOverrideUntilMs: null,
  })
  const vectors = [
    [0, 'amber-drowned'],
    [1, 'glass-tides'],
    [20_000, 'starfall-basin'],
    [20_001, 'amber-drowned'],
    [-1, 'hollow-orchard'],
  ]
  for (const [phase, realm] of vectors)
    expect(
      (
        await db.query<{ v: string }>('select app_private.world_void_realm_at_phase_v1($1) v', [
          phase,
        ])
      ).rows[0]!.v,
    ).toBe(realm)
  expect(
    (await db.query<{ v: unknown }>('select app_private.world_void_rotation_v1(86399999) v'))
      .rows[0]!.v,
  ).toEqual({ realmId: 'amber-drowned', source: 'live', nextRollAt: 86_400_000 })
  const rows = (
    await db.query<{ id: string }>(
      'select app_private.world_void_realm_at_phase_v1(n) id from generate_series(20000,20100) n',
    )
  ).rows
  expect(new Set(rows.map((row) => row.id)).size).toBe(8)
  expect(rows.some((row, index) => row.id === rows[index + 1]?.id)).toBe(true)
})

it('persists immediate shared force, keeps or clears it atomically, and audits without changing historic expeditions', async () => {
  const forced = await set(0, { voidRealm: 'glass-tides' })
  expect(forced).toMatchObject({ version: 1, voidRealmOverride: 'glass-tides' })
  const expiry = Number(forced.voidRealmOverrideUntilMs)
  expect(expiry % 86_400_000).toBe(0)
  for (const at of [expiry - 60_000, expiry - 1])
    expect(
      (await db.query<{ v: unknown }>('select app_private.world_void_rotation_v1($1) v', [at]))
        .rows[0]!.v,
    ).toEqual({ realmId: 'glass-tides', source: 'master', nextRollAt: expiry })
  const expired = (
    await db.query<{ v: Record<string, unknown> }>(
      'select app_private.world_void_rotation_v1($1) v',
      [expiry],
    )
  ).rows[0]!.v
  expect(expired.source).toBe('live')
  expect(expired.nextRollAt).toBe(expiry + 86_400_000)
  expect(await set(1, { voidRealm: 'unchanged', dayLengthMinutes: 120 })).toMatchObject({
    version: 2,
    voidRealmOverride: 'glass-tides',
    voidRealmOverrideUntilMs: expiry,
  })
  expect(await set(2, { voidRealm: 'unchanged', warpedShiftMinutes: 1 })).toMatchObject({
    version: 3,
    voidRealmOverride: 'glass-tides',
  })
  const retained = await read()
  expect(Number(retained.voidRealmOverrideUntilMs)).toBeLessThanOrEqual(expiry)
  expect(Number(retained.voidRealmOverrideUntilMs) % 60_000).toBe(0)
  await expect(set(2, { voidRealm: 'ivory-veil' })).rejects.toThrow(
    'WORLD_ENVIRONMENT_VERSION_CONFLICT',
  )
  expect(await set(3, { voidRealm: null })).toMatchObject({
    version: 4,
    voidRealmOverride: null,
    voidRealmOverrideUntilMs: null,
  })
  expect(
    (
      await db.query<{ v: unknown }>(
        'select after_settings v from app_private.world_environment_audit where version=1',
      )
    ).rows[0]!.v,
  ).toEqual(forced)
  await expect(
    db.exec("update app_private.world_environment_audit set reason='tampered' where version=1"),
  ).rejects.toThrow('WORLD_ENVIRONMENT_AUDIT_IMMUTABLE')
})

it('retains Owner and selected-character page authorization, validates IDs and denies direct public access', async () => {
  const before = await read()
  const version = Number(before.version)
  for (const voidRealm of ['missing', '', 42, true, {}, []])
    await expect(set(version, { voidRealm })).rejects.toThrow('INVALID_WORLD_ENVIRONMENT')
  await expect(set(version, { voidRealm: 'ivory-veil' }, staff)).rejects.toThrow(
    'GAME_OWNER_REQUIRED',
  )
  await expect(set(version, { voidRealm: 'ivory-veil' }, staff, owner)).rejects.toThrow(
    'MASTER_PANEL_PAGE_ACCESS_REQUIRED',
  )
  expect(await read()).toEqual(before)
  const result = await set(version, { voidRealm: 'ivory-veil' }, staff, selected)
  expect(result).toMatchObject({ version: version + 1, voidRealmOverride: 'ivory-veil' })
  expect(
    (
      await db.query<{ actor: string }>(
        'select actor_user_id actor from app_private.world_environment_audit where version=$1',
        [version + 1],
      )
    ).rows[0]!.actor,
  ).toBe(staff)
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await expect(
      db.query('select public.set_world_environment_v2($1,$2,$3::jsonb)', [
        owner,
        version,
        JSON.stringify(change),
      ]),
    ).rejects.toThrow('permission denied')
    await expect(db.query('select app_private.world_void_rotation_v1(0)')).rejects.toThrow(
      'permission denied',
    )
    await db.exec('reset role')
  }
})

it('cannot revive an expired force on keep-current and keeps no-op saves out of the audit', async () => {
  await db.exec('update app_private.world_environment_settings set void_realm_override_until_ms=1')
  const version = Number((await read()).version)
  const cleared = await set(version, { voidRealm: 'unchanged' })
  expect(cleared).toMatchObject({
    version: version + 1,
    voidRealmOverride: null,
    voidRealmOverrideUntilMs: null,
  })
  const history = (await db.query('select * from app_private.world_environment_audit order by id'))
    .rows
  expect(await set(version + 1, { voidRealm: 'unchanged' })).toEqual(cleared)
  expect(
    (await db.query('select * from app_private.world_environment_audit order by id')).rows,
  ).toEqual(history)
})
