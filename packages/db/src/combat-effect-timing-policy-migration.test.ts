import { existsSync, readFileSync } from 'node:fs'
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
