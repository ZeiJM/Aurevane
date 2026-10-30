import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '00000000-0000-4000-8000-000000000001'
const character = '00000000-0000-4000-8000-000000000011'
const read = (name: string) =>
  readFileSync(
    new URL(`../../../docs/verification/release-assets/${name}`, import.meta.url),
    'utf8',
  )
const candidates = JSON.parse(read('2026-10-29-chilled-cleanse-candidate.json')).records as {
  id: string
  kind: string
  beforeVersion: number
  afterVersion: number
  before: Record<string, unknown>
  after: Record<string, unknown>
  baseline: { revision: number; draft_sequence: number; version_floor: number }
}[]
const first = candidates[0]!
const last = candidates.at(-1)!
const template = read('2026-10-29-chilled-cleanse-publication.sql')
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${owner}',0,1,'Zei','zei','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
  for (const row of candidates) {
    const historical = structuredClone(row.before)
    historical.contentVersion = row.beforeVersion - 1
    if (historical.skill)
      (historical.skill as Record<string, unknown>).contentVersion = row.beforeVersion - 1
    await seedPublication(row.id, historical, row.beforeVersion - 1, row.kind)
    await seedPublication(row.id, row.before, row.beforeVersion, row.kind)
    await db.query(
      `insert into app_private.combat_content_records(content_key,content_kind,lifecycle,revision,draft_sequence,version_floor)
       values($1,$2,'active',$3,$4,$5) on conflict(content_key) do update set lifecycle='active',
       revision=excluded.revision,draft_sequence=excluded.draft_sequence,version_floor=excluded.version_floor`,
      [
        row.id,
        row.kind,
        row.baseline.revision,
        row.baseline.draft_sequence,
        row.baseline.version_floor,
      ],
    )
  }
  await seedPublication('owner.sentinel', { id: 'owner.sentinel', contentVersion: 1 }, 1)
  await db.exec(`insert into app_private.combat_content_records(content_key,content_kind,lifecycle,version_floor)
    values('owner.sentinel','skill','active',1) on conflict(content_key) do nothing;`)
  await db.query(
    `insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,updated_by)
     values('owner.sentinel','skill','{"id":"owner.sentinel","note":"Owner edit survives"}',1,$1)`,
    [owner],
  )
})
afterEach(async () => db.exec('rollback'))
async function seedPublication(id: string, definition: object, version: number, kind = 'skill') {
  // Fixture import of immutable retained history; publication under test uses the actual authoring API.
  const result = await db.query<{ id: string }>(
    'insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by) values($1,$5,$2,$3,$4) returning id',
    [id, version, definition, owner, kind],
  )
  await db.query(
    'insert into app_private.combat_content_attribution(version_id,authored_by,authored_at) values($1,$2,now())',
    [result.rows[0]!.id, owner],
  )
  await db.query(
    'insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by) values($1,$4,$2,$3) on conflict(content_key) do update set version_id=excluded.version_id',
    [id, result.rows[0]!.id, owner, kind],
  )
}
async function pointAt(id: string, version: number) {
  await db.query(
    'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
    [id, version],
  )
}
async function token() {
  return (
    await db.query<{ token: string }>(
      'select public.read_combat_content_catalogue_token_v1() token',
    )
  ).rows[0]!.token
}
async function current(row = first) {
  return (
    await db.query<{ content_version: number; definition: object }>(
      'select * from public.read_current_combat_content_v1($1,$2)',
      [row.id, row.kind],
    )
  ).rows[0]!
}
async function snapshot() {
  return (
    await db.query<{ state: Record<string, unknown[]> }>(`select jsonb_build_object(
    'attribution',(select jsonb_agg(to_jsonb(a) order by a.version_id) from app_private.combat_content_attribution a),
    'history',(select jsonb_agg(to_jsonb(v) order by v.content_key,v.content_version) from app_private.combat_content_versions v),
    'publications',(select jsonb_agg(to_jsonb(p) order by p.content_key) from app_private.combat_content_publications p),
    'drafts',(select jsonb_agg(to_jsonb(d) order by d.content_key) from app_private.combat_content_drafts d),
    'records',(select jsonb_agg(to_jsonb(r) order by r.content_key) from app_private.combat_content_records r),
    'policy',(select jsonb_agg(to_jsonb(p) order by p.version) from app_private.combat_effect_timing_policy_versions p)
  ) state`)
  ).rows[0]!.state
}
async function execute(expectedToken = '') {
  // The exact production block and locks run within the enclosing fixture transaction.
  return db.exec(
    template
      .replace('__RECORDS_JSON__', JSON.stringify(candidates))
      .replace('__EXPECTED_CATALOGUE_TOKEN__', expectedToken || (await token()))
      .replace(/^begin;$/m, '')
      .replace(/^commit;$/m, ''),
  )
}
async function rejected(run: () => Promise<unknown>, message: RegExp) {
  const before = await snapshot()
  await db.exec('savepoint rejected')
  await expect(run()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
  expect(await snapshot()).toEqual(before)
}

it('appends exactly seven reviewed current versions using the selected-character API and preserves old history and Owner drafts', async () => {
  const before = await snapshot()
  await execute()
  for (const row of candidates) {
    expect(await current(row)).toMatchObject({
      content_version: row.afterVersion,
      definition: row.after,
    })
  }
  const after = await snapshot()
  expect(after.history).toHaveLength(before.history!.length + 7)
  expect(after.history).toEqual(expect.arrayContaining(before.history!))
  expect(after.attribution).toHaveLength(before.attribution!.length + 7)
  expect(after.attribution).toEqual(expect.arrayContaining(before.attribution!))
  expect(after.drafts).toEqual(before.drafts)
  expect(after.policy).toEqual(before.policy)
  for (const table of ['records', 'publications']) {
    const unrelated = (rows: unknown[]) =>
      rows.filter(
        (row) =>
          !candidates.some(
            (candidate) => candidate.id === (row as { content_key: string }).content_key,
          ),
      )
    expect(unrelated(after[table]!)).toEqual(unrelated(before[table]!))
  }
})
it('does nothing on an exact published retry with a fresh token', async () => {
  await execute()
  const before = await snapshot()
  await execute()
  expect(await snapshot()).toEqual(before)
})
it('rejects stale external catalogue CAS before changes', async () => {
  const stale = await token()
  await db.exec(
    "update app_private.combat_content_records set revision=revision+1 where content_key='owner.sentinel'",
  )
  await rejected(() => execute(stale), /COMBAT_CONTENT_CATALOGUE_CONFLICT/)
})
it('rejects a changed pointer and higher Owner history even when the old pointer is restored', async () => {
  await pointAt(first.id, first.beforeVersion - 1)
  await rejected(() => execute(), /CHILLED_CLEANSE_BASELINE_CHANGED/)
  await pointAt(first.id, first.beforeVersion)
  await seedPublication(
    first.id,
    { ...first.after, flavorLine: 'Owner revised this' },
    first.afterVersion,
    first.kind,
  )
  await rejected(() => execute(), /CHILLED_CLEANSE_BASELINE_CHANGED/)
  await pointAt(first.id, first.beforeVersion)
  await rejected(() => execute(), /CHILLED_CLEANSE_BASELINE_CHANGED/)
})
it('rejects changed authoring revision without overwriting the Owner state', async () => {
  await db.query(
    'update app_private.combat_content_records set revision=revision+1 where content_key=$1',
    [first.id],
  )
  await rejected(() => execute(), /CHILLED_CLEANSE_RECORD_STATE_CHANGED/)
})
it('rejects changed last-record baseline and atomically rolls back the preceding six appends', async () => {
  await seedPublication(
    last.id,
    { ...last.after, flavorLine: 'Owner alternative' },
    last.afterVersion,
    last.kind,
  )
  await rejected(() => execute(), /CHILLED_CLEANSE_BASELINE_CHANGED/)
  expect((await current()).content_version).toBe(first.beforeVersion)
})
it('preserves a last-record Owner draft and rolls back all earlier appends', async () => {
  await db.query(
    `insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,updated_by) values($1,$2,$3,$4,$5)`,
    [last.id, last.kind, last.before, last.beforeVersion, owner],
  )
  await rejected(() => execute(), /CHILLED_CLEANSE_HAS_UNCOMMITTED_DRAFT/)
  expect((await current()).content_version).toBe(first.beforeVersion)
})
it('rolls back all seven appends when the final publication changes an unrelated Owner draft', async () => {
  await db.exec(`create function pg_temp.corrupt_chilled_sentinel() returns trigger language plpgsql as $$
    begin
      if new.content_key='${last.id}' and new.content_version=${last.afterVersion} then
        update app_private.combat_content_drafts set draft_version=draft_version+1 where content_key='owner.sentinel';
      end if;
      return new;
    end; $$;
    create trigger test_corrupt_chilled_sentinel after insert on app_private.combat_content_versions
      for each row execute function pg_temp.corrupt_chilled_sentinel();`)
  await rejected(() => execute(), /CHILLED_CLEANSE_PRESERVATION_MISMATCH/)
  expect((await current()).content_version).toBe(first.beforeVersion)
})
it('requires live Owner authorization even for an already published retry', async () => {
  await execute()
  await db.query(
    "update app_private.master_panel_role_assignments set enabled=false where user_id=$1 and role='game-owner'",
    [owner],
  )
  await rejected(() => execute(), /GAME_OWNER|OWNER_REQUIRED/)
})
