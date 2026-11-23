import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { inspectMigrationSecurity } from './migration-policy'

const path = resolve(
  process.cwd(),
  '../../supabase/migrations/20261031090902_reversal_tag_identity.sql',
)

describe('Reversal tag registration', () => {
  it('adds only the identity and appends to the current finite allowlist', () => {
    expect(existsSync(path)).toBe(true)
    const sql = readFileSync(path, 'utf8')
    expect(sql).toContain("values ('tag.reversal', 'tag', 'active', 1, 1, 'Reversal', null)")
    expect(sql).toContain('ids := app_private.content_presentation_tag_ids_v1()')
    expect(sql).toContain("array_append(ids, 'reversal')")
    expect(sql).toContain('revoke all on function app_private.content_presentation_tag_ids_v1()')
    expect(sql).not.toMatch(
      /(?:insert into|update|delete from)\s+app_private\.combat_content_(?:versions|publications|drafts)\b/i,
    )
    expect(inspectMigrationSecurity(sql)).toEqual([])
  })
  it('includes a builtin identity without a publication in the generated inventory', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), '../../supabase/content-builtin-manifest.json'), 'utf8'),
    )
    expect(
      manifest.find((row: { contentKey: string }) => row.contentKey === 'tag.reversal'),
    ).toEqual({
      contentKey: 'tag.reversal',
      contentKind: 'tag',
      name: 'Reversal',
      contentVersion: 1,
      versionFloor: 1,
      sourceDisciplineId: null,
    })
  })
})

it('executes additively and idempotently while preserving existing tags and server-only access', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite()
  try {
    await db.exec(`
      create schema app_private;
      create role anon;
      create role authenticated;
      create role service_role;
      create table app_private.combat_content_records (
        content_key text primary key, content_kind text not null, lifecycle text not null,
        version_floor integer not null, builtin_version integer, builtin_name text,
        builtin_source_discipline_id text
      );
      insert into app_private.combat_content_records values ('tag.endure','tag','archived',7,3,'Existing Endure',null);
      create function app_private.content_presentation_tag_ids_v1() returns text[]
      language sql immutable set search_path='' as $$ select array['counter','endure','weak-point','spike','ruin','future-approved-tag']::text[]; $$;
    `)
    const before = await db.query('select * from app_private.combat_content_records')
    const sql = readFileSync(path, 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    const ids = await db.query<{ ids: string[] }>(
      'select app_private.content_presentation_tag_ids_v1() ids',
    )
    expect(ids.rows[0]?.ids).toEqual([
      'counter',
      'endure',
      'weak-point',
      'spike',
      'ruin',
      'future-approved-tag',
      'reversal',
    ])
    expect(
      (
        await db.query(
          "select * from app_private.combat_content_records where content_key='tag.endure'",
        )
      ).rows,
    ).toEqual(before.rows)
    expect(
      (
        await db.query(
          "select content_key,builtin_name,version_floor from app_private.combat_content_records where content_key='tag.reversal'",
        )
      ).rows,
    ).toEqual([{ content_key: 'tag.reversal', builtin_name: 'Reversal', version_floor: 1 }])
    expect(
      (
        await db.query(
          "select has_function_privilege('anon','app_private.content_presentation_tag_ids_v1()','EXECUTE') allowed",
        )
      ).rows,
    ).toEqual([{ allowed: false }])
  } finally {
    await db.close()
  }
})
