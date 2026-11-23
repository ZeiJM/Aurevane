import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { inspectMigrationSecurity } from './migration-policy'

const sql = readFileSync(
  resolve(process.cwd(), '../../supabase/migrations/20261031081044_counter_tag_identity.sql'),
  'utf8',
)

it.each([false, true])(
  'replays Counter registration without dropping later identities or lowering retained metadata (already registered=%s)',
  async (hasCounter) => {
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
      insert into app_private.combat_content_records values
        ('tag.counter','tag','archived',7,5,'Counter',null,9),
        ('tag.endure','tag','archived',8,6,'Retained Endure',null,11);
      create function app_private.content_presentation_tag_ids_v1() returns text[]
      language sql immutable set search_path='' as $$
        select array['damage',${hasCounter ? "'counter'," : ''}'endure','reversal','weak-point','spike','ruin','future-approved-tag']::text[];
      $$;
    `)
      const previous = readFileSync(
        resolve(
          process.cwd(),
          '../../supabase/migrations/20261028060810_master_effect_tag_wording_defaults.sql',
        ),
        'utf8',
      )
      const classifier = previous.slice(
        previous.indexOf('create function app_private.content_effect_presentation_id_v1('),
        previous.indexOf('create function app_private.content_tag_text_valid_v1('),
      )
      await db.exec(
        classifier
          .replace("positive||array['covert']", "positive||array['endure','covert']")
          .replace(
            "case p->>'type'",
            "case p->>'type' when 'future-mechanic' then return 'future-approved-tag';",
          ),
      )
      const before = await db.query(
        'select * from app_private.combat_content_records order by content_key',
      )
      const priorIds = (
        await db.query<{ ids: string[] }>(
          'select app_private.content_presentation_tag_ids_v1() ids',
        )
      ).rows[0]!.ids
      await db.exec(sql)
      await db.exec(sql)
      expect(
        (await db.query('select * from app_private.combat_content_records order by content_key'))
          .rows,
      ).toEqual(before.rows)
      const ids = (
        await db.query<{ ids: string[] }>(
          'select app_private.content_presentation_tag_ids_v1() ids',
        )
      ).rows[0]!.ids
      expect(ids.slice(0, priorIds.length)).toEqual(priorIds)
      expect(ids).toEqual(hasCounter ? priorIds : [...priorIds, 'counter'])
      expect(
        (
          await db.query<{ id: string }>(
            `select app_private.content_effect_presentation_id_v1('{"type":"future-mechanic"}') id`,
          )
        ).rows[0]!.id,
      ).toBe('future-approved-tag')
      expect(
        (
          await db.query<{ id: string }>(
            `select app_private.content_effect_presentation_id_v1('{"type":"remove-status","statusIds":["endure"],"removalMode":"specified"}') id`,
          )
        ).rows[0]!.id,
      ).toBe('dispel')
      expect(new Set(ids).size).toBe(ids.length)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('anon','app_private.content_presentation_tag_ids_v1()','EXECUTE') allowed",
          )
        ).rows,
      ).toEqual([{ allowed: false }])
      expect(inspectMigrationSecurity(sql)).toEqual([])
    } finally {
      await db.close()
    }
  },
)
