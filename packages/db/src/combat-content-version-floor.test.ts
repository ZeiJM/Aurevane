import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migration = '20261015191634_combat_content_version_floor.sql'
const owner = '11111111-1111-4111-8111-111111111111'
const sql = (name: string) =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', name), 'utf8')
async function database() {
  const db = await PGlite.create()
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create schema app_private;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');`,
  )
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
  ])
    await db.exec(sql(name))
  await db.query(
    "insert into app_private.master_panel_operators(user_id,role) values($1,'owner')",
    [owner],
  )
  for (const name of [
    '20260918193000_phase5_staff_authority_foundation.sql',
    '20260928042812_combat_content_essence_resonance_kinds.sql',
    '20261003040911_combat_effect_timing_policy.sql',
    '20261015071731_combat_controlled_timing.sql',
    '20261015073458_remove_combat_timing_reason.sql',
    '20261015095150_typed_combat_authoring_kinds.sql',
    '20261015100834_combat_content_catalogue_snapshot.sql',
    '20261015103321_combat_catalogue_publication_guard.sql',
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
const value = (kind: string, key: string) =>
  kind === 'essence'
    ? {
        essenceId: key,
        contentVersion: 1,
        skill: { id: key, contentVersion: 1, text: 'Owner text' },
      }
    : { id: key, contentVersion: 1, text: 'Owner text' }
async function publish(
  db: PGlite,
  kind: string,
  key: string,
  base: number | null,
  floor: number | null,
  expected?: string,
) {
  return db.query<{ content_version: number; definition: Record<string, unknown> }>(
    'select * from public.publish_combat_content_v3($1,$2,$3,$4::jsonb,$5,$6,$7)',
    [
      owner,
      key,
      kind,
      JSON.stringify(value(kind, key)),
      base,
      expected ?? (await token(db)),
      floor,
    ],
  )
}
async function snapshot(db: PGlite) {
  return (
    await db.query(`select jsonb_build_object(
    'versions',(select coalesce(jsonb_agg(v order by content_key,content_version),'[]') from app_private.combat_content_versions v),
    'drafts',(select coalesce(jsonb_agg(d order by content_key),'[]') from app_private.combat_content_drafts d),
    'publications',(select coalesce(jsonb_agg(p order by content_key),'[]') from app_private.combat_content_publications p)) as state`)
  ).rows
}
it.each(['skill', 'essence', 'resonance'])(
  'publishes %s above shipped and stored history while retaining older current-pointer CAS',
  async (kind) => {
    const db = await database()
    try {
      const key = `owner.${kind}`
      const old = await db.query(
        'select * from public.publish_combat_content_v2($1,$2,$3,$4::jsonb,null,$5)',
        [owner, key, kind, JSON.stringify(value(kind, key)), await token(db)],
      )
      await db.exec(sql(migration))
      await db.exec('set role service_role')
      const next = await publish(db, kind, key, 1, 8)
      expect(next.rows[0]!.content_version).toBe(9)
      expect(next.rows[0]!.definition).toMatchObject({ contentVersion: 9 })
      if (kind === 'essence')
        expect(next.rows[0]!.definition.skill).toMatchObject({
          contentVersion: 9,
          text: 'Owner text',
        })
      else expect(next.rows[0]!.definition.text).toBe('Owner text')
      await db.query('select public.set_combat_content_publication_v2($1,$2,$3,1,$4)', [
        owner,
        key,
        kind,
        await token(db),
      ])
      expect((await publish(db, kind, key, 1, 3)).rows[0]!.content_version).toBe(10)
      await db.exec('reset role')
      const history = (
        await db.query<{ content_version: number }>(
          'select content_version from app_private.combat_content_versions order by content_version',
        )
      ).rows
      expect(history.map((row) => row.content_version)).toEqual([1, 9, 10])
      expect(
        (
          await db.query<{ content_version: number }>(
            'select * from public.list_combat_content_versions_v1($1,$2)',
            [owner, key],
          )
        ).rows.find((row) => row.content_version === 1),
      ).toEqual(old.rows[0])
      await db.exec(sql(migration))
      expect(
        (
          await db.query(
            'select content_version from app_private.combat_content_versions order by content_version',
          )
        ).rows,
      ).toEqual(history)
    } finally {
      await db.close()
    }
  },
  20000,
)
it('rejects stale token/base and invalid or exhausted floors without partial state or draft deletion', async () => {
  const db = await database()
  try {
    await db.exec(sql(migration))
    await db.query('select * from public.save_combat_content_draft_v1($1,$2,$3,$4::jsonb,1,null)', [
      owner,
      'owner.skill',
      'skill',
      JSON.stringify(value('skill', 'owner.skill')),
    ])
    await db.exec('set role service_role')
    for (const floor of [0, -1, 2147483647]) {
      await db.exec('reset role')
      const before = await snapshot(db)
      await db.exec('set role service_role')
      await expect(publish(db, 'skill', 'owner.skill', 1, floor)).rejects.toThrow()
      await db.exec('reset role')
      expect(await snapshot(db)).toEqual(before)
      await db.exec('set role service_role')
    }
    const initialToken = await token(db)
    await publish(db, 'skill', 'owner.skill', 1, 8, initialToken)
    await db.exec('reset role')
    const before = await snapshot(db)
    await db.exec('set role service_role')
    await expect(publish(db, 'skill', 'owner.skill', 9, 8, initialToken)).rejects.toThrow(
      'COMBAT_CONTENT_CATALOGUE_CONFLICT',
    )
    await expect(publish(db, 'skill', 'owner.skill', 1, 8)).rejects.toThrow(
      'COMBAT_CONTENT_BASE_VERSION_CONFLICT',
    )
    await db.exec('reset role')
    expect(await snapshot(db)).toEqual(before)
  } finally {
    await db.close()
  }
}, 20000)
it('retains actual operator authorization and denies browser, private-helper and older service writers', async () => {
  const db = await database()
  try {
    await db.exec(sql(migration))
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      await expect(publish(db, 'skill', 'owner.skill', 1, 8, 'a'.repeat(32))).rejects.toThrow(
        'permission denied',
      )
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    for (const query of [
      "select * from public.publish_combat_content_v1($1,'owner.skill','skill','{}',1)",
      "select * from public.publish_combat_content_v2($1,'owner.skill','skill','{}',1,'a')",
      "select * from app_private.publish_combat_content_with_floor_v1($1,'owner.skill','skill','{}',1,8)",
    ])
      await expect(db.query(query, [owner])).rejects.toThrow('permission denied')
    await db.exec('reset role')
    await db.query(
      'update app_private.master_panel_role_assignments set enabled=false where user_id=$1',
      [owner],
    )
    await db.exec('set role service_role')
    await expect(publish(db, 'skill', 'owner.skill', 1, 8)).rejects.toThrow(
      'MASTER_PANEL_OPERATOR_REQUIRED',
    )
    await db.exec('reset role')
    expect(await snapshot(db)).toEqual([{ state: { versions: [], drafts: [], publications: [] } }])
  } finally {
    await db.close()
  }
}, 20000)
