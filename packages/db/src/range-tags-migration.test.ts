import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const name = '20261106110000_range_tags.sql'
const sql = readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
const owner = '00000000-0000-4000-8000-000000000061'
const outsider = '00000000-0000-4000-8000-000000000062'
let db: PGlite
let before: { identity: string; definition: string; acl: string | null; owner: number }[]
let history: unknown[]

async function writers(database: PGlite) {
  return (
    await database.query<{
      identity: string
      definition: string
      acl: string | null
      owner: number
    }>(
      `select p.oid::regprocedure::text identity, pg_get_functiondef(p.oid) definition, p.proacl::text acl, p.proowner owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_combat_effect_timing_policy_v1' order by identity`,
    )
  ).rows
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, migration) => {
    if (migration !== name) return
    await database.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'range-owner@example.test',now()),($2,'range-outsider@example.test',now())",
      [owner, outsider],
    )
    await database.query(
      "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
      [owner],
    )
    // Preserve a later independently added timing key and the current delegated authorization.
    await database.exec(`do $$ declare fn record; begin
      for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_combat_effect_timing_policy_v1' loop
        execute replace(pg_get_functiondef(fn.oid), 'entry.key not in (', 'entry.key not in (''future-timing'',');
      end loop;
    end $$;`)
    before = await writers(database)
    history = (
      await database.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows
  })
}, 60000)
afterAll(async () => {
  await db?.close()
})

it('changes only the current finite timing whitelist and leaves history, auth bodies, ownership and ACLs intact', async () => {
  expect(before).toHaveLength(2)
  expect(await writers(db)).toEqual(
    before.map((row) => ({
      ...row,
      definition: row.definition.replace(
        'entry.key not in (',
        "entry.key not in ('range-down','range-up',",
      ),
    })),
  )
  expect(
    (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows,
  ).toEqual(history)
})

it('publishes all Range timing modes through both real writers while retaining existing overrides and immutable history', async () => {
  const initial = (
    await db.query(
      'select * from app_private.combat_effect_timing_policy_versions order by version',
    )
  ).rows
  for (const selectedCharacter of [false, true]) {
    const call = `select public.publish_combat_effect_timing_policy_v1($1,$2,$3::jsonb,null${selectedCharacter ? ',null::uuid' : ''}) result`
    for (const mode of ['instant', 'next-round', 'delayed', 'controlled']) {
      const version = (
        await db.query<{ version: number }>(
          'select max(version) version from app_private.combat_effect_timing_policy_versions',
        )
      ).rows[0]!.version
      const modes = {
        'range-up': mode,
        'range-down': mode,
        slow: 'delayed',
        endure: 'instant',
        'future-timing': 'next-round',
      }
      expect(
        (
          await db.query<{ result: { version: number; modes: unknown } }>(call, [
            owner,
            version,
            JSON.stringify(modes),
          ])
        ).rows[0]!.result,
      ).toMatchObject({ version: version + 1, modes })
      expect(
        (
          await db.query<{ result: { version: number } }>(call, [
            owner,
            version + 1,
            JSON.stringify(modes),
          ])
        ).rows[0]!.result.version,
      ).toBe(version + 1)
      await expect(db.query(call, [owner, version, JSON.stringify(modes)])).rejects.toThrow(
        'TIMING_POLICY_VERSION_CONFLICT',
      )
    }
  }
  expect(
    (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows.slice(0, initial.length),
  ).toEqual(initial)
})

it('retains real publisher authorization, catalogue CAS and finite mode validation', async () => {
  const catalogue = (
    await db.query<{ value: { token: string; policy: { version: number } } }>(
      'select public.read_combat_content_catalogue_v1() value',
    )
  ).rows[0]!.value
  const modes = { 'range-up': 'delayed', 'range-down': 'next-round', slow: 'instant' }
  await expect(
    db.query('select public.publish_combat_effect_timing_policy_v2($1,$2,$3::jsonb,$4)', [
      owner,
      catalogue.policy.version,
      JSON.stringify(modes),
      'stale',
    ]),
  ).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
  await expect(
    db.query('select public.publish_combat_effect_timing_policy_v2($1,$2,$3::jsonb,$4)', [
      outsider,
      catalogue.policy.version,
      JSON.stringify(modes),
      catalogue.token,
    ]),
  ).rejects.toThrow()
  await expect(
    db.query('select public.publish_combat_effect_timing_policy_v1($1,$2,$3::jsonb,null)', [
      owner,
      catalogue.policy.version,
      '{"range-up":"invented"}',
    ]),
  ).rejects.toThrow('INVALID_TIMING_POLICY')
  expect(
    (
      await db.query<{ result: { modes: unknown } }>(
        'select public.publish_combat_effect_timing_policy_v2($1,$2,$3::jsonb,$4) result',
        [owner, catalogue.policy.version, JSON.stringify(modes), catalogue.token],
      )
    ).rows[0]!.result.modes,
  ).toEqual(modes)
  await db.exec('set role authenticated')
  try {
    await expect(
      db.query('select public.publish_combat_effect_timing_policy_v1($1,$2,$3::jsonb,null)', [
        owner,
        catalogue.policy.version,
        JSON.stringify(modes),
      ]),
    ).rejects.toThrow('permission denied')
  } finally {
    await db.exec('reset role')
  }
})

it('replays idempotently without changing installed writer definitions or policy history', async () => {
  const definitions = await writers(db)
  const policies = (
    await db.query(
      'select * from app_private.combat_effect_timing_policy_versions order by version',
    )
  ).rows
  await db.exec(sql)
  expect(await writers(db)).toEqual(definitions)
  expect(
    (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows,
  ).toEqual(policies)
})

it.each(['missing', 'duplicate'] as const)(
  'fails closed on a %s timing vocabulary anchor',
  async (kind) => {
    const prior = await writers(db)
    const altered =
      kind === 'missing'
        ? prior[0]!.definition.replace('entry.key not in (', 'entry.key not  in (')
        : prior[0]!.definition.replace(
            'entry.key not in (',
            '/* entry.key not in ( */ entry.key not in (',
          )
    await db.exec('begin')
    try {
      await db.exec(altered)
      await expect(db.exec(sql)).rejects.toThrow('Expected one finite timing vocabulary')
    } finally {
      await db.exec('rollback')
    }
    expect(await writers(db)).toEqual(prior)
  },
)
