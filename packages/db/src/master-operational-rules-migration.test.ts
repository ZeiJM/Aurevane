import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
const owner = '00000000-0000-0000-0000-000000000001'
const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
it('saves reason-free rules and cycles with Owner/CAS/private audit authority and preserves weather expiry', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role; create schema app_private; create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '${owner}'::uuid then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`,
    )
    await db.exec(migration('20261011030821_world_environment_controls.sql'))
    // The existing history and readers remain in place through this additive migration.
    const { readdirSync } = await import('node:fs')
    const elevation = readdirSync(resolve(process.cwd(), '../../supabase/migrations')).find(
      (name) => name.endsWith('_battlefield_elevation_policy.sql'),
    )!
    await db.exec(migration(elevation))
    await db.exec(migration('20261023010443_master_operational_rules_and_world_cycle.sql'))
    const change = {
      dayLengthMinutes: 120,
      timeOffsetMinutes: 30,
      frozenMinuteOfDay: null,
      weatherOverride: 'rain',
      weatherOverrideUntilMs: Date.now() + 37 * 60_000,
    }
    const set = (version: number, value: unknown, actor = owner) =>
      db.query<{ value: Record<string, unknown> }>(
        'select public.set_world_environment_v2($1,$2,$3::jsonb) value',
        [actor, version, JSON.stringify(value)],
      )
    await expect(set(0, change, '00000000-0000-0000-0000-000000000002')).rejects.toThrow(
      'GAME_OWNER_REQUIRED',
    )
    for (const value of [0, 1.5, 10081])
      await expect(set(0, { ...change, dayLengthMinutes: value })).rejects.toThrow(
        'INVALID_WORLD_ENVIRONMENT',
      )
    await expect(set(0, { ...change, weatherOverrideUntilMs: null })).rejects.toThrow(
      'INVALID_WORLD_ENVIRONMENT',
    )
    await expect(set(0, { ...change, weatherOverrideUntilMs: 1 })).rejects.toThrow(
      'INVALID_WORLD_ENVIRONMENT',
    )
    expect((await set(0, change)).rows[0]!.value).toMatchObject({ version: 1, ...change })
    await expect(set(0, change)).rejects.toThrow('WORLD_ENVIRONMENT_VERSION_CONFLICT')
    const next = (
      await set(1, { dayLengthMinutes: 60, timeOffsetMinutes: 0, frozenMinuteOfDay: null })
    ).rows[0]!.value
    expect(next).toMatchObject({
      version: 2,
      dayLengthMinutes: 60,
      weatherOverride: 'rain',
      weatherOverrideUntilMs: change.weatherOverrideUntilMs,
    })
    await set(2, { ...change, weatherOverride: null, weatherOverrideUntilMs: null })
    const audit = await db.query<{ reason: null; actor_user_id: string; after_settings: unknown }>(
      'select reason,actor_user_id,after_settings from app_private.world_environment_audit order by id',
    )
    expect(audit.rows).toHaveLength(3)
    expect(audit.rows.every((row) => row.reason === null && row.actor_user_id === owner)).toBe(true)
    await expect(db.exec('delete from app_private.world_environment_audit')).rejects.toThrow(
      'WORLD_ENVIRONMENT_AUDIT_IMMUTABLE',
    )
    const chances = { level1BasisPoints: 1234, level2BasisPoints: 8766, level3BasisPoints: 0 }
    const elevate = (version: number, value = chances, actor = owner) =>
      db.query('select public.publish_battlefield_elevation_policy_v2($1,$2,$3::jsonb)', [
        actor,
        version,
        JSON.stringify(value),
      ])
    await expect(elevate(1, { ...chances, level1BasisPoints: 0 })).rejects.toThrow(
      'INVALID_ELEVATION_POLICY',
    )
    await expect(elevate(1, chances, '00000000-0000-0000-0000-000000000002')).rejects.toThrow(
      'GAME_OWNER_REQUIRED',
    )
    await elevate(1)
    await expect(elevate(1)).rejects.toThrow('ELEVATION_POLICY_VERSION_CONFLICT')
    expect(
      (
        await db.query(
          'select reason,published_by from app_private.battlefield_elevation_policy_versions where version=2',
        )
      ).rows[0],
    ).toEqual({ reason: null, published_by: owner })
    await db.exec('set role authenticated')
    await expect(set(3, change)).rejects.toThrow('permission denied')
    await expect(elevate(2)).rejects.toThrow('permission denied')
    await db.exec('reset role; set role service_role')
    await expect(db.query('select * from app_private.world_environment_settings')).rejects.toThrow(
      'permission denied',
    )
    await db.query('select public.read_world_environment_v1()')
  } finally {
    await db.close()
  }
}, 30000)
