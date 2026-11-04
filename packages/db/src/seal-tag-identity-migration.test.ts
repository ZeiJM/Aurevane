import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { inspectMigrationSecurity } from './migration-policy'

const sql = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20261104145206_seal_tag_identity.sql'),
  'utf8',
)
const timingMigration = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20261018141646_modular_global_tag_timing.sql'),
  'utf8',
)
const timingWriter = timingMigration.slice(
  timingMigration.indexOf(
    'create or replace function public.publish_combat_effect_timing_policy_v1',
  ),
  timingMigration.indexOf('create or replace function public.read_combat_content_catalogue_v1'),
)

it.each([false, true])(
  'registers Seal additively without rewriting retained records or widening ACLs (existing=%s)',
  async (existing) => {
    const db = new PGlite()
    try {
      await db.exec(`
      create schema app_private;
      create role anon; create role authenticated; create role service_role;
      create table app_private.combat_content_records (
        content_key text primary key, content_kind text not null, lifecycle text not null,
        version_floor integer not null, builtin_version integer, builtin_name text,
        builtin_source_discipline_id text, revision integer default 1
      );
      insert into app_private.combat_content_records values ('tag.zzfuture','tag','archived',7,5,'Future',null,9);
      ${existing ? "insert into app_private.combat_content_records values ('tag.seal','tag','archived',7,5,'Retained Seal',null,9);" : ''}
      create table app_private.combat_content_versions (definition jsonb);
      create table app_private.combat_content_publications (definition jsonb);
      create table app_private.combat_content_drafts (definition jsonb);
      insert into app_private.combat_content_versions values ('{"immutable":"retained"}');
      insert into app_private.combat_content_publications values ('{"published":"retained"}');
      insert into app_private.combat_content_drafts values ('{"draft":"retained"}');
      create function app_private.content_presentation_tag_ids_v1() returns text[]
      language sql immutable set search_path='' as $$ select array['counter','endure','future-approved-tag'${existing ? ",'seal'" : ''}]::text[]; $$;
      revoke all on function app_private.content_presentation_tag_ids_v1() from public,anon,authenticated,service_role;
    `)
      await db.exec(timingWriter)
      const before = (
        await db.query('select * from app_private.combat_content_records order by content_key')
      ).rows
      await db.exec(sql)
      await db.exec(sql)
      expect(
        (
          await db.query<{ ids: string[] }>(
            'select app_private.content_presentation_tag_ids_v1() ids',
          )
        ).rows[0]!.ids,
      ).toEqual(['counter', 'endure', 'future-approved-tag', 'seal'])
      const after = (
        await db.query('select * from app_private.combat_content_records order by content_key')
      ).rows
      expect(after).toEqual(
        existing
          ? before
          : [
              {
                content_key: 'tag.seal',
                content_kind: 'tag',
                lifecycle: 'active',
                version_floor: 1,
                builtin_version: 1,
                builtin_name: 'Seal',
                builtin_source_discipline_id: null,
                revision: 1,
              },
              ...before,
            ],
      )
      for (const role of ['anon', 'authenticated', 'service_role'])
        expect(
          (
            await db.query<{ allowed: boolean }>(
              `select has_function_privilege('${role}','app_private.content_presentation_tag_ids_v1()','EXECUTE') allowed`,
            )
          ).rows[0]!.allowed,
        ).toBe(false)
      for (const [table, value] of [
        ['versions', { immutable: 'retained' }],
        ['publications', { published: 'retained' }],
        ['drafts', { draft: 'retained' }],
      ] as const)
        expect(
          (await db.query(`select definition from app_private.combat_content_${table}`)).rows,
        ).toEqual([{ definition: value }])
      expect(inspectMigrationSecurity(sql)).toEqual([])
    } finally {
      await db.close()
    }
  },
)
