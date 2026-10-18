import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const root = resolve(process.cwd(), '../..')
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const previous = JSON.parse(
  read('docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json'),
)
const candidate = JSON.parse(
  read('docs/superpowers/specs/2026-10-18-modular-correction-cohort.json'),
)
interface Row {
  kind: string
  id: string
  beforeVersion: number
  after: Record<string, unknown>
}
const cohort = (candidate.records as Row[]).map((row) => ({
  ...row,
  kind: row.kind === 'basic' ? 'skill' : row.kind,
  before:
    row.kind === 'basic' ? null : previous.records.find((old: Row) => old.id === row.id).after,
}))
const modes = {
  summon: 'instant',
  displace: 'instant',
  'mp-drain': 'instant',
  'remove-status': 'instant',
  'return-to-turn-start': 'delayed',
}
async function database() {
  const db = await PGlite.create()
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create schema app_private; create table auth.users(id uuid primary key); insert into auth.users values('${owner}'),('${staff}');`,
  )
  for (const name of [
    '20260917213000_combat_content_authoring.sql',
    '20260917214500_combat_content_resolver.sql',
    '20260917220000_master_panel_combat_authoring.sql',
  ])
    await db.exec(read(`supabase/migrations/${name}`))
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
    '20261015103321_combat_catalogue_publication_guard.sql',
    '20261015191634_combat_content_version_floor.sql',
    '20261018141646_modular_global_tag_timing.sql',
  ])
    await db.exec(read(`supabase/migrations/${name}`))
  await db.query(
    `insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
    select r->>'id',r->>'kind',(r->'before'->>'contentVersion')::integer,r->'before',$2::uuid
    from jsonb_array_elements($1::jsonb) r where r->'before' <> 'null'::jsonb`,
    [JSON.stringify(cohort), owner],
  )
  await db.query(
    `insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
    select content_key,content_kind,id,$1 from app_private.combat_content_versions`,
    [owner],
  )
  await db.query(
    'insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by) values(7,$1::jsonb,$2)',
    [JSON.stringify(modes), owner],
  )
  return db
}
async function token(db: PGlite) {
  return (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
}
function control(mode: 'publication' | 'rollback', expected: string, actor = owner, rows = cohort) {
  const path = `docs/verification/release-assets/2026-10-18-modular-${mode}.sql`
  if (!existsSync(resolve(root, path)))
    return "do $$begin raise exception 'MODULAR_RELEASE_NOT_IMPLEMENTED'; end$$;"
  return read(path)
    .replaceAll('__OWNER_ACTOR_UUID__', actor)
    .replaceAll('__EXPECTED_CATALOGUE_TOKEN__', expected)
    .replace('__COHORT_JSON__', JSON.stringify(rows))
}
async function inventory(db: PGlite) {
  return (
    await db.query<{
      state: {
        history: number
        current: number
        drafts: number
        policy: unknown
        publications: unknown
      }
    }>(`select jsonb_build_object(
    'history',(select count(*) from app_private.combat_content_versions),'current',(select count(*) from app_private.combat_content_publications),
    'drafts',(select count(*) from app_private.combat_content_drafts),'policy',public.read_combat_effect_timing_policy_v1(),
    'publications',(public.read_combat_content_catalogue_v1()->'publications')) state`)
  ).rows[0]!.state
}
it('atomically publishes all 294 corrections and rolls current choices back without deleting captured history', async () => {
  const db = await database()
  try {
    const before = await inventory(db)
    expect(before).toMatchObject({
      history: 289,
      current: 289,
      drafts: 0,
      policy: { version: 7, modes },
    })
    await db.exec(control('publication', await token(db)))
    const published = await inventory(db)
    expect(published).toMatchObject({
      history: 583,
      current: 294,
      drafts: 0,
      policy: {
        version: 8,
        tagAuthority: 'global',
        modes: { ...modes, ...candidate.timingChanges.modes },
      },
    })
    const actual = published.publications as { content_key: string; definition: unknown }[]
    for (const row of cohort)
      expect(actual.find((value) => value.content_key === row.id)!.definition).toEqual(row.after)
    await expect(db.exec(control('rollback', '0'.repeat(32)))).rejects.toThrow(
      /COMBAT_CONTENT_CATALOGUE_CONFLICT/,
    )
    await db.exec('rollback')
    expect(await inventory(db)).toEqual(published)
    const readback = read(
      'docs/verification/release-assets/2026-10-18-modular-readback.sql',
    ).replace('__COHORT_JSON__', JSON.stringify(cohort))
    expect(
      (await db.query<{ modular_readback: unknown }>(readback)).rows[0]!.modular_readback,
    ).toMatchObject({
      expected: 294,
      exact_current: 294,
      old_history_retained: 294,
      history: 583,
      current: 294,
      drafts: 0,
      mismatches: [],
    })
    await db.exec(control('rollback', await token(db)))
    const restored = await inventory(db)
    expect(restored).toMatchObject({
      history: 583,
      current: 289,
      drafts: 0,
      policy: { version: 9, modes },
    })
    expect(restored.policy).not.toHaveProperty('tagAuthority')
    for (const row of cohort.filter((row) => row.before))
      expect(
        (restored.publications as typeof actual).find((value) => value.content_key === row.id)!
          .definition,
      ).toEqual(row.before)
    for (const row of cohort) {
      const retained = await db.query<{ definition: unknown }>(
        'select definition from app_private.combat_content_versions where content_key=$1 and content_version=$2',
        [row.id, row.after.contentVersion],
      )
      expect(retained.rows[0]!.definition).toEqual(row.after)
    }
  } finally {
    await db.close()
  }
}, 120000)
it.each([
  'stale-token',
  'not-owner',
  'late-invalid-definition',
  'changed-policy',
  'new-draft',
] as const)(
  'rejects %s without a partial correction publication',
  async (scenario) => {
    const db = await database()
    try {
      if (scenario === 'changed-policy')
        await db.query(
          'insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by) values(8,$1::jsonb,$2)',
          [JSON.stringify(modes), owner],
        )
      if (scenario === 'new-draft')
        await db.query(
          "insert into app_private.combat_content_drafts(content_key,content_kind,definition,updated_by) values('owner.new-draft','skill','{}',$1)",
          [owner],
        )
      const before = await inventory(db)
      const rows = structuredClone(cohort)
      if (scenario === 'late-invalid-definition') rows.at(-1)!.after.id = 'incorrect.identity'
      const reason =
        scenario === 'stale-token'
          ? /COMBAT_CONTENT_CATALOGUE_CONFLICT/
          : scenario === 'not-owner'
            ? /OWNER|FORBIDDEN/
            : scenario === 'changed-policy'
              ? /MODULAR_RELEASE_POLICY_CHANGED/
              : scenario === 'new-draft'
                ? /MODULAR_RELEASE_INVENTORY_CHANGED/
                : /IDENTITY_MISMATCH/
      await expect(
        db.exec(
          control(
            'publication',
            scenario === 'stale-token' ? '0'.repeat(32) : await token(db),
            scenario === 'not-owner' ? staff : owner,
            rows,
          ),
        ),
      ).rejects.toThrow(reason)
      await db.exec('rollback')
      expect(await inventory(db)).toEqual(before)
    } finally {
      await db.close()
    }
  },
  120000,
)
