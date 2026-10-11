import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const path = resolve(
  process.cwd(),
  '../../supabase/migrations/20261011010000_world_environment_controls.sql',
)
const owner = '00000000-0000-0000-0000-000000000001'
const settings = (extra = '') =>
  `'{"timeOffsetMinutes":30,"frozenMinuteOfDay":null,"weatherOverride":null,"weatherOverrideUntilMs":null${extra}}'::jsonb`

it('stores Owner-audited environment settings with validation, stale protection and immutable history', async () => {
  const db = await PGlite.create()
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema app_private; create function app_private.assert_game_owner_v1(actor uuid) returns void language plpgsql as $$ begin if actor <> '${owner}' then raise exception 'GAME_OWNER_REQUIRED'; end if; end $$;`,
  )
  await db.exec(readFileSync(path, 'utf8'))
  await db.exec('set role authenticated')
  await expect(db.query('select public.read_world_environment_v1()')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role; set role service_role')
  await expect(db.query('select * from app_private.world_environment_audit')).rejects.toThrow(
    'permission denied',
  )
  await db.exec('reset role')

  const read = async () =>
    (await db.query<{ v: Record<string, unknown> }>('select public.read_world_environment_v1() v'))
      .rows[0]!.v
  expect(await read()).toMatchObject({ version: 0, timeOffsetMinutes: 0, weatherOverride: null })

  const set = (actor: string, version: number, body: string, reason: string) =>
    db.query(`select public.set_world_environment_v1($1,$2,${body},$3)`, [actor, version, reason])
  await expect(
    set('00000000-0000-0000-0000-000000000002', 0, settings(), 'Not the owner'),
  ).rejects.toThrow('GAME_OWNER_REQUIRED')
  await expect(set(owner, 0, settings(), 'short')).rejects.toThrow('INVALID_WORLD_ENVIRONMENT')
  await expect(set(owner, 0, settings().replace('30', '2000'), 'Offset too large')).rejects.toThrow(
    'INVALID_WORLD_ENVIRONMENT',
  )
  await expect(set(owner, 0, settings(',"extra":1'), 'Unknown key here')).rejects.toThrow(
    'INVALID_WORLD_ENVIRONMENT',
  )
  await expect(
    set(
      owner,
      0,
      `'{"timeOffsetMinutes":0,"frozenMinuteOfDay":null,"weatherOverride":"hail","weatherOverrideUntilMs":null}'::jsonb`,
      'Unknown weather',
    ),
  ).rejects.toThrow('INVALID_WORLD_ENVIRONMENT')
  await expect(
    set(
      owner,
      0,
      `'{"timeOffsetMinutes":0,"frozenMinuteOfDay":null,"weatherOverride":"rain","weatherOverrideUntilMs":1000}'::jsonb`,
      'Override already expired',
    ),
  ).rejects.toThrow('INVALID_WORLD_ENVIRONMENT')

  await set(owner, 0, settings(), 'Shift the clock for testing')
  expect(await read()).toMatchObject({ version: 1, timeOffsetMinutes: 30 })
  await expect(set(owner, 0, settings(), 'Stale expected version')).rejects.toThrow(
    'WORLD_ENVIRONMENT_VERSION_CONFLICT',
  )

  const future = Date.now() + 3_600_000
  await set(
    owner,
    1,
    `'{"timeOffsetMinutes":0,"frozenMinuteOfDay":1080,"weatherOverride":"storm","weatherOverrideUntilMs":${future}}'::jsonb`,
    'Force an evening storm',
  )
  expect(await read()).toMatchObject({
    version: 2,
    frozenMinuteOfDay: 1080,
    weatherOverride: 'storm',
    weatherOverrideUntilMs: future,
  })

  const history = (
    await db.query<{
      h: { version: number; reason: string; actorUserId: string; before: { version: number } }[]
    }>('select public.read_world_environment_history_v1(20) h')
  ).rows[0]!.h
  expect(history.map((entry) => entry.version)).toEqual([2, 1])
  expect(history[0]).toMatchObject({ reason: 'Force an evening storm', actorUserId: owner })
  expect(history[0]!.before.version).toBe(1)

  await expect(
    db.query("update app_private.world_environment_audit set reason='tampered text'"),
  ).rejects.toThrow('WORLD_ENVIRONMENT_AUDIT_IMMUTABLE')
  await expect(db.query('delete from app_private.world_environment_audit')).rejects.toThrow(
    'WORLD_ENVIRONMENT_AUDIT_IMMUTABLE',
  )
  await expect(db.query('truncate app_private.world_environment_audit')).rejects.toThrow(
    'WORLD_ENVIRONMENT_AUDIT_IMMUTABLE',
  )
}, 30_000)
