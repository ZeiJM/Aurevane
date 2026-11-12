import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { inspectMigrationSecurity } from './migration-policy'
const sql = readFileSync(
  resolve(
    process.cwd(),
    '../../supabase/migrations/20261103085413_passive_stat_bonus_tag_identity.sql',
  ),
  'utf8',
)
it('registers only the passive stat identity, preserves historical content and private ACLs, and repeats safely', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema app_private; create role anon; create role authenticated; create role service_role;
      create table app_private.combat_content_records (content_key text primary key,content_kind text,lifecycle text,version_floor integer,builtin_version integer,builtin_name text,builtin_source_discipline_id text);
      insert into app_private.combat_content_records values ('tag.retained','tag','archived',7,5,'Retained',null);
      create function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='' as $$select array['damage','future-approved']::text[]$$;
      revoke all on function app_private.content_presentation_tag_ids_v1() from public,anon,authenticated,service_role;
      create table app_private.combat_content_versions(definition jsonb);
      insert into app_private.combat_content_versions values ('{"literal":"history"}');`)
    const acl = (
      await db.query(
        "select proacl::text acl from pg_proc where oid='app_private.content_presentation_tag_ids_v1()'::regprocedure",
      )
    ).rows
    await db.exec(sql)
    await db.exec(sql)
    expect(
      (await db.query('select app_private.content_presentation_tag_ids_v1() ids')).rows,
    ).toEqual([{ ids: ['damage', 'future-approved', 'stat-bonus'] }])
    expect(
      (
        await db.query(
          "select builtin_name name from app_private.combat_content_records where content_key='tag.stat-bonus'",
        )
      ).rows,
    ).toEqual([{ name: 'Stat Bonus' }])
    expect(
      (
        await db.query(
          "select lifecycle,version_floor from app_private.combat_content_records where content_key='tag.retained'",
        )
      ).rows,
    ).toEqual([{ lifecycle: 'archived', version_floor: 7 }])
    expect(
      (await db.query('select definition from app_private.combat_content_versions')).rows,
    ).toEqual([{ definition: { literal: 'history' } }])
    expect(
      (
        await db.query(
          "select proacl::text acl from pg_proc where oid='app_private.content_presentation_tag_ids_v1()'::regprocedure",
        )
      ).rows,
    ).toEqual(acl)
  } finally {
    await db.close()
  }
}, 30_000)
it('retains migration security contracts', () => {
  expect(inspectMigrationSecurity(sql)).toEqual([])
})
