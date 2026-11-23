import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
const sql = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
const migration = '20261015103321_combat_catalogue_publication_guard.sql'
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
async function database() {
  const db = await PGlite.create()
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create schema app_private;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${staff}');`,
  )
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
  ])
    await db.exec(sql(name))
  await db.query(
    "insert into app_private.master_panel_operators(user_id,role) values($1,'owner'),($2,'content-staff')",
    [owner, staff],
  )
  for (const name of [
    '20260918193000_phase5_staff_authority_foundation.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015071731_combat_controlled_timing.sql',
    '20261015073458_remove_combat_timing_reason.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    '20261015100834_combat_content_catalogue_snapshot.sql',
    migration,
  ])
    await db.exec(sql(name))
  return db
}
async function token(db: PGlite) {
  return (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
}
async function state(db: PGlite) {
  const result: unknown[] = []
  for (const table of [
    'combat_content_versions',
    'combat_content_publications',
    'combat_content_drafts',
    'combat_effect_timing_policy_versions',
  ])
    result.push((await db.query(`select * from app_private.${table} order by 1`)).rows)
  return result
}
async function publish(db: PGlite, expected: string, key = 'owner.skill', base = 1, actor = owner) {
  return db.query('select * from public.publish_combat_content_v2($1,$2,$3,$4::jsonb,$5,$6)', [
    actor,
    key,
    'skill',
    JSON.stringify({ id: key, contentVersion: base }),
    base,
    expected,
  ])
}
async function timing(db: PGlite, expected: string, version = 1, actor = owner) {
  return db.query(
    'select public.publish_combat_effect_timing_policy_v2($1,$2,\'{"slow":"instant"}\'::jsonb,$3)',
    [actor, version, expected],
  )
}
it('keeps global tag authority in coherent reads and later Owner timing saves without rewriting older policies', async () => {
  const db = await database()
  try {
    const before = (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows
    await db.exec(sql('20261018141646_modular_global_tag_timing.sql'))
    await db.query(
      'insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority) values(2,\'{"barrier-change":"instant","blindside":"instant"}\',$1,\'global\')',
      [owner],
    )
    await db.exec('set role service_role')
    const expected = {
      version: 2,
      modes: { 'barrier-change': 'instant', blindside: 'instant' },
      tagAuthority: 'global',
    }
    expect(
      (
        await db.query<{ policy: unknown }>(
          'select public.read_combat_effect_timing_policy_v1() as policy',
        )
      ).rows[0]!.policy,
    ).toEqual(expected)
    expect(
      (
        await db.query<{ policy: unknown }>(
          "select public.read_combat_content_catalogue_v1()->'policy' as policy",
        )
      ).rows[0]!.policy,
    ).toEqual(expected)
    await timing(db, await token(db), 2)
    expect(
      (
        await db.query<{ policy: unknown }>(
          'select public.read_combat_effect_timing_policy_v1() as policy',
        )
      ).rows[0]!.policy,
    ).toEqual({ version: 3, modes: { slow: 'instant' }, tagAuthority: 'global' })
    await db.exec('reset role')
    expect(
      (
        await db.query(
          'select version,modes,published_by,reason,published_at from app_private.combat_effect_timing_policy_versions where version=1',
        )
      ).rows,
    ).toEqual(before)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(timing(db, 'untrusted', 3)).rejects.toThrow('permission denied')
      await db.exec('reset role')
    }
  } finally {
    await db.close()
  }
}, 20_000)
it('rejects interleaved content, timing and history writes using the validated complete-catalogue token without partial state', async () => {
  const db = await database()
  try {
    await db.exec('set role service_role')
    const initial = await token(db)
    await timing(db, initial)
    await db.exec('reset role')
    const afterTiming = await state(db)
    await db.exec('set role service_role')
    await expect(publish(db, initial)).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    await db.exec('reset role')
    expect(await state(db)).toEqual(afterTiming)
    await db.exec('set role service_role')
    const beforePublish = await token(db)
    await publish(db, beforePublish)
    await expect(timing(db, beforePublish, 2)).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    const beforeSecond = await token(db)
    await publish(db, beforeSecond, 'owner.skill', 2)
    await expect(
      db.query("select public.set_combat_content_publication_v2($1,'owner.skill','skill',2,$2)", [
        owner,
        beforeSecond,
      ]),
    ).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    const beforeRestore = await token(db)
    await db.query(
      "select public.set_combat_content_publication_v2($1,'owner.skill','skill',2,$2)",
      [owner, beforeRestore],
    )
    await expect(timing(db, beforeRestore, 2)).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    await expect(publish(db, await token(db), 'owner.skill', 99)).rejects.toThrow(
      'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
    )
    await expect(timing(db, await token(db), 1)).rejects.toThrow('TIMING_POLICY_VERSION_CONFLICT')
    const beforeClear = await token(db)
    await db.query(
      "select public.set_combat_content_publication_v2($1,'owner.skill','skill',null,$2)",
      [owner, beforeClear],
    )
    await expect(timing(db, beforeClear, 2)).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    await db.exec('reset role')
    expect(
      (
        await db.query(
          'select content_version from app_private.combat_content_versions order by content_version',
        )
      ).rows,
    ).toEqual([{ content_version: 2 }, { content_version: 3 }])
    expect((await db.query('select * from app_private.combat_content_publications')).rows).toEqual(
      [],
    )
    expect(
      (
        await db.query(
          'select version,reason from app_private.combat_effect_timing_policy_versions where version=2',
        )
      ).rows,
    ).toEqual([{ version: 2, reason: null }])
  } finally {
    await db.close()
  }
}, 20000)
it('keeps actual Owner/operator authority, closes legacy service bypasses and rejects browser writers', async () => {
  const db = await database()
  try {
    await db.exec('set role authenticated')
    await expect(publish(db, 'a'.repeat(32))).rejects.toThrow('permission denied')
    await expect(timing(db, 'a'.repeat(32))).rejects.toThrow('permission denied')
    await db.exec('reset role;set role service_role')
    for (const query of [
      "select * from public.publish_combat_content_v1($1,'bypass','skill','{}',1)",
      "select public.set_combat_content_publication_v1($1,'bypass','skill',null)",
      "select public.publish_combat_effect_timing_policy_v1($1,1,'{}',null)",
    ])
      await expect(db.query(query, [owner])).rejects.toThrow('permission denied')
    await publish(db, await token(db), 'staff.skill', 1, staff)
    await expect(timing(db, await token(db), 1, staff)).rejects.toThrow(
      'MASTER_PANEL_OWNER_REQUIRED',
    )
    await expect(publish(db, '')).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    await expect(publish(db, 'A'.repeat(32))).rejects.toThrow('COMBAT_CONTENT_CATALOGUE_CONFLICT')
    await db.exec('reset role')
    await db.query(
      'update app_private.master_panel_role_assignments set enabled=false where user_id=$1',
      [owner],
    )
    await db.exec('set role service_role')
    await expect(publish(db, await token(db))).rejects.toThrow('MASTER_PANEL_OPERATOR_REQUIRED')
    await expect(timing(db, await token(db))).rejects.toThrow('MASTER_PANEL_OWNER_REQUIRED')
    await db.exec('reset role')
    expect(
      (await db.query('select content_key from app_private.combat_content_versions')).rows,
    ).toEqual([{ content_key: 'staff.skill' }])
  } finally {
    await db.close()
  }
}, 20000)
it('rolls back immutable version, current pointer and draft deletion on a downstream failure and supports reapplication', async () => {
  const db = await database()
  try {
    await db.query(
      "select * from public.save_combat_content_draft_v1($1,'owner.break','skill','{\"id\":\"owner.break\"}',1,null)",
      [owner],
    )
    await db.exec(
      `create function app_private.fail_guard_fixture() returns trigger language plpgsql as $$begin raise exception 'POINTER_FAILURE';end$$;create trigger fail_guard_fixture before insert on app_private.combat_content_publications for each row execute function app_private.fail_guard_fixture();`,
    )
    const before = await state(db)
    const beforeToken = await token(db)
    await db.exec('set role service_role')
    await expect(publish(db, beforeToken, 'owner.break')).rejects.toThrow('POINTER_FAILURE')
    await db.exec('reset role')
    expect(await state(db)).toEqual(before)
    expect(await token(db)).toBe(beforeToken)
    await db.exec(sql(migration))
    expect(await state(db)).toEqual(before)
    expect(await token(db)).toBe(beforeToken)
  } finally {
    await db.close()
  }
}, 20000)
