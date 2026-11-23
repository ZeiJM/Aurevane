import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const root = resolve(process.cwd(), '../..')
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const previous = JSON.parse(
  read('docs/superpowers/specs/2026-10-18-modular-correction-cohort.json'),
)
const candidate = JSON.parse(
  read('docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json'),
)
interface Row {
  kind: string
  id: string
  beforeVersion: number
  beforeDigest: string
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
  'return-to-turn-start': 'controlled',
  'barrier-change': 'instant',
  blindside: 'instant',
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
  const history = JSON.parse(
    read('docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json'),
  ).records.filter((row: Row) => row.kind !== 'basic')
  for (const records of [history, previous.records]) {
    await db.query(
      `insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
      select r->>'id',case when r->>'kind'='basic' then 'skill' else r->>'kind' end,
        (r->'after'->>'contentVersion')::integer,r->'after',$2::uuid
      from jsonb_array_elements($1::jsonb) r`,
      [JSON.stringify(records), owner],
    )
  }
  await db.query(
    `insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
    select v.content_key,v.content_kind,v.id,$2 from app_private.combat_content_versions v
    join jsonb_array_elements($1::jsonb) r on v.content_key=r->>'id'
      and v.content_version=(r->'after'->>'contentVersion')::integer`,
    [JSON.stringify(previous.records), owner],
  )
  await db.query(
    "insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority) values(8,$1::jsonb,$2,'global')",
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
function control(
  mode: 'publication' | 'rollback' | 'readback',
  expected: string,
  actor = owner,
  rows = cohort,
) {
  const path = `docs/verification/release-assets/2026-10-19-essence-resonance-${mode}.sql`
  if (!existsSync(resolve(root, path)))
    return "do $$begin raise exception 'ESSENCE_RESONANCE_RELEASE_NOT_IMPLEMENTED'; end$$;"
  return read(path)
    .replaceAll('__OWNER_ACTOR_UUID__', actor)
    .replaceAll('__EXPECTED_CATALOGUE_TOKEN__', expected)
    .replace('__COHORT_JSON__', JSON.stringify(rows))
    .replace('__BASELINE_JSON__', JSON.stringify(previous.records))
    .replaceAll('__DEPLOYED_SHA__', 'a'.repeat(40))
}
async function inventory(db: PGlite) {
  return (
    await db.query<{
      state: {
        history: number
        current: number
        drafts: number
        policy: unknown
        publications: { content_key: string; definition: unknown }[]
        immutable: { content_key: string; content_version: number; definition: unknown }[]
      }
    }>(`select jsonb_build_object(
    'history',(select count(*) from app_private.combat_content_versions),'current',(select count(*) from app_private.combat_content_publications),
    'drafts',(select count(*) from app_private.combat_content_drafts),'policy',public.read_combat_effect_timing_policy_v1(),
    'publications',(public.read_combat_content_catalogue_v1()->'publications'),
    'immutable',(select jsonb_agg(to_jsonb(v) order by content_key,content_version) from app_private.combat_content_versions v)) state`)
  ).rows[0]!.state
}

it('appends only the 136 identity changes and restores pointers while retaining all 719 immutable versions', async () => {
  const db = await database()
  try {
    const before = await inventory(db)
    expect(before).toMatchObject({
      history: 583,
      current: 294,
      drafts: 0,
      policy: { version: 8, tagAuthority: 'global', modes },
    })
    await db.exec(control('publication', await token(db)))
    const published = await inventory(db)
    expect(published).toMatchObject({
      history: 719,
      current: 294,
      drafts: 0,
      policy: before.policy,
    })
    expect(published.immutable).toEqual(expect.arrayContaining(before.immutable))
    for (const row of previous.records as Row[]) {
      const expected = cohort.find((value) => value.id === row.id)?.after ?? row.after
      expect(
        published.publications.find((value) => value.content_key === row.id)!.definition,
      ).toEqual(expected)
    }
    const readback = (
      await db.query<{ essence_resonance_readback: unknown }>(control('readback', await token(db)))
    ).rows[0]!.essence_resonance_readback
    expect(readback).toMatchObject({
      expected: 136,
      exact_current: 136,
      old_history_retained: 136,
      untouched: 158,
      exact_untouched: 158,
      history: 719,
      current: 294,
      drafts: 0,
      policy: before.policy,
      mismatches: [],
    })
    await db.exec(control('rollback', await token(db)))
    const restored = await inventory(db)
    expect(restored).toMatchObject({ history: 719, current: 294, drafts: 0, policy: before.policy })
    expect(restored.immutable).toEqual(published.immutable)
    for (const row of previous.records as Row[])
      expect(
        restored.publications.find((value) => value.content_key === row.id)!.definition,
      ).toEqual(row.after)
  } finally {
    await db.close()
  }
}, 120000)

it.each([
  'stale-token',
  'staff',
  'unregistered',
  'before-mismatch',
  'late-invalid-definition',
  'changed-policy',
  'new-draft',
  'untouched-change',
] as const)(
  'rejects %s atomically',
  async (scenario) => {
    const db = await database()
    try {
      if (scenario === 'changed-policy')
        await db.query(
          "insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority) values(9,$1::jsonb,$2,'global')",
          [JSON.stringify(modes), owner],
        )
      if (scenario === 'new-draft')
        await db.query(
          "insert into app_private.combat_content_drafts(content_key,content_kind,definition,updated_by) values('owner.new-draft','skill','{}',$1)",
          [owner],
        )
      // Deliberately corrupt an isolated fixture as a privileged operator; native writers cannot mutate history.
      if (scenario === 'untouched-change')
        await db.exec(
          'alter table app_private.combat_content_versions disable trigger prevent_combat_content_version_mutation_v1',
        )
      if (scenario === 'untouched-change')
        await db.query(
          "update app_private.combat_content_versions set definition=jsonb_set(definition,'{enabled}','false') where content_key=$1 and content_version=$2",
          [previous.records[0].id, previous.records[0].after.contentVersion],
        )
      const before = await inventory(db)
      const rows = structuredClone(cohort)
      if (scenario === 'before-mismatch')
        rows.at(-1)!.before = { ...rows.at(-1)!.before, enabled: false }
      if (scenario === 'late-invalid-definition') rows.at(-1)!.after.id = 'incorrect.identity'
      const reason =
        scenario === 'stale-token'
          ? /COMBAT_CONTENT_CATALOGUE_CONFLICT/
          : scenario === 'staff' || scenario === 'unregistered'
            ? /OWNER|FORBIDDEN/
            : scenario === 'changed-policy'
              ? /POLICY_CHANGED/
              : scenario === 'new-draft'
                ? /INVENTORY_CHANGED/
                : scenario === 'late-invalid-definition'
                  ? /IDENTITY_MISMATCH/
                  : /DEFINITION_CHANGED/
      await expect(
        db.exec(
          control(
            'publication',
            scenario === 'stale-token' ? '0'.repeat(32) : await token(db),
            scenario === 'staff'
              ? staff
              : scenario === 'unregistered'
                ? '33333333-3333-4333-8333-333333333333'
                : owner,
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

it.each(['stale-token', 'changed-current', 'changed-old-history', 'staff'] as const)(
  'rollback refuses %s and retains every pointer and version',
  async (scenario) => {
    const db = await database()
    try {
      await db.exec(control('publication', await token(db)))
      if (scenario === 'changed-current' || scenario === 'changed-old-history')
        await db.exec(
          'alter table app_private.combat_content_versions disable trigger prevent_combat_content_version_mutation_v1',
        )
      if (scenario === 'changed-current')
        await db.query(
          "update app_private.combat_content_versions set definition=jsonb_set(definition,'{enabled}','false') where content_key=$1 and content_version=$2",
          [cohort.at(-1)!.id, cohort.at(-1)!.after.contentVersion],
        )
      if (scenario === 'changed-old-history')
        await db.query(
          "update app_private.combat_content_versions set definition=jsonb_set(definition,'{enabled}','false') where content_key=$1 and content_version=$2",
          [cohort.at(-1)!.id, cohort.at(-1)!.beforeVersion],
        )
      const before = await inventory(db)
      await expect(
        db.exec(
          control(
            'rollback',
            scenario === 'stale-token' ? '0'.repeat(32) : await token(db),
            scenario === 'staff' ? staff : owner,
          ),
        ),
      ).rejects.toThrow(
        scenario === 'stale-token'
          ? /COMBAT_CONTENT_CATALOGUE_CONFLICT/
          : scenario === 'staff'
            ? /OWNER|FORBIDDEN/
            : /DEFINITION_CHANGED|HISTORY_CHANGED/,
      )
      await db.exec('rollback')
      expect(await inventory(db)).toEqual(before)
    } finally {
      await db.close()
    }
  },
  120000,
)

it('denies authenticated execution of privileged publication controls', async () => {
  const db = await database()
  try {
    const expected = await token(db)
    const before = await inventory(db)
    await db.exec('set role authenticated')
    await expect(db.exec(control('publication', expected))).rejects.toThrow(/permission denied/)
    await db.exec('rollback; reset role')
    expect(await inventory(db)).toEqual(before)
  } finally {
    await db.close()
  }
}, 120000)

it('binds deterministic reviewed SQL to exact fresh inventory and a deployed 40hex source SHA', async () => {
  const db = await database()
  const temporary = mkdtempSync(resolve(tmpdir(), 'essence-release-'))
  try {
    const snapshot = (
      await db.query<{ snapshot: Record<string, unknown> }>(
        "select public.read_combat_content_catalogue_v1() || jsonb_build_object('history',583,'current',294,'drafts',0) snapshot",
      )
    ).rows[0]!.snapshot
    const inventoryPath = resolve(temporary, 'inventory.json')
    const outputPath = resolve(temporary, 'publication.sql')
    writeFileSync(inventoryPath, JSON.stringify(snapshot))
    const args = [
      resolve(root, 'scripts/prepare-essence-resonance-release.py'),
      'publication',
      '--actor',
      owner,
      '--inventory',
      inventoryPath,
      '--deployed-sha',
      'a'.repeat(40),
      '--output',
      outputPath,
    ]
    const first = spawnSync('python3', args, { encoding: 'utf8' })
    expect(first.status, first.stderr).toBe(0)
    const sql = readFileSync(outputPath, 'utf8')
    const metadata = JSON.parse(first.stdout)
    expect(metadata).toMatchObject({
      mode: 'publication',
      records: 136,
      sourceSha: 'a'.repeat(40),
      sha256: createHash('sha256').update(sql).digest('hex'),
    })
    expect(sql).not.toMatch(/__[A-Z_]+__/)
    const second = spawnSync('python3', args, { encoding: 'utf8' })
    expect(second.status, second.stderr).toBe(0)
    expect(second.stdout).toBe(first.stdout)
    expect(readFileSync(outputPath, 'utf8')).toBe(sql)
    await db.exec(sql)
    const readbackPath = resolve(temporary, 'readback.sql')
    const readback = spawnSync('python3', [args[0]!, 'readback', '--output', readbackPath], {
      encoding: 'utf8',
    })
    expect(readback.status, readback.stderr).toBe(0)
    expect(
      (
        await db.query<{ essence_resonance_readback: { exact_current: number } }>(
          readFileSync(readbackPath, 'utf8'),
        )
      ).rows[0]!.essence_resonance_readback.exact_current,
    ).toBe(136)
    const after = (
      await db.query<{ snapshot: Record<string, unknown> }>(
        "select public.read_combat_content_catalogue_v1() || jsonb_build_object('history',719,'current',294,'drafts',0) snapshot",
      )
    ).rows[0]!.snapshot
    writeFileSync(inventoryPath, JSON.stringify(after))
    const rollbackArgs = args.map((value) => (value === 'publication' ? 'rollback' : value))
    const rollback = spawnSync('python3', rollbackArgs, { encoding: 'utf8' })
    expect(rollback.status, rollback.stderr).toBe(0)
    await db.exec(readFileSync(outputPath, 'utf8'))
    expect(await inventory(db)).toMatchObject({
      history: 719,
      current: 294,
      drafts: 0,
      policy: snapshot.policy,
    })
    const invalidSha = spawnSync(
      'python3',
      args.map((value) => (value === 'a'.repeat(40) ? 'abc' : value)),
      { encoding: 'utf8' },
    )
    expect(invalidSha.status).not.toBe(0)
    const wrong = structuredClone(snapshot) as {
      publications: { definition: { enabled: boolean } }[]
    }
    wrong.publications[0]!.definition.enabled = false
    writeFileSync(inventoryPath, JSON.stringify(wrong))
    expect(spawnSync('python3', args, { encoding: 'utf8' }).status).not.toBe(0)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
    await db.close()
  }
}, 120000)
