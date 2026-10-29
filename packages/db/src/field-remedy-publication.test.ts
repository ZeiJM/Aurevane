import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '00000000-0000-4000-8000-000000000001'
const character = '00000000-0000-4000-8000-000000000011'
const key = 'wildwarden.field-remedy'
const read = (name: string) =>
  readFileSync(
    new URL(`../../../docs/verification/release-assets/${name}`, import.meta.url),
    'utf8',
  )
const candidate = JSON.parse(read('2026-10-29-field-remedy-recovery-candidate.json'))
  .records[0] as {
  before: Record<string, unknown>
  after: Record<string, unknown>
}
const template = read('2026-10-29-field-remedy-recovery-publication.sql')
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
  await seedPublication(key, { ...candidate.before, contentVersion: 6 }, 6)
  await seedPublication(key, candidate.before, 7)
  await seedPublication('owner.sentinel', { id: 'owner.sentinel', contentVersion: 1 }, 1)
  await db.query(
    `insert into app_private.combat_content_records(content_key,content_kind,lifecycle,version_floor)
      values($1,'skill','active',7),('owner.sentinel','skill','active',1)
      on conflict(content_key) do update set lifecycle='active',version_floor=excluded.version_floor`,
    [key],
  )
  await db.query(
    `insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,updated_by)
      values('owner.sentinel','skill','{"id":"owner.sentinel","note":"preserve me"}',1,$1)`,
    [owner],
  )
})
afterEach(async () => db.exec('rollback'))
async function seedPublication(id: string, definition: object, version: number) {
  // Import retained publication history as fixture data; production uses current saved revisions.
  const result = await db.query<{ id: string }>(
    "insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by) values($1,'skill',$2,$3,$4) returning id",
    [id, version, definition, owner],
  )
  await db.query(
    'insert into app_private.combat_content_attribution(version_id,authored_by,authored_at) values($1,$2,now())',
    [result.rows[0]!.id, owner],
  )
  await db.query(
    "insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by) values($1,'skill',$2,$3) on conflict(content_key) do update set version_id=excluded.version_id",
    [id, result.rows[0]!.id, owner],
  )
}
async function pointAt(version: number) {
  await db.query(
    'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
    [key, version],
  )
}
async function token() {
  return (
    await db.query<{ token: string }>(
      'select public.read_combat_content_catalogue_token_v1() token',
    )
  ).rows[0]!.token
}
async function current() {
  return (
    await db.query<{ content_version: number; definition: object }>(
      "select * from public.read_current_combat_content_v1($1,'skill')",
      [key],
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
  // Keep the production DO block and lock statements exact, inside the test transaction.
  const sql = template
    .replace('__BEFORE_JSON__', JSON.stringify(candidate.before))
    .replace('__AFTER_JSON__', JSON.stringify(candidate.after))
    .replace('__EXPECTED_CATALOGUE_TOKEN__', expectedToken || (await token()))
    .replace(/^begin;$/m, '')
    .replace(/^commit;$/m, '')
  return db.exec(sql)
}
async function rejected(run: () => Promise<unknown>, message: RegExp) {
  const before = await snapshot()
  await db.exec('savepoint rejected')
  await expect(run()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
  expect(await snapshot()).toEqual(before)
}

it('executes the current selected-character saved-record API and appends only the exact v8 payload', async () => {
  const before = await snapshot()
  await execute()
  expect(await current()).toMatchObject({ content_version: 8, definition: candidate.after })
  const after = await snapshot()
  expect(after.history).toHaveLength(before.history!.length + 1)
  expect(after.history).toEqual(expect.arrayContaining(before.history!))
  expect(after.attribution).toHaveLength(before.attribution!.length + 1)
  expect(after.attribution).toEqual(expect.arrayContaining(before.attribution!))
  expect(after.drafts).toEqual(before.drafts)
  expect(after.records!.filter((r) => (r as { content_key: string }).content_key !== key)).toEqual(
    before.records!.filter((r) => (r as { content_key: string }).content_key !== key),
  )
  expect(after.policy).toEqual(before.policy)
  expect(
    after.publications!.filter((p) => (p as { content_key: string }).content_key !== key),
  ).toEqual(before.publications!.filter((p) => (p as { content_key: string }).content_key !== key))
})
it('returns a no-op for an exact-v8 retry using a fresh catalogue token', async () => {
  await execute()
  const before = await snapshot()
  await execute()
  expect(await snapshot()).toEqual(before)
})
it('rejects a stale catalogue token without touching any retained state', async () => {
  const stale = await token()
  await db.exec(
    "update app_private.combat_content_records set revision=revision+1 where content_key='owner.sentinel'",
  )
  await rejected(() => execute(stale), /COMBAT_CONTENT_CATALOGUE_CONFLICT/)
})
it('rejects a changed current pointer or a higher historical version', async () => {
  await pointAt(6)
  await rejected(() => execute(), /FIELD_REMEDY_BASELINE_CHANGED/)
  await pointAt(7)
  await seedPublication(key, { ...candidate.after, flavorLine: 'Owner alternate v8' }, 8)
  await rejected(() => execute(), /FIELD_REMEDY_BASELINE_CHANGED/)
  await pointAt(7)
  await rejected(() => execute(), /FIELD_REMEDY_BASELINE_CHANGED/)
})
it('rejects an uncommitted Field Remedy draft and a missing Owner grant', async () => {
  await db.query(
    `insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,updated_by)
    values($1,'skill',$2,7,$3)`,
    [key, candidate.before, owner],
  )
  await rejected(() => execute(), /FIELD_REMEDY_HAS_UNCOMMITTED_DRAFT/)
  await db.query('delete from app_private.combat_content_drafts where content_key=$1', [key])
  await db.query(
    "update app_private.master_panel_role_assignments set enabled=false where user_id=$1 and role='game-owner'",
    [owner],
  )
  await rejected(() => execute(), /GAME_OWNER|OWNER_REQUIRED/)
})
it('rolls back the new history row if a side effect changes unrelated preserved state', async () => {
  await db.exec(`create function pg_temp.corrupt_sentinel_draft() returns trigger language plpgsql as $$
    begin
      if new.content_key='wildwarden.field-remedy' and new.content_version=8 then
        update app_private.combat_content_drafts set draft_version=draft_version+1 where content_key='owner.sentinel';
      end if;
      return new;
    end; $$;
    create trigger test_corrupt_sentinel after insert on app_private.combat_content_versions
      for each row execute function pg_temp.corrupt_sentinel_draft();`)
  await rejected(() => execute(), /FIELD_REMEDY_PRESERVATION_MISMATCH/)
  expect((await current()).content_version).toBe(7)
  expect(
    (
      await db.query(
        'select content_version from app_private.combat_content_versions where content_key=$1 order by content_version',
        [key],
      )
    ).rows,
  ).toEqual([{ content_version: 6 }, { content_version: 7 }])
})
it('rolls back an uncommitted append without altering prior immutable history', async () => {
  const before = await snapshot()
  await db.exec('savepoint publication')
  await execute()
  expect((await current()).content_version).toBe(8)
  await db.exec('rollback to savepoint publication')
  expect(await snapshot()).toEqual(before)
  expect(await current()).toMatchObject({ content_version: 7, definition: candidate.before })
})
