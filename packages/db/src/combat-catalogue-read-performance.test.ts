import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
}, 60000)
afterAll(async () => {
  await db?.close()
})
async function token() {
  return (
    await db.query<{ token: string }>(
      'select public.read_combat_content_catalogue_token_v1() token',
    )
  ).rows[0]!.token
}
it('token-only reads match the full catalogue and invalidate every record metadata change without reading publication definitions', async () => {
  const before = await token()
  expect(before).toMatch(/^[a-f0-9]{32}$/)
  expect(
    (
      await db.query<{ token: string }>(
        "select public.read_combat_content_catalogue_v1()->>'token' token",
      )
    ).rows[0]!.token,
  ).toBe(before)
  await db.exec('begin')
  try {
    await db.exec(
      "update app_private.combat_content_records set restore_pending=not restore_pending where content_key='vanguard'",
    )
    expect(await token()).not.toBe(before)
    await db.exec(
      "create or replace function public.read_combat_content_catalogue_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$ begin raise exception 'FULL_CATALOGUE_READ_FORBIDDEN'; end $$",
    )
    expect(await token()).toMatch(/^[a-f0-9]{32}$/)
    expect(
      (
        await db.query<{ value: { catalogueToken: string } }>(
          "select public.read_current_discipline_selection_v1('vanguard',null) value",
        )
      ).rows[0]!.value.catalogueToken,
    ).toBe(await token())
    await db.query('select app_private.lock_combat_content_catalogue_v1($1)', [await token()])
  } finally {
    await db.exec('rollback')
  }
})
it('token helper retains the service-only privilege boundary', async () => {
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','public.read_combat_content_catalogue_token_v1()','execute') anon, has_function_privilege('authenticated','public.read_combat_content_catalogue_token_v1()','execute') authenticated, has_function_privilege('service_role','public.read_combat_content_catalogue_token_v1()','execute') service",
      )
    ).rows,
  ).toEqual([{ anon: false, authenticated: false, service: true }])
})
it('immutable pointer replacement and policy publication invalidate CAS while unselected retained history does not', async () => {
  await db.exec('begin')
  try {
    await db.exec(`insert into auth.users(id) values('00000000-0000-4000-8000-000000000090');
      insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
      values('performance.test','skill',1,'{"id":"performance.test","contentVersion":1}','00000000-0000-4000-8000-000000000090');
      insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
      select content_key,content_kind,id,published_by from app_private.combat_content_versions where content_key='performance.test';`)
    const first = await token()
    await db.exec(`insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
      values('performance.test','skill',2,'{"id":"performance.test","contentVersion":2}','00000000-0000-4000-8000-000000000090');`)
    expect(await token()).toBe(first)
    await db.exec(
      "update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key='performance.test' and content_version=2) where content_key='performance.test'",
    )
    const second = await token()
    expect(second).not.toBe(first)
    await db.exec(
      "insert into app_private.combat_effect_timing_policy_versions(version,modes,reason) select max(version)+1,'{}','Performance CAS regression' from app_private.combat_effect_timing_policy_versions",
    )
    expect(await token()).not.toBe(second)
    expect(
      (
        await db.query<{ token: string }>(
          "select public.read_combat_content_catalogue_v1()->>'token' token",
        )
      ).rows[0]!.token,
    ).toBe(await token())
    await db.exec('savepoint immutable')
    await expect(
      db.exec(
        "update app_private.combat_content_versions set definition='{}' where content_key='performance.test'",
      ),
    ).rejects.toThrow(/COMBAT_CONTENT_VERSION_IMMUTABLE/)
    await db.exec('rollback to savepoint immutable')
  } finally {
    await db.exec('rollback')
  }
})
