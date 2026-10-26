import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
const owner = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
it('persists independent chances and weather cadence with Owner authority, CAS, private immutable history and compatible legacy policies', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role; create schema app_private; create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '${owner}'::uuid then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`,
    )
    for (const name of [
      '20261011030821_world_environment_controls.sql',
      '20261007101310_battlefield_elevation_policy.sql',
      '20261023010443_master_operational_rules_and_world_cycle.sql',
    ])
      await db.exec(migration(name))
    const legacyChances = { level1BasisPoints: 1234, level2BasisPoints: 8766, level3BasisPoints: 0 }
    await db.query('select public.publish_battlefield_elevation_policy_v2($1,$2,$3::jsonb)', [
      owner,
      1,
      JSON.stringify(legacyChances),
    ])
    const legacyRows = (
      await db.query(
        'select version,level1_basis_points,level2_basis_points,level3_basis_points,published_by,reason,published_at from app_private.battlefield_elevation_policy_versions order by version',
      )
    ).rows
    const rolloutSql = migration('20261026062526_independent_elevation_and_weather_cadence.sql')
    await db.exec(rolloutSql)
    expect(
      (
        await db.query<{ value: unknown }>(
          'select public.read_battlefield_elevation_policy_v1() value',
        )
      ).rows[0]!.value,
    ).toEqual({ version: 3, model: 'independent-highest', ...legacyChances })
    expect(
      (
        await db.query(
          'select version,level1_basis_points,level2_basis_points,level3_basis_points,published_by,reason,published_at from app_private.battlefield_elevation_policy_versions where version <= 2 order by version',
        )
      ).rows,
    ).toEqual(legacyRows)
    expect(
      (
        await db.query(
          'select published_by,reason from app_private.battlefield_elevation_policy_versions where version=3',
        )
      ).rows[0],
    ).toEqual({
      published_by: null,
      reason: 'Owner-requested independent elevation rules; activated by migration 20261026062526.',
    })
    // Reusing the activation block must not publish another row over an already-current model.
    const activation = rolloutSql.match(
      /do \$elevation_rollout\$[\s\S]*?\$elevation_rollout\$;/,
    )?.[0]
    expect(activation).toBeDefined()
    await db.exec(activation!)
    expect(
      (
        await db.query(
          'select count(*)::integer count from app_private.battlefield_elevation_policy_versions',
        )
      ).rows[0],
    ).toEqual({ count: 3 })
    const currentVersion = 3
    const readWorld = async () =>
      (
        await db.query<{ value: Record<string, unknown> }>(
          'select public.read_world_environment_v1() value',
        )
      ).rows[0]!.value
    expect(await readWorld()).toMatchObject({ version: 0, weatherRollMinutes: 360 })
    const change = {
      dayLengthMinutes: 120,
      weatherRollMinutes: 5,
      timeOffsetMinutes: 0,
      frozenMinuteOfDay: null,
      weatherOverride: 'rain',
      weatherOverrideUntilMs: Date.now() + 37 * 60_000,
    }
    const set = (version: number, body: unknown = change, actor = owner) =>
      db.query('select public.set_world_environment_v2($1,$2,$3::jsonb)', [
        actor,
        version,
        JSON.stringify(body),
      ])
    await expect(set(0, change, other)).rejects.toThrow('GAME_OWNER_REQUIRED')
    for (const weatherRollMinutes of [0, -1, 1.5, 10081, '5', null])
      await expect(set(0, { ...change, weatherRollMinutes })).rejects.toThrow(
        'INVALID_WORLD_ENVIRONMENT',
      )
    await set(0)
    expect(await readWorld()).toMatchObject({ ...change, version: 1 })
    await expect(set(0)).rejects.toThrow('WORLD_ENVIRONMENT_VERSION_CONFLICT')
    await set(1, { dayLengthMinutes: 60, timeOffsetMinutes: 0, frozenMinuteOfDay: null })
    expect(await readWorld()).toMatchObject({
      version: 2,
      weatherRollMinutes: 5,
      weatherOverrideUntilMs: change.weatherOverrideUntilMs,
    })
    const chances = {
      model: 'independent-highest',
      level1BasisPoints: 10000,
      level2BasisPoints: 10000,
      level3BasisPoints: 10000,
    }
    const publish = (version: number, body: unknown = chances, actor = owner) =>
      db.query<{ value: unknown }>(
        'select public.publish_battlefield_elevation_policy_v3($1,$2,$3::jsonb) value',
        [actor, version, JSON.stringify(body)],
      )
    await expect(publish(currentVersion, chances, other)).rejects.toThrow('GAME_OWNER_REQUIRED')
    for (const level1BasisPoints of [-1, 1.5, 10001, '10', null])
      await expect(publish(currentVersion, { ...chances, level1BasisPoints })).rejects.toThrow(
        'INVALID_ELEVATION_POLICY',
      )
    expect((await publish(currentVersion)).rows[0]!.value).toEqual({
      version: currentVersion + 1,
      ...chances,
    })
    await expect(publish(currentVersion)).rejects.toThrow('ELEVATION_POLICY_VERSION_CONFLICT')
    const zero = { ...chances, level1BasisPoints: 0, level2BasisPoints: 0, level3BasisPoints: 0 }
    expect((await publish(currentVersion + 1, zero)).rows[0]!.value).toEqual({
      version: currentVersion + 2,
      ...zero,
    })
    expect(
      (
        await db.query<{ value: unknown }>(
          'select public.read_battlefield_elevation_policy_v1() value',
        )
      ).rows[0]!.value,
    ).toEqual({ version: currentVersion + 2, ...zero })
    expect(
      (
        await db.query(
          'select version,level1_basis_points,level2_basis_points,level3_basis_points,model from app_private.battlefield_elevation_policy_versions where version=1',
        )
      ).rows[0],
    ).toEqual({
      version: 1,
      level1_basis_points: 6000,
      level2_basis_points: 3000,
      level3_basis_points: 1000,
      model: 'legacy-weighted',
    })
    await expect(
      db.query(
        'insert into app_private.battlefield_elevation_policy_versions(version,level1_basis_points,level2_basis_points,level3_basis_points) values(6,0,0,0)',
      ),
    ).rejects.toThrow('check constraint')
    await expect(db.exec('delete from app_private.world_environment_audit')).rejects.toThrow(
      'WORLD_ENVIRONMENT_AUDIT_IMMUTABLE',
    )
    await db.exec('set role authenticated')
    await expect(set(2)).rejects.toThrow('permission denied')
    await expect(publish(currentVersion + 2)).rejects.toThrow('permission denied')
    await db.exec('reset role; set role service_role')
    await expect(
      db.query('select * from app_private.battlefield_elevation_policy_versions'),
    ).rejects.toThrow('permission denied')
    await expect(db.query('select * from app_private.world_environment_settings')).rejects.toThrow(
      'permission denied',
    )
    await db.query('select public.read_world_environment_v1()')
    await publish(currentVersion + 2, { ...zero, level2BasisPoints: 10000 })
  } finally {
    await db.close()
  }
}, 30000)
