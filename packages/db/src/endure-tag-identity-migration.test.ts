import { afterAll, beforeAll, beforeEach, afterEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const migrationName = '20261031084336_endure_tag_identity.sql'
const migration = () =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', migrationName), 'utf8')
const owner = '00000000-0000-4000-8000-000000000001'
let db: PGlite
let priorIds: string[]
let priorContent: unknown
let priorAcl: unknown
let immediateIds: string[] | undefined
let immediateContent: unknown

async function contentSnapshot(database: PGlite) {
  const result: Record<string, unknown> = {}
  for (const table of [
    'combat_content_records',
    'combat_content_versions',
    'combat_content_publications',
    'combat_content_drafts',
    'combat_effect_timing_policy_versions',
  ]) {
    result[table] = (
      await database.query<{ value: unknown }>(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from app_private.${table} t ${table === 'combat_content_records' ? "where content_key <> 'tag.endure'" : ''}`,
      )
    ).rows[0]!.value
  }
  return result
}
async function timingAcl(database: PGlite) {
  return (
    await database.query(
      `select p.oid::regprocedure::text signature, p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('publish_combat_effect_timing_policy_v1','publish_combat_effect_timing_policy_v2') order by signature`,
    )
  ).rows
}
async function expectRejected(operation: () => Promise<unknown>, message: string) {
  await db.exec('savepoint expected_rejection')
  await expect(operation()).rejects.toThrow(message)
  await db.exec('rollback to savepoint expected_rejection; release savepoint expected_rejection')
}

beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name > migrationName && !immediateIds) {
      immediateIds = (
        await database.query<{ ids: string[] }>(
          'select app_private.content_presentation_tag_ids_v1() ids',
        )
      ).rows[0]!.ids
      immediateContent = await contentSnapshot(database)
    }
    if (name !== migrationName) return
    await database.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'endure-owner@example.test',now())",
      [owner],
    )
    await database.query(
      "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
      [owner],
    )
    // A concurrently added identity must survive this append-only extension.
    await database.exec(`do $$ declare ids text[]; begin
      ids:=app_private.content_presentation_tag_ids_v1()||array['future-tag'];
      execute format('create or replace function app_private.content_presentation_tag_ids_v1() returns text[] language sql immutable set search_path='''' as %L', 'select '||quote_literal(ids)||'::text[]');
    end $$;`)
    priorIds = (
      await database.query<{ ids: string[] }>(
        'select app_private.content_presentation_tag_ids_v1() ids',
      )
    ).rows[0]!.ids
    await database.exec(`do $$ declare fn record; begin
      for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_combat_effect_timing_policy_v1' loop
        execute replace(pg_get_functiondef(fn.oid), 'entry.key not in (', 'entry.key not in (''future-timing'',');
      end loop;
    end $$;`)
    await database.exec(`do $$ begin
      execute replace(pg_get_functiondef('app_private.content_effect_presentation_id_v1(jsonb)'::regprocedure),
        'case p->>''type''', 'case p->>''type'' when ''endure'' then return ''endure'';');
    end $$;`)
    priorContent = await contentSnapshot(database)
    priorAcl = await timingAcl(database)
  })
}, 60000)
afterAll(async () => {
  await db?.close()
})
beforeEach(async () => {
  await db.exec('begin')
})
afterEach(async () => {
  await db.exec('rollback')
})

it('01 appends only Endure metadata and retains prior IDs, content and timing grants', async () => {
  expect(
    (
      await db.query(
        "select content_key,builtin_version,builtin_name,version_floor,revision from app_private.combat_content_records where content_key='tag.endure'",
      )
    ).rows,
  ).toEqual([
    {
      content_key: 'tag.endure',
      builtin_version: 1,
      builtin_name: 'Endure',
      version_floor: 1,
      revision: 1,
    },
  ])
  // Compare the exact Endure boundary; later migrations may append their own identities.
  expect(immediateIds).toEqual([...priorIds, 'endure'])
  expect(immediateContent).toEqual(priorContent)
  expect(await timingAcl(db)).toEqual(priorAcl)
  expect(
    (
      await db.query<{ id: string }>(
        `select app_private.content_effect_presentation_id_v1('{"type":"endure","recipient":"actor","durationTurns":2,"releaseBasisPoints":15000,"radiusTiles":3,"targetTeams":"enemies"}') id`,
      )
    ).rows[0]!.id,
  ).toBe('endure')
  for (const removalMode of [undefined, 'specified'])
    expect(
      (
        await db.query<{ id: string }>(
          'select app_private.content_effect_presentation_id_v1($1::jsonb) id',
          [
            JSON.stringify({
              type: 'remove-status',
              recipient: 'actor',
              statusIds: ['endure'],
              removalMode,
            }),
          ],
        )
      ).rows[0]!.id,
    ).toBe(removalMode === 'specified' ? 'dispel' : 'cleanse')
})

it('02 supports Endure in both existing timing writers without weakening CAS or validation', async () => {
  const signatures = (
    await db.query<{ arguments: number }>(
      `select p.pronargs arguments from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='publish_combat_effect_timing_policy_v1' order by p.pronargs`,
    )
  ).rows
  expect(signatures).toHaveLength(2)
  for (const { arguments: count } of signatures) {
    const call = `select public.publish_combat_effect_timing_policy_v1($1,$2,$3::jsonb,null${count === 5 ? ',null::uuid' : ''})`
    let version = (
      await db.query<{ version: number }>(
        'select max(version) version from app_private.combat_effect_timing_policy_versions',
      )
    ).rows[0]!.version
    for (const mode of ['instant', 'next-round', 'delayed', 'controlled']) {
      await db.query(call, [
        owner,
        version,
        JSON.stringify({ endure: mode, slow: 'instant', 'future-timing': 'instant' }),
      ])
      await expectRejected(
        () => db.query(call, [owner, version, '{}']),
        'TIMING_POLICY_VERSION_CONFLICT',
      )
      version += 1
    }
    for (const modes of [{ endure: 'invented' }, { invented: 'instant' }, { endure: null }])
      await expectRejected(
        () => db.query(call, [owner, version, JSON.stringify(modes)]),
        'INVALID_TIMING_POLICY',
      )
  }
})

it('03 replays without lowering retained Endure floors/revisions or changing content history', async () => {
  const installedContent = await contentSnapshot(db)
  const installedIds = (
    await db.query<{ ids: string[] }>('select app_private.content_presentation_tag_ids_v1() ids')
  ).rows[0]!.ids
  await db.exec(
    "update app_private.combat_content_records set version_floor=7,revision=9 where content_key='tag.endure'",
  )
  await db.exec(migration().replace(/^(?:begin|commit);$/gm, ''))
  expect(
    (
      await db.query(
        "select version_floor,revision from app_private.combat_content_records where content_key='tag.endure'",
      )
    ).rows,
  ).toEqual([{ version_floor: 7, revision: 9 }])
  expect(await contentSnapshot(db)).toEqual(installedContent)
  expect(await timingAcl(db)).toEqual(priorAcl)
  const ids = (
    await db.query<{ ids: string[] }>('select app_private.content_presentation_tag_ids_v1() ids')
  ).rows[0]!.ids
  expect(ids).toEqual(installedIds)
})
