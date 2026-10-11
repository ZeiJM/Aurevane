import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
const path = resolve(
  process.cwd(),
  '../../supabase/migrations/20261003015029_combat_effect_timing_policy.sql',
)
it('persists immutable Owner-audited versions and rejects stale or malformed publication', async () => {
  expect(existsSync(path)).toBe(true)
  const db = await PGlite.create()
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema app_private; create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor <> '00000000-0000-0000-0000-000000000001' then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`,
  )
  await db.exec(readFileSync(path, 'utf8'))
  await db.exec('set role authenticated')
  await expect(db.query('select public.read_combat_effect_timing_policy_v1()')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role; set role service_role')
  await expect(
    db.query(
      "update app_private.combat_effect_timing_policy_versions set reason='changed' where version=1",
    ),
  ).rejects.toThrow('permission denied')
  await db.exec('reset role')
  const owner = '00000000-0000-0000-0000-000000000001'
  await expect(
    db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,1,'{"hexed":"instant"}','Owner timing change')`,
      ['00000000-0000-0000-0000-000000000002'],
    ),
  ).rejects.toThrow('GAME_OWNER_REQUIRED')
  await db.query(
    `select public.publish_combat_effect_timing_policy_v1($1,1,'{"hexed":"instant"}','Owner timing change')`,
    [owner],
  )
  await expect(
    db.query(`select public.publish_combat_effect_timing_policy_v1($1,1,'{}','stale')`, [owner]),
  ).rejects.toThrow('TIMING_POLICY_VERSION_CONFLICT')
  await expect(
    db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,2,'{"invented":"instant"}','bad')`,
      [owner],
    ),
  ).rejects.toThrow('INVALID_TIMING_POLICY')
  await expect(
    db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,2,'{"hexed":null}','bad null')`,
      [owner],
    ),
  ).rejects.toThrow('INVALID_TIMING_POLICY')
  const result = await db.query<{ version: number; modes: unknown }>(
    `select version,modes from app_private.combat_effect_timing_policy_versions order by version`,
  )
  expect(result.rows).toEqual([
    { version: 1, modes: {} },
    { version: 2, modes: { hexed: 'instant' } },
  ])
  await db.close()
}, 20000)

