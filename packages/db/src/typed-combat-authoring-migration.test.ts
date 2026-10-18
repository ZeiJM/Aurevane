import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
const correction = '20261015095150_typed_combat_authoring_kinds.sql'
const owner = '11111111-1111-4111-8111-111111111111'
const stranger = '22222222-2222-4222-8222-222222222222'
async function database() {
  const db = await PGlite.create()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema app_private; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'),('${stranger}');`)
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    correction,
  ])
    await db.exec(migration(name))
  // Exercise the real predecessor authorization function and operator table, never an allow-all stub.
  await db.query(
    "insert into app_private.master_panel_operators(user_id,role,enabled) values ($1,'owner',true)",
    [owner],
  )
  return db
}
const definition = (kind: string, key: string) =>
  kind === 'essence'
    ? {
        essenceId: key,
        contentVersion: 7,
        skill: { id: key, contentVersion: 7, hidden: { media: 'retained' } },
      }
    : { id: key, contentVersion: 7, hidden: { media: 'retained' } }
const publish = (
  db: PGlite,
  kind: string,
  key: string,
  value: unknown,
  base: number | null,
  actor = owner,
) =>
  db.query<{ content_version: number; definition: Record<string, unknown> }>(
    'select * from public.publish_combat_content_v1($1,$2,$3,$4::jsonb,$5)',
    [actor, key, kind, JSON.stringify(value), base],
  )
