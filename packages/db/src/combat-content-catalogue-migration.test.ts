import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
const sql = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
const snapshotMigration = '20261015100834_combat_content_catalogue_snapshot.sql'
const actor = '11111111-1111-4111-8111-111111111111'
async function database() {
  const db = await PGlite.create()
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create schema app_private;create table auth.users(id uuid primary key);insert into auth.users values('${actor}');`,
  )
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    snapshotMigration,
  ])
    await db.exec(sql(name))
  await db.query(
    "insert into app_private.master_panel_operators(user_id,role,enabled) values($1,'owner',true)",
    [actor],
  )
  return db
}
interface Snapshot {
  token: string
  policy: { version: number; modes: Record<string, string> }
  publications: readonly {
    content_key: string
    content_kind: string
    content_version: number
    definition: unknown
  }[]
}
async function snapshot(db: PGlite) {
  return (
    await db.query<{ snapshot: Snapshot }>(
      'select public.read_combat_content_catalogue_v1() snapshot',
    )
  ).rows[0]!.snapshot
}
it('reads all actual current publications and their policy together, with a token that changes on current choices rather than drafts/history', async () => {
  const db = await database()
  try {
    const empty = await snapshot(db)
    expect(empty).toMatchObject({ policy: { version: 1, modes: {} }, publications: [] })
    expect(empty.token).toMatch(/^[a-f0-9]{32}$/)
    expect(await snapshot(db)).toEqual(empty)
    for (const [kind, key] of [
      ['skill', 'owner.skill'],
      ['essence', 'owner.essence'],
      ['resonance', 'owner.resonance'],
      ['status', 'owner.status'],
      ['effect-profile', 'owner.profile'],
    ] as const) {
      const definition =
        kind === 'essence'
          ? { essenceId: key, contentVersion: 1, skill: { id: key, contentVersion: 1 } }
          : { id: key, contentVersion: 1 }
      await db.query('select * from public.publish_combat_content_v1($1,$2,$3,$4::jsonb,1)', [
        actor,
        key,
        kind,
        JSON.stringify(definition),
      ])
    }
    const current = await snapshot(db)
    expect(current.publications).toHaveLength(5)
    expect(current.publications.map((r) => r.content_key)).toEqual(
      [...current.publications.map((r) => r.content_key)].sort(),
    )
    expect(new Set(current.publications.map((r) => r.content_kind)).size).toBe(5)
    expect(current.token).not.toBe(empty.token)
    await db.query('select * from public.save_combat_content_draft_v1($1,$2,$3,$4::jsonb,2,null)', [
      actor,
      'owner.skill',
      'skill',
      JSON.stringify({ id: 'owner.skill', draft: 'unpublished' }),
    ])
    expect(await snapshot(db)).toEqual(current)
    await db.query('select * from public.publish_combat_content_v1($1,$2,$3,$4::jsonb,2)', [
      actor,
      'owner.skill',
      'skill',
      JSON.stringify({ id: 'owner.skill', contentVersion: 2, changed: true }),
    ])
    const updated = await snapshot(db)
    expect(updated.token).not.toBe(current.token)
    expect(updated.publications.find((r) => r.content_key === 'owner.skill')!.content_version).toBe(
      3,
    )
    expect(updated.publications).toHaveLength(5)
    await db.query('select public.set_combat_content_publication_v1($1,$2,$3,2)', [
      actor,
      'owner.skill',
      'skill',
    ])
    const restored = await snapshot(db)
    expect(restored.publications).toEqual(current.publications)
    expect(restored.token).not.toBe(current.token)
    await db.exec(
      'insert into app_private.combat_effect_timing_policy_versions(version,modes,reason) values(2,\'{"slow":"instant"}\',\'fixture existing history\')',
    )
    const timed = await snapshot(db)
    expect(timed.policy).toEqual({ version: 2, modes: { slow: 'instant' } })
    expect(timed.publications).toEqual(restored.publications)
    expect(timed.token).not.toBe(restored.token)
    await db.query('select public.set_combat_content_publication_v1($1,$2,$3,null)', [
      actor,
      'owner.skill',
      'skill',
    ])
    expect((await snapshot(db)).publications).toHaveLength(4)
    expect(
      (
        await db.query(
          "select * from app_private.combat_content_versions where content_key='owner.skill'",
        )
      ).rows,
    ).toHaveLength(2)
  } finally {
    await db.close()
  }
}, 20000)
it('exposes the atomic private snapshot only through a stable service-only function and changes no authoring/history state', async () => {
  const db = await database()
  try {
    const before = await snapshot(db)
    const metadata = await db.query<{
      stable: string
      definer: boolean
      client: boolean
      service: boolean
    }>(
      "select p.provolatile stable,p.prosecdef definer,has_function_privilege('authenticated',p.oid,'execute') client,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p where p.oid='public.read_combat_content_catalogue_v1()'::regprocedure",
    )
    expect(metadata.rows).toEqual([{ stable: 's', definer: true, client: false, service: true }])
    await db.exec('set role authenticated')
    await expect(snapshot(db)).rejects.toThrow('permission denied')
    await db.exec('reset role;set role service_role')
    expect(await snapshot(db)).toEqual(before)
    await db.exec('reset role')
    await db.exec(sql(snapshotMigration))
    expect(await snapshot(db)).toEqual(before)
    expect((await db.query('select * from app_private.combat_content_versions')).rows).toEqual([])
  } finally {
    await db.close()
  }
}, 20000)
