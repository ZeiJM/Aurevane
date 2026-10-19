import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const root = resolve(process.cwd(), '../..')
const owner = '11111111-1111-4111-8111-111111111111'
const staff = '22222222-2222-4222-8222-222222222222'
const sourceSha = 'a'.repeat(40)
const prefix = '2026-10-19-resonance-modularity'
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
interface Row {
  kind: string
  id: string
  beforeVersion: number
  beforeDigest: string
  after: Record<string, unknown> & { contentVersion: number }
}
const october18 = JSON.parse(
  read('docs/superpowers/specs/2026-10-18-modular-correction-cohort.json'),
) as { records: Row[] }
const october19 = JSON.parse(
  read('docs/superpowers/specs/2026-10-19-essence-resonance-identity-cohort.json'),
) as { records: Row[] }
const candidateText = read(`docs/superpowers/specs/${prefix}-cohort.json`)
const candidate = JSON.parse(candidateText) as { records: Row[] }
const designText = read(`docs/superpowers/specs/${prefix}-designs.json`)
const releaseControl = JSON.parse(
  read(`docs/verification/release-assets/${prefix}-release-control.json`),
)
const effective = new Map(october18.records.map((row) => [row.id, row]))
for (const row of october19.records) effective.set(row.id, row)
const baseline = [...effective.values()].map(({ kind, id, after }) => ({ kind, id, after }))
const cohort = candidate.records.map((row) => ({ ...row, before: effective.get(row.id)!.after }))
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
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema app_private; create table auth.users(id uuid primary key);
    insert into auth.users values('${owner}'),('${staff}');`)
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
  const original = JSON.parse(
    read('docs/superpowers/specs/2026-10-10-roster-rebalance-proposals.json'),
  ).records.filter((row: Row) => row.kind !== 'basic')
  expect(original).toHaveLength(289)
  expect(october18.records).toHaveLength(294)
  expect(october19.records).toHaveLength(136)
  for (const records of [original, october18.records, october19.records]) {
    await db.query(
      `insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
      select r->>'id',case when r->>'kind'='basic' then 'skill' else r->>'kind' end,
      (r->'after'->>'contentVersion')::integer,r->'after',$2::uuid from jsonb_array_elements($1::jsonb) r`,
      [JSON.stringify(records), owner],
    )
  }
  await db.query(
    `insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
    select v.content_key,v.content_kind,v.id,$2 from app_private.combat_content_versions v
    join jsonb_array_elements($1::jsonb) r on v.content_key=r->>'id'
      and v.content_version=(r->'after'->>'contentVersion')::integer`,
    [JSON.stringify(baseline), owner],
  )
  await db.query(
    "insert into app_private.combat_effect_timing_policy_versions(version,modes,published_by,tag_authority) values(8,$1::jsonb,$2,'global')",
    [JSON.stringify(modes), owner],
  )
  return db
}
interface Inventory {
  history: number
  current: number
  drafts: number
  token: string
  policy: unknown
  publications: { content_key: string; content_version: number; definition: unknown }[]
  immutable: unknown[]
}
async function inventory(db: PGlite): Promise<Inventory> {
  return (
    await db.query<{
      state: Inventory
    }>(`select public.read_combat_content_catalogue_v1() || jsonb_build_object(
    'history',(select count(*) from app_private.combat_content_versions),
    'current',(select count(*) from app_private.combat_content_publications),
    'drafts',(select count(*) from app_private.combat_content_drafts),
    'policy',public.read_combat_effect_timing_policy_v1(),
    'immutable',(select jsonb_agg(to_jsonb(v) order by content_key,content_version) from app_private.combat_content_versions v)) state`)
  ).rows[0]!.state
}
function rawControl(
  mode: 'publication' | 'rollback',
  expected: string,
  actor = owner,
  rows = cohort,
) {
  const path = `docs/verification/release-assets/${prefix}-${mode}.sql`
  expect(hash(read(path))).toBe(releaseControl.templates[mode])
  return read(path)
    .replaceAll('__OWNER_ACTOR_UUID__', actor)
    .replaceAll('__EXPECTED_CATALOGUE_TOKEN__', expected)
    .replace('__COHORT_JSON__', JSON.stringify(rows))
    .replace('__BASELINE_JSON__', JSON.stringify(baseline))
    .replaceAll('__DEPLOYED_SHA__', sourceSha)
    .replaceAll('__CANDIDATE_SHA256__', hash(candidateText))
    .replaceAll('__DESIGN_SHA256__', hash(designText))
    .replaceAll('__EFFECTIVE_BASELINE_SHA256__', 'b'.repeat(64))
}
function boundControl(
  directory: string,
  mode: 'publication' | 'rollback' | 'readback',
  snapshot?: Inventory,
  state = 'published',
) {
  const output = resolve(directory, `${mode}-${state}.sql`)
  const args = [
    resolve(root, 'scripts/prepare-resonance-modularity-release.py'),
    mode,
    '--output',
    output,
    '--deployed-sha',
    sourceSha,
  ]
  if (mode === 'readback') args.push('--state', state)
  else {
    const inventoryPath = resolve(directory, `${mode}-inventory.json`)
    writeFileSync(inventoryPath, JSON.stringify(snapshot))
    args.push('--actor', owner, '--inventory', inventoryPath)
  }
  const result = spawnSync('python3', args, {
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  expect(result.status, result.stderr).toBe(0)
  const sql = readFileSync(output, 'utf8')
  expect(sql).not.toMatch(/__[A-Z_]+__/)
  expect(JSON.parse(result.stdout)).toMatchObject({
    mode,
    records: 68,
    candidateSha256: hash(candidateText),
    designSha256: hash(designText),
    sourceSha,
    sha256: hash(sql),
  })
  return sql
}
interface Readback {
  exact_current: number
  exact_untouched: number
  current_mismatch_count: number
  old_history_mismatch_count: number
  new_history_mismatch_count: number
  expected_current_hash: string
  actual_current_hash: string
  history_hash: string
}
async function readback(db: PGlite, sql: string) {
  return (await db.query<{ resonance_modularity_readback: Readback }>(sql)).rows[0]!
    .resonance_modularity_readback
}

it('publishes68 exact versions from719 history then restores all294 pointers while retaining787 versions', async () => {
  const db = await database()
  const temporary = mkdtempSync(resolve(tmpdir(), 'resonance-modularity-native-'))
  try {
    expect(hash(candidateText)).toBe(releaseControl.candidateSha256)
    expect(hash(designText)).toBe(releaseControl.designSha256)
    const before = await inventory(db)
    expect(before).toMatchObject({
      history: 719,
      current: 294,
      drafts: 0,
      policy: { version: 8, tagAuthority: 'global', modes },
    })
    await db.exec(boundControl(temporary, 'publication', before))
    const published = await inventory(db)
    expect(published).toMatchObject({
      history: 787,
      current: 294,
      drafts: 0,
      policy: before.policy,
    })
    expect(published.immutable).toEqual(expect.arrayContaining(before.immutable))
    for (const row of baseline) {
      const expected = cohort.find((value) => value.id === row.id)?.after ?? row.after
      expect(
        published.publications.find((value) => value.content_key === row.id)!.definition,
        row.id,
      ).toEqual(expected)
    }
    const released = await readback(db, boundControl(temporary, 'readback'))
    expect(released).toMatchObject({
      exact_current: 294,
      exact_untouched: 226,
      current_mismatch_count: 0,
      old_history_mismatch_count: 0,
      new_history_mismatch_count: 0,
      history: 787,
      current: 294,
      drafts: 0,
      policy_matches: true,
      policy: before.policy,
      mismatches: [],
      candidateSha256: hash(candidateText),
      designSha256: hash(designText),
      compatibleSourceSha: sourceSha,
    })
    expect(released.actual_current_hash).toBe(released.expected_current_hash)
    await db.exec(boundControl(temporary, 'rollback', published))
    const restored = await inventory(db)
    expect(restored).toMatchObject({ history: 787, current: 294, drafts: 0, policy: before.policy })
    expect(restored.immutable).toEqual(published.immutable)
    for (const row of baseline)
      expect(
        restored.publications.find((value) => value.content_key === row.id)!.definition,
        row.id,
      ).toEqual(row.after)
    const rolledBack = await readback(
      db,
      boundControl(temporary, 'readback', undefined, 'rolled-back'),
    )
    expect(rolledBack).toMatchObject({
      exact_current: 294,
      exact_untouched: 226,
      current_mismatch_count: 0,
      old_history_mismatch_count: 0,
      new_history_mismatch_count: 0,
      history: 787,
      current: 294,
      drafts: 0,
      mismatches: [],
    })
    expect(rolledBack.actual_current_hash).toBe(rolledBack.expected_current_hash)
    expect(rolledBack.history_hash).toBe(released.history_hash)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
    await db.close()
  }
}, 120000)

it.each(['stale-token', 'staff', 'baseline-changed', 'late-invalid-definition'] as const)(
  'rejects %s atomically through actual native SQL controls',
  async (scenario) => {
    const db = await database()
    try {
      if (scenario === 'baseline-changed') {
        // Isolated fixture corruption only: real version writers have immutable-row protection.
        await db.exec(
          'alter table app_private.combat_content_versions disable trigger prevent_combat_content_version_mutation_v1',
        )
        await db.query(
          "update app_private.combat_content_versions set definition=jsonb_set(definition,'{enabled}','false') where content_key=$1 and content_version=$2",
          [baseline[0]!.id, baseline[0]!.after.contentVersion],
        )
      }
      const before = await inventory(db)
      const rows = structuredClone(cohort)
      if (scenario === 'late-invalid-definition') rows.at(-1)!.after.id = 'incorrect.identity'
      await expect(
        db.exec(
          rawControl(
            'publication',
            scenario === 'stale-token' ? '0'.repeat(32) : before.token,
            scenario === 'staff' ? staff : owner,
            rows,
          ),
        ),
      ).rejects.toThrow(
        scenario === 'stale-token'
          ? /COMBAT_CONTENT_CATALOGUE_CONFLICT/
          : scenario === 'staff'
            ? /OWNER|FORBIDDEN/
            : scenario === 'baseline-changed'
              ? /PRECHECK_CURRENT_MISMATCH/
              : /IDENTITY_MISMATCH/,
      )
      await db.exec('rollback')
      expect(await inventory(db)).toEqual(before)
    } finally {
      await db.close()
    }
  },
  120000,
)

it('rollback rejects stale CAS, staff and changed published definitions without losing any version or pointer', async () => {
  const db = await database()
  try {
    let snapshot = await inventory(db)
    await db.exec(rawControl('publication', snapshot.token))
    for (const scenario of ['stale-token', 'staff', 'changed-current'] as const) {
      if (scenario === 'changed-current') {
        await db.exec(
          'alter table app_private.combat_content_versions disable trigger prevent_combat_content_version_mutation_v1',
        )
        await db.query(
          "update app_private.combat_content_versions set definition=jsonb_set(definition,'{enabled}','false') where content_key=$1 and content_version=$2",
          [cohort.at(-1)!.id, cohort.at(-1)!.after.contentVersion],
        )
      }
      snapshot = await inventory(db)
      await expect(
        db.exec(
          rawControl(
            'rollback',
            scenario === 'stale-token' ? '0'.repeat(32) : snapshot.token,
            scenario === 'staff' ? staff : owner,
          ),
        ),
      ).rejects.toThrow(
        scenario === 'stale-token'
          ? /COMBAT_CONTENT_CATALOGUE_CONFLICT/
          : scenario === 'staff'
            ? /OWNER|FORBIDDEN/
            : /PRECHECK_CURRENT_MISMATCH/,
      )
      await db.exec('rollback')
      expect(await inventory(db)).toEqual(snapshot)
      expect(snapshot.history).toBe(787)
    }
  } finally {
    await db.close()
  }
}, 120000)