it('appends Delayed Rewind without mutating prior overrides and keeps exclusive audited publication', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema app_private;
    create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '00000000-0000-0000-0000-000000000001' then raise exception 'GAME_OWNER_REQUIRED';end if;end $$;`)
    await db.exec(readFileSync(path, 'utf8'))
    const owner = '00000000-0000-0000-0000-000000000001'
    await db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,1,'{"hexed":"instant","summon":"next-round"}','prior override')`,
      [owner],
    )
    await db.exec(
      readFileSync(
        resolve(
          process.cwd(),
          '../../supabase/migrations/20261008162310_combat_delayed_timing.sql',
        ),
        'utf8',
      ),
    )
    expect(
      (
        await db.query<{ policy: unknown }>(
          'select public.read_combat_effect_timing_policy_v1() as policy',
        )
      ).rows[0]!.policy,
    ).toEqual({
      version: 3,
      modes: { hexed: 'instant', summon: 'next-round', 'return-to-turn-start': 'delayed' },
    })
    await expect(
      db.query(`select public.publish_combat_effect_timing_policy_v1($1,2,'{}','stale')`, [owner]),
    ).rejects.toThrow('TIMING_POLICY_VERSION_CONFLICT')
    await db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,3,'{"healing":"delayed","ground-area":"delayed"}','new timings')`,
      [owner],
    )
    for (const modes of [
      { healing: ['instant', 'delayed'] },
      { healing: null },
      { invented: 'delayed' },
      { healing: 'later' },
    ])
      await expect(
        db.query('select public.publish_combat_effect_timing_policy_v1($1,4,$2,$3)', [
          owner,
          JSON.stringify(modes),
          'bad',
        ]),
      ).rejects.toThrow('INVALID_TIMING_POLICY')
    await db.exec('set role authenticated')
    await expect(
      db.query(`select public.publish_combat_effect_timing_policy_v1($1,4,'{}','denied')`, [owner]),
    ).rejects.toThrow('permission denied')
    await db.exec('reset role')
    expect(
      (
        await db.query<{ modes: unknown }>(
          'select modes from app_private.combat_effect_timing_policy_versions where version=2',
        )
      ).rows[0]!.modes,
    ).toEqual({ hexed: 'instant', summon: 'next-round' })
  } finally {
    await db.close()
  }
}, 20000)

it('allows independent Push/Pull publication while keeping history and service-only grants', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema app_private;
      create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '00000000-0000-0000-0000-000000000001' then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`)
    await db.exec(readFileSync(path, 'utf8'))
    const owner = '00000000-0000-0000-0000-000000000001'
    await db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,1,'{"displace":"instant"}','existing shared movement timing')`,
      [owner],
    )
    const before = await db.query(
      'select version,modes from app_private.combat_effect_timing_policy_versions order by version',
    )
    await db.exec(
      readFileSync(
        resolve(
          process.cwd(),
          '../../supabase/migrations/20261008224315_combat_push_pull_timing.sql',
        ),
        'utf8',
      ),
    )
    expect(
      (
        await db.query(
          'select version,modes from app_private.combat_effect_timing_policy_versions order by version',
        )
      ).rows,
    ).toEqual(before.rows)
    await db.query(
      `select public.publish_combat_effect_timing_policy_v1($1,2,'{"push":"instant","pull":"delayed","blindside":"instant"}','separate timing')`,
      [owner],
    )
    expect(
      (
        await db.query<{ policy: unknown }>(
          'select public.read_combat_effect_timing_policy_v1() as policy',
        )
      ).rows[0]!.policy,
    ).toEqual({ version: 3, modes: { push: 'instant', pull: 'delayed', blindside: 'instant' } })
    await db.exec('set role authenticated')
    await expect(
      db.query(`select public.publish_combat_effect_timing_policy_v1($1,3,'{}','denied')`, [owner]),
    ).rejects.toThrow('permission denied')
  } finally {
    await db.close()
  }
}, 20000)

it('adds only Suppress timing without rewriting Owner v7 history or widening publication permissions', async () => {
  const db = await PGlite.create()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema app_private;
      create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor is distinct from '00000000-0000-0000-0000-000000000001' then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`)
    await db.exec(readFileSync(path, 'utf8'))
    await db.exec(
      readFileSync(
        resolve(
          process.cwd(),
          '../../supabase/migrations/20261008224315_combat_push_pull_timing.sql',
        ),
        'utf8',
      ),
    )
    const owner = '00000000-0000-0000-0000-000000000001'
    const modes = {
      summon: 'instant',
      'remove-status': 'instant',
      'return-to-turn-start': 'delayed',
      push: 'instant',
      pull: 'next-round',
      blindside: 'instant',
    }
    for (let version = 1; version < 7; version++)
      await db.query('select public.publish_combat_effect_timing_policy_v1($1,$2,$3,$4)', [
        owner,
        version,
        JSON.stringify(modes),
        `Owner version ${version + 1}`,
      ])
    const before = (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows
    const migrations = readdirSync(resolve(process.cwd(), '../../supabase/migrations'))
    const suppressMigration = migrations.find((name) =>
      name.endsWith('_combat_suppress_timing.sql'),
    )
    if (suppressMigration)
      await db.exec(
        readFileSync(
          resolve(process.cwd(), '../../supabase/migrations', suppressMigration),
          'utf8',
        ),
      )
    expect(
      (
        await db.query(
          'select * from app_private.combat_effect_timing_policy_versions order by version',
        )
      ).rows,
    ).toEqual(before)
    await db.exec('set role service_role')
    await db.query('select public.publish_combat_effect_timing_policy_v1($1,7,$2,$3)', [
      owner,
      JSON.stringify({ ...modes, suppress: 'delayed' }),
      'Suppress timing',
    ])
    await expect(
      db.query('select public.publish_combat_effect_timing_policy_v1($1,8,$2,$3)', [
        '00000000-0000-0000-0000-000000000002',
        JSON.stringify({ suppress: 'instant' }),
        'not Owner',
      ]),
    ).rejects.toThrow('GAME_OWNER_REQUIRED')
    await expect(
      db.query('select public.publish_combat_effect_timing_policy_v1($1,7,$2,$3)', [
        owner,
        JSON.stringify({ suppress: 'instant' }),
        'stale',
      ]),
    ).rejects.toThrow('TIMING_POLICY_VERSION_CONFLICT')
    for (const mode of ['later', null, ['instant']])
      await expect(
        db.query('select public.publish_combat_effect_timing_policy_v1($1,8,$2,$3)', [
          owner,
          JSON.stringify({ suppress: mode }),
          'invalid',
        ]),
      ).rejects.toThrow('INVALID_TIMING_POLICY')
    await db.exec('reset role')
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(
        db.query('select public.publish_combat_effect_timing_policy_v1($1,8,$2,$3)', [
          owner,
          '{}',
          'denied',
        ]),
      ).rejects.toThrow('permission denied')
      await db.exec('reset role')
    }
    expect(
      (
        await db.query(
          'select * from app_private.combat_effect_timing_policy_versions where version<=7 order by version',
        )
      ).rows,
    ).toEqual(before)
    expect(
      (
        await db.query<{ policy: unknown }>(
          'select public.read_combat_effect_timing_policy_v1() as policy',
        )
      ).rows[0]!.policy,
    ).toEqual({ version: 8, modes: { ...modes, suppress: 'delayed' } })
  } finally {
    await db.close()
  }
}, 20000)