async function snapshot(db: PGlite) {
  return (
    await db.query(`select jsonb_build_object(
    'versions',(select coalesce(jsonb_agg(v order by content_key,content_version),'[]') from app_private.combat_content_versions v),
    'drafts',(select coalesce(jsonb_agg(d order by content_key),'[]') from app_private.combat_content_drafts d),
    'publications',(select coalesce(jsonb_agg(p order by content_key),'[]') from app_private.combat_content_publications p)) as state`)
  ).rows
}
it.each(['essence', 'resonance'])(
  'executes actual %s draft/publication/history RPCs with full rollback and immutable versions',
  async (kind) => {
    const db = await database()
    try {
      const key = `typed.${kind}`
      const value = definition(kind, key)
      const draft = await db.query<{ draft_version: number }>(
        'select * from public.save_combat_content_draft_v1($1,$2,$3,$4::jsonb,7,null)',
        [owner, key, kind, JSON.stringify(value)],
      )
      expect(Number(draft.rows[0]!.draft_version)).toBe(1)
      const drafted = await snapshot(db)
      await expect(
        db.query('select * from public.save_combat_content_draft_v1($1,$2,$3,$4::jsonb,7,0)', [
          owner,
          key,
          kind,
          JSON.stringify(value),
        ]),
      ).rejects.toThrow('COMBAT_CONTENT_DRAFT_VERSION_CONFLICT')
      expect(await snapshot(db)).toEqual(drafted)
      const first = await publish(db, kind, key, value, 7)
      expect(first.rows[0]!.content_version).toBe(8)
      if (kind === 'essence')
        expect(first.rows[0]!.definition.skill).toMatchObject({
          contentVersion: 8,
          hidden: { media: 'retained' },
        })
      const second = await publish(db, kind, key, value, 8)
      expect(second.rows[0]!.content_version).toBe(9)
      const current = await db.query<{ content_version: number }>(
        'select * from public.read_current_combat_content_v1($1,$2)',
        [key, kind],
      )
      expect(current.rows[0]!.content_version).toBe(9)
      const before = await snapshot(db)
      await expect(publish(db, kind, key, value, 8)).rejects.toThrow(
        'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
      )
      await expect(publish(db, kind, key, value, 9, stranger)).rejects.toThrow(
        'MASTER_PANEL_OPERATOR_REQUIRED',
      )
      await expect(
        db.query(
          "update app_private.combat_content_versions set definition='{}' where content_key=$1",
          [key],
        ),
      ).rejects.toThrow('COMBAT_CONTENT_VERSION_IMMUTABLE')
      expect(await snapshot(db)).toEqual(before)
      await db.query('select public.set_combat_content_publication_v1($1,$2,$3,8)', [
        owner,
        key,
        kind,
      ])
      expect(
        (
          await db.query<{ content_version: number }>(
            'select * from public.read_current_combat_content_v1($1,$2)',
            [key, kind],
          )
        ).rows[0]!.content_version,
      ).toBe(8)
      expect(
        (
          await db.query('select * from public.list_combat_content_versions_v1($1,$2)', [
            owner,
            key,
          ])
        ).rows,
      ).toHaveLength(2)
      expect(
        (await db.query('select * from public.read_combat_content_draft_v1($1,$2)', [owner, key]))
          .rows,
      ).toEqual([])
      const historical = await db.query<{ definition: unknown }>(
        'select * from public.read_combat_content_version_v1($1,$2,8)',
        [key, kind],
      )
      expect(historical.rows[0]!.definition).toEqual(first.rows[0]!.definition)
      await db.exec(migration(correction))
      expect(
        (
          await db.query('select * from public.read_combat_content_version_v1($1,$2,8)', [
            key,
            kind,
          ])
        ).rows,
      ).toHaveLength(1)
    } finally {
      await db.close()
    }
  },
  20000,
)
it('keeps actual predecessor permissions and revoked-operator denial, rejects malformed identities and rolls back failed publication writes', async () => {
  const db = await database()
  try {
    const value = definition('essence', 'typed.essence')
    const before = await snapshot(db)
    for (const malformed of [
      { ...value, essenceId: 42 },
      { ...value, essenceId: 'other.essence' },
      { ...value, skill: [] },
      { ...value, skill: { id: 'other.essence' } },
    ]) {
      await expect(publish(db, 'essence', 'typed.essence', malformed, 7)).rejects.toThrow(
        'COMBAT_CONTENT_IDENTITY_MISMATCH',
      )
      expect(await snapshot(db)).toEqual(before)
    }
    await expect(publish(db, 'resonance', 'typed.resonance', { id: 42 }, 7)).rejects.toThrow(
      'COMBAT_CONTENT_IDENTITY_MISMATCH',
    )
    for (const signature of [
      'public.save_combat_content_draft_v1(uuid,text,text,jsonb,integer,bigint)',
      'public.publish_combat_content_v1(uuid,text,text,jsonb,integer)',
      'public.set_combat_content_publication_v1(uuid,text,text,integer)',
    ]) {
      const privileges = await db.query<{ client: boolean; service: boolean; definer: boolean }>(
        "select has_function_privilege('authenticated',$1,'execute') client,has_function_privilege('service_role',$1,'execute') service,(select prosecdef from pg_proc where oid=$1::regprocedure) definer",
        [signature],
      )
      expect(privileges.rows).toEqual([{ client: false, service: true, definer: true }])
    }
    await db.exec('set role authenticated')
    await expect(publish(db, 'essence', 'typed.essence', value, 7)).rejects.toThrow(
      'permission denied',
    )
    await db.exec('reset role; set role service_role')
    expect((await publish(db, 'essence', 'typed.essence', value, 7)).rows[0]!.content_version).toBe(
      8,
    )
    await db.exec('reset role')
    await db.query('update app_private.master_panel_operators set enabled=false where user_id=$1', [
      owner,
    ])
    const revoked = await snapshot(db)
    await expect(publish(db, 'essence', 'typed.essence', value, 8)).rejects.toThrow(
      'MASTER_PANEL_OPERATOR_REQUIRED',
    )
    expect(await snapshot(db)).toEqual(revoked)
    await db.query('update app_private.master_panel_operators set enabled=true where user_id=$1', [
      owner,
    ])
    await db.exec(`create function app_private.reject_test_pointer() returns trigger language plpgsql as $$ begin raise exception 'POINTER_WRITE_REJECTED'; end $$;
      create trigger reject_test_pointer before insert or update on app_private.combat_content_publications for each row execute function app_private.reject_test_pointer();`)
    const rollbackBefore = await snapshot(db)
    await expect(publish(db, 'essence', 'typed.essence', value, 8)).rejects.toThrow(
      'POINTER_WRITE_REJECTED',
    )
    expect(await snapshot(db)).toEqual(rollbackBefore)
  } finally {
    await db.close()
  }
}, 20000)
