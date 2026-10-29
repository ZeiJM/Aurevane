import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest'
const root = resolve(process.cwd(), '../../supabase/migrations')
const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const character = '00000000-0000-4000-8000-000000000011'
interface TestRecord {
  links: string[]
  usedBy: unknown[]
  contentKey: string
  lifecycle: string
  revision: number
  draft: { definition: Record<string, unknown>; draftVersion: number; restoredFrom: number | null }
  current: { contentVersion: number; definition: Record<string, unknown> }
  history: { contentVersion: number }[]
}
let db: PGlite
let originals: string
let legacyActorSignatures: string[]
async function actorSignatures(): Promise<string[]> {
  return (
    await db.query<{ signature: string }>(
      "select format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames)",
    )
  ).rows
    .map((row) => row.signature)
    .sort()
}
beforeAll(async () => {
  // Executable fixture compilation is setup, shared with the native SQL proof.
  const fixtureStarted = performance.now()
  originals = execFileSync(
    'node',
    [resolve(root, '../../apps/web/scripts/master-originals-fixture.mjs')],
    { encoding: 'utf8' },
  )
  process.stdout.write(`Task13 fixture acquisition ms: ${performance.now() - fixtureStarted}\n`)

  db = await PGlite.create()
  // Only Supabase's platform identity and unavailable scheduler are fixtures.
  // Every Aurevane table, authorization function, producer and finalizer is real migration SQL.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),banned_until timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema realtime; create table realtime.messages(extension text,topic text,payload jsonb);
    create function realtime.topic() returns text language sql as $$ select null::text $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages values($2,$3,$1) $$;
    create schema cron; create table cron.job(jobid bigint generated always as identity,jobname text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname) values($1) returning jobid $$;
    create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true $$;`)
  for (const name of readdirSync(root)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    if (name === '20261027123107_master_page_access_and_moderation.sql')
      legacyActorSignatures = await actorSignatures()
    // PGlite has no LZ4 codec; this storage-only setting does not alter authority.
    const sql = readFileSync(resolve(root, name), 'utf8')
      .replace(/create extension if not exists pg_cron(?: with schema pg_catalog)?;/gi, '')
      .replace(/set compression lz4/gi, 'set compression pglz')
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
    }
  }
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${other}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
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
async function write(
  key: string,
  command: Record<string, unknown>,
  user = owner,
  actor: string | null = null,
) {
  return (
    await db.query<{ value: TestRecord }>(
      'select public.write_combat_content_record_v1($1,$2,$3,$4) value',
      [user, actor, key, command],
    )
  ).rows[0]!.value
}
async function record(key: string) {
  return (
    await db.query<{ value: TestRecord }>(
      'select public.read_combat_content_record_v1($1,null,$2) value',
      [owner, key],
    )
  ).rows[0]!.value
}
async function token() {
  return (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
}
async function denied(run: () => Promise<unknown>, message: RegExp) {
  await db.exec('savepoint rejected')
  await expect(run()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected')
}
const definition = {
  id: 'content.test',
  name: 'Test',
  contentVersion: 1,
  sourceDisciplineId: 'vanguard',
  description: 'A retained complete record.',
  privateAccuracy: { kind: 'fixed', chanceBasisPoints: 5000 },
  media: { artworkId: 'original' },
}
async function create(key = 'content.test') {
  return write(key, {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000099',
    contentKind: 'skill',
    definition: { ...definition, id: key },
  })
}
async function createDiscipline() {
  return write('discipline.test', {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000091',
    contentKind: 'discipline',
    definition: {
      schemaVersion: 1,
      id: 'discipline.test',
      contentVersion: 1,
      name: 'Dependency Discipline',
      description: 'A draft dependency owner.',
      sortOrder: 0,
      enabled: true,
      media: {},
      core: { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 },
      focus: ['might', 'vitality'],
      enabledForPrimary: true,
      enabledForSecondary: true,
      linkedSkills: [],
      unlock: { kind: 'unavailable' },
    },
  })
}
async function publish(
  key: string,
  revision: number,
  base: number | null,
  floor: number | null = 1,
  catalogueToken?: string,
) {
  return (
    await db.query<{ value: TestRecord }>(
      'select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,$6) value',
      [owner, key, revision, base, catalogueToken ?? (await token()), floor],
    )
  ).rows[0]!.value
}
it('complete_record_saved_revision: authoring API exists and persists a complete draft without publishing', async () => {
  expect(
    (await db.query("select 1 from pg_proc where proname='write_combat_content_record_v1'")).rows,
  ).toHaveLength(1)
  const saved = await create()
  expect(saved.draft.definition).toEqual(definition)
  expect(saved.lifecycle).toBe('draft')
  expect(saved.current).toBeNull()
  expect(await record('content.test')).toEqual(saved)
})
it('create_retry_duplicate: retries keep one identity; duplication is independent history', async () => {
  const first = await create()
  expect(await create()).toEqual(first)
  const copy = await write('content.copy', {
    action: 'duplicate',
    requestId: '00000000-0000-4000-8000-000000000098',
    sourceKey: 'content.test',
    expectedSourceRevision: first.revision,
  })
  expect(copy.draft.definition.id).toBe('content.copy')
  expect(copy.history).toEqual([])
  expect((await record('content.test')).draft.definition).toEqual(definition)
})
it('saved_only_full_record_cas_floor_and_physical_history', async () => {
  const draft = await create()
  const before = await token()
  const changed = await write('content.test', {
    action: 'save',
    expectedRevision: draft.revision,
    definition: { ...definition, name: 'Changed' },
  })
  expect(await token()).not.toBe(before)
  await denied(
    () => publish('content.test', draft.draft.draftVersion, null),
    /DRAFT_VERSION_CONFLICT/,
  )
  await denied(
    () => publish('content.test', changed.draft.draftVersion, null, 10, before),
    /CATALOGUE_CONFLICT/,
  )
  const published = await publish('content.test', changed.draft.draftVersion, null, 10)
  expect(published.current.contentVersion).toBe(11)
  expect(published.current.definition.name).toBe('Changed')
  expect(published.current.definition.privateAccuracy).toEqual(definition.privateAccuracy)
  expect(published.draft).toBeNull()
  const restored = await write('content.test', {
    action: 'restore',
    expectedRevision: published.revision,
    sourceVersion: 11,
  })
  expect(restored.current.contentVersion).toBe(11)
  expect(restored.draft.restoredFrom).toBe(11)
  const again = await publish('content.test', restored.draft.draftVersion, 11, 1)
  expect(again.current.contentVersion).toBe(12)
  expect(again.history.map((v) => v.contentVersion)).toEqual([12, 11])
  await denied(
    () =>
      db.exec("delete from app_private.combat_content_versions where content_key='content.test'"),
    /IMMUTABLE/,
  )
})
it('archive_restore_requires_fresh_intent_and_never_resurrects_current', async () => {
  const saved = await create()
  const published = await publish('content.test', saved.draft.draftVersion, null)
  const restored = await write('content.test', {
    action: 'restore',
    expectedRevision: published.revision,
    sourceVersion: published.current.contentVersion,
  })
  const archived = await write('content.test', {
    action: 'archive',
    expectedRevision: restored.revision,
  })
  expect(archived.lifecycle).toBe('archived')
  await denied(
    () => db.query("select * from public.read_current_combat_content_v1('content.test','skill')"),
    /COMBAT_CONTENT_ARCHIVED/,
  )
  await denied(() => publish('content.test', restored.draft.draftVersion, null), /RESTORE_REQUIRED/)
  const fresh = await write('content.test', {
    action: 'restore',
    expectedRevision: archived.revision,
    sourceVersion: published.current.contentVersion,
  })
  expect(fresh.lifecycle).toBe('archived')
  const edit = await write('content.test', {
    action: 'save',
    expectedRevision: fresh.revision,
    definition: { ...fresh.draft.definition, name: 'Restored edit' },
  })
  expect((await publish('content.test', edit.draft.draftVersion, null)).lifecycle).toBe('active')
})
it('bounded_list_and_essential_basic_archive', async () => {
  await create()
  const rows = (
    await db.query<{ value: { records: unknown[] } }>(
      "select public.list_combat_content_records_v1($1,null,null,null,'Test',null,1) value",
      [owner],
    )
  ).rows[0]!.value
  expect(rows.records).toHaveLength(1)
  await denied(
    () =>
      db.query('select public.list_combat_content_records_v1($1,null,null,null,null,null,101)', [
        owner,
      ]),
    /LIST_INVALID/,
  )
  expect(await record('basic.guard')).toMatchObject({
    lifecycle: 'active',
    current: null,
    history: [],
    builtin: { name: 'Guard' },
  })
  await denied(() => write('basic.guard', { action: 'archive', expectedRevision: 1 }), /ESSENTIAL/)
})
it('four_actor_rpcs_enforce_actual_browser_denial_and_live_selected_grants', async () => {
  const signatures = [
    'read_combat_content_record_v1(uuid,uuid,text)',
    'list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)',
    'write_combat_content_record_v1(uuid,uuid,text,jsonb)',
    'publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)',
  ]
  for (const signature of signatures)
    expect(
      (
        await db.query<{ value: boolean }>(
          "select has_function_privilege('service_role',$1,'execute') value",
          ['public.' + signature],
        )
      ).rows[0]!.value,
    ).toBe(true)
  await denied(
    () => write('content.test', { action: 'create' }, other, character),
    /OPERATOR_REQUIRED/,
  )
  await db.exec('set local role authenticated')
  await denied(() => record('content.test'), /permission denied/)
  await denied(() => write('content.test', { action: 'create' }), /permission denied/)
  await denied(() => publish('content.test', 1, null, 1, '0'.repeat(32)), /permission denied/)
  await denied(
    () =>
      db.query('select public.list_combat_content_records_v1($1,null,null,null,null,null,20)', [
        owner,
      ]),
    /permission denied/,
  )
  await db.exec('reset role')
})

it('archive blocks phase4 provisioning membership without rewriting catalogue or earned facts', async () => {
  const saved = await create()
  await db.query(
    "insert into app_private.phase4_skill_catalog values('content.test',1,'vanguard',1)",
  )
  const before = await record('content.test')
  await denied(
    () => write('content.test', { action: 'archive', expectedRevision: saved.revision }),
    /DEPENDENCIES/,
  )
  expect(await record('content.test')).toEqual(before)
  expect((await record('content.test')).usedBy).toEqual([
    { kind: 'phase4-catalogue', key: 'content.test', blocking: true },
  ])
})
it('all actual admission tables reject archived links with complete statement rollback', async () => {
  const saved = await create()
  await write('content.test', { action: 'archive', expectedRevision: saved.revision })
  const statements = [
    "insert into app_private.character_skill_unlocks(character_id,skill_id,skill_content_version,source_discipline_id,source_kind,source_id) values($1,'content.test',1,'vanguard','owner','test')",
    "insert into app_private.character_build_discipline_skills(character_id,slot_index,skill_id,skill_content_version,source_discipline_id) values($1,1,'content.test',1,'vanguard')",
    'insert into app_private.character_saved_build_loadouts(character_id,slot_index,name,primary_discipline_id,discipline_skills,source_build_version) values($1,1,\'Archived\',\'vanguard\',\'[{"skillId":"content.test","contentVersion":1,"sourceDisciplineId":"vanguard"}]\',1)',
    "insert into app_private.phase4_skill_catalog values('content.test',1,'vanguard',1)",
  ]
  for (const statement of statements)
    await denied(
      () => db.query(statement, statement.includes('$1') ? [character] : []),
      /COMBAT_CONTENT_ARCHIVED/,
    )
  expect(
    (
      await db.query(
        "select * from app_private.character_skill_unlocks where skill_id='content.test'",
      )
    ).rows,
  ).toEqual([])
  expect(
    (await db.query("select * from app_private.phase4_skill_catalog where skill_id='content.test'"))
      .rows,
  ).toEqual([])
})
it('admission uses one nonblocking shared catalogue lock before checking archive; archive owns exclusive lock', async () => {
  const guards = (
    await db.query<{ body: string }>(
      "select pg_get_functiondef(p.oid) body from pg_proc p where p.proname='guard_combat_content_admission_v1'",
    )
  ).rows
  expect(guards).toHaveLength(1)
  expect(guards[0]!.body).toContain('pg_try_advisory_xact_lock_shared')
  expect(guards[0]!.body).toContain('COMBAT_CONTENT_ADMISSION_RETRY')
  expect(guards[0]!.body).not.toMatch(/pg_advisory_xact_lock\(/)
})
it('current single and batch readers reject tombstones while exact history remains readable', async () => {
  const saved = await create()
  const published = await publish('content.test', saved.draft.draftVersion, null)
  await write('content.test', { action: 'archive', expectedRevision: published.revision })
  await denied(
    () => db.query("select * from public.read_current_combat_content_v1('content.test','skill')"),
    /COMBAT_CONTENT_ARCHIVED/,
  )
  await denied(
    () =>
      db.query(
        "select * from public.read_current_combat_content_many_v1(array['content.test'],'skill')",
      ),
    /COMBAT_CONTENT_ARCHIVED/,
  )
  expect(
    (
      await db.query(
        "select * from public.read_combat_content_version_v1('content.test','skill',$1)",
        [published.current.contentVersion],
      )
    ).rows,
  ).toHaveLength(1)
})
it('intrinsic source cannot change when the first post-publication draft is saved', async () => {
  const saved = await create()
  const published = await publish('content.test', saved.draft.draftVersion, null)
  await denied(
    () =>
      write('content.test', {
        action: 'save',
        expectedRevision: published.revision,
        definition: { ...definition, sourceDisciplineId: 'lifebinder' },
      }),
    /SOURCE_IMMUTABLE/,
  )
})
it('strict future drafts reject arbitrary schema fields and never publish unsupported runtime', async () => {
  const definition = {
    schemaVersion: 1,
    id: 'item.test',
    contentVersion: 1,
    name: 'Field kit',
    description: 'A supported field-kit intent.',
    sortOrder: 0,
    enabled: true,
    media: {},
    requirements: null,
    ability: null,
    itemClass: 'consumable',
    usage: 'active',
    equipmentSlot: null,
    acquisition: 'unimplemented',
  }
  for (const invalid of [
    { ...definition, itemClass: 'invented' },
    { ...definition, itemClass: null },
    { ...definition, usage: null },
    { ...definition, acquisition: null },
    { ...definition, requirements: { kind: 'simple' } },
    { ...definition, requirements: { kind: 'all', children: [] } },
    {
      ...definition,
      requirements: {
        kind: 'resource-state',
        subject: 'owner',
        resource: 'hp',
        comparison: 'at-most',
        basisPoints: null,
      },
    },
    { ...definition, execute: 'arbitrary' },
    { ...definition, name: '\u2003' },
  ])
    await denied(
      () =>
        write('item.test', {
          action: 'create',
          requestId: '00000000-0000-4000-8000-000000000099',
          contentKind: 'item',
          definition: invalid,
        }),
      /DEFINITION_INVALID/,
    )
  const saved = await write('item.test', {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000099',
    contentKind: 'item',
    definition,
  })
  await denied(
    () => publish('item.test', saved.draft.draftVersion, null),
    /ITEM_RUNTIME_UNSUPPORTED/,
  )
  expect((await record('item.test')).draft.definition).toEqual(definition)
})
it('restore attribution is retained in immutable history and cleared from the next independently authored draft', async () => {
  const first = await create()
  const published = await publish('content.test', first.draft.draftVersion, null)
  const restored = await write('content.test', {
    action: 'restore',
    expectedRevision: published.revision,
    sourceVersion: published.current.contentVersion,
  })
  const restoredPublication = (
    await db.query<{ value: TestRecord }>(
      'select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,$6) value',
      [owner, 'content.test', restored.revision, restored.draft.definition, await token(), 1],
    )
  ).rows[0]!.value
  const edited = await write('content.test', {
    action: 'save',
    expectedRevision: restoredPublication.revision,
    definition: { ...definition, name: 'Independent subsequent authoring' },
  })
  expect(edited.draft.restoredFrom).toBeNull()
  const result = await publish(
    'content.test',
    edited.draft.draftVersion,
    restoredPublication.current.contentVersion,
  )
  expect(result.current).toMatchObject({ restoredFrom: null, restoredBy: null, authoredBy: owner })
  expect(result.history[1]).toMatchObject({
    restoredFrom: published.current.contentVersion,
    restoredBy: owner,
  })
})
it('command shapes and reserved Basic duplication fail with specific boundaries', async () => {
  await denied(
    () =>
      write('content.test', {
        action: 'create',
        requestId: '00000000-0000-4000-8000-000000000099',
        contentKind: 'skill',
        definition,
        execute: 'not-supported',
      }),
    /COMMAND_INVALID/,
  )
  const basic = await record('basic.guard')
  await denied(
    () =>
      write('content.copy', {
        action: 'duplicate',
        requestId: '00000000-0000-4000-8000-000000000097',
        sourceKey: 'basic.guard',
        expectedSourceRevision: basic.revision,
      }),
    /BASIC_DUPLICATE_UNSUPPORTED/,
  )
})
it('builtin inventory permits first full-record save and publication above the trusted physical floor without seeded history', async () => {
  const key = 'vanguard.forceful-strike'
  const initial = await record(key)
  expect(initial).toMatchObject({
    lifecycle: 'active',
    revision: 1,
    current: null,
    draft: null,
    history: [],
  })
  const saved = await write(key, {
    action: 'save',
    expectedRevision: initial.revision,
    definition: { ...definition, id: key },
  })
  const result = await publish(key, saved.draft.draftVersion, null, 1)
  expect(result.current.contentVersion).toBeGreaterThan(5)
  expect(result.history).toHaveLength(1)
  const manifestMigration = readFileSync(
    resolve(root, '20261020204946_combat_content_builtin_identity_index.sql'),
    'utf8',
  )
  const importStatement = manifestMigration.match(
    /insert into app_private.combat_content_records[\s\S]*?builtin_source_discipline_id=excluded.builtin_source_discipline_id;/,
  )![0]
  await db.exec(importStatement)
  expect(await record(key)).toEqual(result)
  await denied(
    () =>
      write(key, {
        action: 'save',
        expectedRevision: result.revision,
        definition: { ...definition, id: key, sourceDisciplineId: 'lifebinder' },
      }),
    /SOURCE_IMMUTABLE/,
  )
})
it('builtin duplication uses the trusted source definition but creates an independent identity and version sequence', async () => {
  const key = 'vanguard.forceful-strike'
  const source = await record(key)
  const row = (
    await db.query<{ builtin_version: number }>(
      'select builtin_version from app_private.combat_content_records where content_key=$1',
      [key],
    )
  ).rows[0]!
  const copy = await write('content.copy', {
    action: 'duplicate',
    requestId: '00000000-0000-4000-8000-000000000099',
    sourceKey: key,
    expectedSourceRevision: source.revision,
    sourceDefinition: { ...definition, id: key, contentVersion: row.builtin_version },
  })
  expect(copy.draft.definition).toMatchObject({
    id: 'content.copy',
    contentVersion: 1,
    sourceDisciplineId: 'vanguard',
  })
  expect(copy.history).toEqual([])
  expect(await record(key)).toEqual(source)
})
it('create within Discipline retries atomically and stale parent creates no orphan; link preserves intrinsic source', async () => {
  const parent = await write('discipline.test', {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000091',
    contentKind: 'discipline',
    definition: {
      schemaVersion: 1,
      id: 'discipline.test',
      contentVersion: 1,
      name: 'Discipline',
      description: 'Authored Discipline intent.',
      sortOrder: 0,
      enabled: true,
      media: {},
      core: { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 },
      focus: ['might', 'vitality'],
      enabledForPrimary: true,
      enabledForSecondary: true,
      linkedSkills: [],
      unlock: { kind: 'unavailable' },
    },
  })
  const command = {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000099',
    contentKind: 'skill',
    definition,
    parentKey: 'discipline.test',
    expectedParentRevision: parent.revision,
  }
  const child = await write('content.test', command)
  expect(await write('content.test', command)).toEqual(child)
  expect((await record('discipline.test')).links).toEqual(['content.test'])
  await denied(
    () =>
      write('content.orphan', {
        ...command,
        requestId: '00000000-0000-4000-8000-000000000092',
        definition: { ...definition, id: 'content.orphan' },
      }),
    /RECORD_CONFLICT/,
  )
  expect(await record('content.orphan')).toBeNull()
  expect((await record('content.test')).draft.definition.sourceDisciplineId).toBe('vanguard')
})
it('every legacy mutation overload checks actual authority before its precise retirement error', async () => {
  const functions = (
    await db.query<{ name: string; signature: string; args: string[]; types: string[] }>(
      "select n.nspname||'.'||p.proname name,p.oid::regprocedure::text signature,p.proargnames args,array(select format_type(t,null) from unnest(p.proargtypes::oid[]) t) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('save_combat_content_draft_v1','publish_combat_content_v1','publish_combat_content_v2','publish_combat_content_v3','set_combat_content_publication_v1','set_combat_content_publication_v2','publish_combat_content_with_floor_v1')",
    )
  ).rows
  expect(functions).toHaveLength(14)
  for (const fn of functions) {
    const values: unknown[] = fn.types.map((type, index) =>
      fn.args[index] === 'p_actor_user_id'
        ? owner
        : fn.args[index] === 'p_actor_character_id'
          ? null
          : type === 'text'
            ? 'content.retired'
            : type === 'jsonb'
              ? { id: 'content.retired' }
              : null,
    )
    const sql = `select * from ${fn.name}(${fn.types.map((type, index) => `$${index + 1}::${type}`).join(',')})`
    await denied(
      () => db.query(sql, values),
      fn.name.includes('publication')
        ? /RESTORE_TO_DRAFT_REQUIRED/
        : fn.name.includes('save_')
          ? /COMPLETE_RECORD_REQUIRED/
          : /SAVED_REVISION_REQUIRED/,
    )
    values[0] = other
    await denied(() => db.query(sql, values), /OPERATOR_REQUIRED/)
  }
})
it('retains all 48 legacy actor contracts plus exactly 20 workspace contracts with private helpers inaccessible', async () => {
  const workspaceSignatures = [
    'public.read_master_panel_navigation_v1(uuid,uuid)',
    'public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid)',
    'public.review_discipline_deletion_v1(uuid,uuid,text)',
    'public.delete_discipline_v1(uuid,uuid,text,text)',
    'public.read_master_panel_activity_v1(uuid,integer,bigint,uuid)',
    'public.set_world_environment_v2(uuid,integer,jsonb,uuid)',
    'public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb,uuid)',
    'public.publish_battlefield_elevation_policy_v3(uuid,integer,jsonb,uuid)',
    'public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text,uuid)',
    'public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb)',
    'public.search_master_moderation_players_v1(uuid,text,uuid)',
    'public.read_master_moderation_v1(uuid,uuid,uuid,bigint)',
    'public.list_active_master_bans_v1(uuid,uuid,uuid)',
    'public.write_master_moderation_v1(uuid,uuid,text,text,text,integer,boolean,uuid)',
    'public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text,uuid)',
    'public.search_discipline_grant_players_v1(uuid,uuid,text)',
    'public.read_discipline_player_grants_v1(uuid,uuid,text,uuid)',
    'public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text)',
    'public.read_master_usage_balance_v1(uuid,uuid,text)',
    'public.read_master_usage_balance_week_v1(uuid,uuid,text,date)',
  ]
  const workspaceContracts = (
    await db.query<{
      signature: string
      name: string
      selected_actor: boolean
      anon_execute: boolean
      authenticated_execute: boolean
      service_execute: boolean
    }>(
      "select format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) signature,p.proname name,'p_actor_character_id'=any(p.proargnames) selected_actor,has_function_privilege('anon',p.oid,'execute') anon_execute,has_function_privilege('authenticated',p.oid,'execute') authenticated_execute,has_function_privilege('service_role',p.oid,'execute') service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=any($1::regprocedure[])",
      [workspaceSignatures],
    )
  ).rows
  expect(legacyActorSignatures).toHaveLength(48)
  expect(workspaceContracts).toHaveLength(20)
  expect(await actorSignatures()).toEqual(
    [...legacyActorSignatures, ...workspaceContracts.map((contract) => contract.signature)].sort(),
  )
  for (const contract of workspaceContracts) {
    expect(contract.selected_actor, contract.signature).toBe(true)
    expect(contract.anon_execute, contract.signature).toBe(false)
    expect(contract.authenticated_execute, contract.signature).toBe(false)
    // The v1 timing overload is a private dispatcher, not a service entrypoint.
    expect(contract.service_execute, contract.signature).toBe(
      contract.name !== 'publish_combat_effect_timing_policy_v1',
    )
  }
  const helpers = (
    await db.query<{ allowed: boolean }>(
      "select has_function_privilege('service_role',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and (p.proname like '%combat_content%' or p.proname in ('validate_noncombat_content_v1','validate_content_record_identity_v1','content_nonnegative_integer_v1','validate_content_requirement_v1','validate_content_command_v1','content_reference_targets_v1','index_content_references_v1','bound_content_links_v1')) and p.proname<>'prevent_combat_content_version_mutation_v1'",
    )
  ).rows
  expect(helpers.every((r) => !r.allowed)).toBe(true)
  const workspaceHelpers = [
    'app_private.guard_deleted_content_v1()',
    'app_private.discipline_deletion_keys_v1(text)',
    'app_private.discipline_deletion_impact_v1(text)',
    'app_private.master_page_capabilities_v1(text[])',
    'app_private.assert_master_page_v1(uuid,uuid,text)',
    'app_private.prevent_moderation_history_change_v1()',
    'app_private.discipline_grant_only_v1(text)',
    'app_private.discipline_unlocked_before_player_grants_v1(uuid,text)',
    'app_private.discipline_account_granted_v1(uuid,text)',
    'app_private.validate_discipline_envelope_before_override_v1(jsonb)',
    'app_private.current_discipline_relationship_override_v1(text,text)',
    'app_private.essence_selection_key_before_override_v1(text,text)',
    'app_private.resonance_selection_key_before_override_v1(text,text)',
    'app_private.discipline_unlocked_v1(uuid,text)',
    'app_private.resolve_essence_reference_v1(text,text)',
    'app_private.resolve_resonance_reference_v1(text,text)',
    'app_private.capture_usage_balance_start_v1()',
    'app_private.capture_usage_balance_event_v1()',
  ]
  const denials = await db.query<{ signature: string; role: string; allowed: boolean }>(
    "select signature,role,has_function_privilege(role,signature::regprocedure,'execute') allowed from unnest($1::text[]) signature cross join unnest(array['anon','authenticated','service_role']) role",
    [workspaceHelpers],
  )
  expect(denials.rows).toHaveLength(workspaceHelpers.length * 3)
  for (const result of denials.rows)
    expect(result.allowed, `${result.role}: ${result.signature}`).toBe(false)
})
it('executes the complete native Staff fixture with legacy and workspace actor contracts on the current migration chain', async () => {
  const outsider = '00000000-0000-4000-8000-000000000003'
  const alternate = '00000000-0000-4000-8000-000000000012'
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${outsider}','outsider@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${other}','content-staff');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${alternate}','${other}',1,1,'Alternate Player','alternate-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
  await db.query(
    `select set_config('task8.owner',$1,true),set_config('task8.staff',$2,true),set_config('task8.other',$3,true),set_config('task8.character',$4,true),set_config('task8.alternate',$5,true),set_config('task8.character_name','Test Player',true)`,
    [owner, other, outsider, character, alternate],
  )
  await db.exec(
    readFileSync(
      resolve(root, '../../.github/scripts/verify-master-panel-staff-authority.sql'),
      'utf8',
    ),
  )
})
it('native concurrency rollback snapshot reads the complete actual content and player tables', async () => {
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-combat-catalogue-concurrency.sh'),
    'utf8',
  )
  const expression = script.match(/state_expression="([\s\S]*?)"\nwait_for_query/)?.[1]
  expect(expression).toBeDefined()
  const result = (await db.query<{ state: string }>(`select ${expression} state`)).rows[0]!.state
  expect(Object.keys(JSON.parse(result))).toEqual(
    expect.arrayContaining([
      'records',
      'requests',
      'links',
      'attribution',
      'characters',
      'earned',
      'equipped',
      'saved',
      'builds',
      'phase4',
    ]),
  )
})
it('indexed live definition dependencies block archive, retained history stays readable, and new archived references fail closed', async () => {
  const parent = await createDiscipline()
  const child = await write('content.child', {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000099',
    contentKind: 'skill',
    definition: { ...definition, id: 'content.child', sourceDisciplineId: 'discipline.test' },
  })
  expect((await record('discipline.test')).usedBy).toContainEqual({
    kind: 'definition-draft',
    key: 'content.child',
    blocking: true,
  })
  await denied(
    () => write('discipline.test', { action: 'archive', expectedRevision: parent.revision }),
    /DEPENDENCIES/,
  )
  const current = await publish('content.child', child.draft.draftVersion, null)
  await denied(
    () => write('discipline.test', { action: 'archive', expectedRevision: parent.revision }),
    /DEPENDENCIES/,
  )
  await write('content.child', { action: 'archive', expectedRevision: current.revision })
  const archived = await write('discipline.test', {
    action: 'archive',
    expectedRevision: parent.revision,
  })
  expect(archived.usedBy).toContainEqual({
    kind: 'definition-history',
    key: `content.child@${current.current.contentVersion}`,
    blocking: false,
  })
  await denied(
    () =>
      write('content.new', {
        action: 'create',
        requestId: '00000000-0000-4000-8000-000000000098',
        contentKind: 'skill',
        definition: { ...definition, id: 'content.new', sourceDisciplineId: 'discipline.test' },
      }),
    /ARCHIVED/,
  )
  expect(await record('content.new')).toBeNull()
  expect(
    (
      await db.query(
        "select * from public.read_combat_content_version_v1('content.child','skill',$1)",
        [current.current.contentVersion],
      )
    ).rows,
  ).toHaveLength(1)
})
it('Used-by output is bounded and explicitly reports omitted references without weakening archive checks', async () => {
  await createDiscipline()
  await db.query(
    `do $body$ begin for i in 1..105 loop perform public.write_combat_content_record_v1('${owner}',null,'content.ref-'||i,jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id','content.ref-'||i,'sourceDisciplineId','discipline.test'))); end loop; end; $body$`,
  )
  const parent = await record('discipline.test')
  expect(parent.usedBy).toHaveLength(100)
  expect(parent).toMatchObject({ usedByTruncated: true })
  await denied(
    () => write('discipline.test', { action: 'archive', expectedRevision: parent.revision }),
    /DEPENDENCIES/,
  )
})
it('late publication failure rolls back immutable history, attribution, revision, draft and pointer together', async () => {
  const first = await create()
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-combat-catalogue-concurrency.sh'),
    'utf8',
  )
  const expression = script.match(/state_expression="([\s\S]*?)"\nwait_for_query/)![1]
  const snapshot = async () =>
    (await db.query<{ state: string }>(`select ${expression} state`)).rows[0]!.state
  const before = await snapshot()
  await db.exec(
    `create function app_private.fail_content_test() returns trigger language plpgsql as $$ begin raise exception 'FORCED_LATE_PUBLICATION_FAILURE'; end; $$; create trigger forced_content_failure after insert on app_private.combat_content_attribution for each row execute function app_private.fail_content_test();`,
  )
  await denied(
    () => publish('content.test', first.draft.draftVersion, null),
    /FORCED_LATE_PUBLICATION_FAILURE/,
  )
  expect(await snapshot()).toBe(before)
})
it('actual builtin pure and pair selectors are specific Used-by blockers, while unrelated custom records remain archivable', async () => {
  const keys = (
    await db.query<{ content_key: string }>(
      "select distinct on(content_kind) content_key from app_private.combat_content_records where content_kind in ('essence','resonance') order by content_kind,content_key",
    )
  ).rows
  expect(keys).toHaveLength(2)
  for (const { content_key: key } of keys) {
    const r = await record(key)
    expect(r.usedBy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: expect.stringMatching(/^builtin-(essence|resonance)-selection$/),
          blocking: true,
        }),
      ]),
    )
    await denied(
      () => write(key, { action: 'archive', expectedRevision: r.revision }),
      /BUILTIN_SELECTION_DEPENDENCY/,
    )
  }
  const custom = await create()
  expect(
    (await write('content.test', { action: 'archive', expectedRevision: custom.revision }))
      .lifecycle,
  ).toBe('archived')
})
it('all physical versions survive an old pointer rollback and allocation never reuses their numbers', async () => {
  let r = await create()
  r = await publish('content.test', r.draft.draftVersion, null, 10)
  const first = r.current.contentVersion
  for (let i = 0; i < 3; i++) {
    const base = r.current.contentVersion
    r = await write('content.test', {
      action: 'save',
      expectedRevision: r.revision,
      definition: { ...definition, name: `Revision ${i}` },
    })
    r = await publish('content.test', r.draft.draftVersion, base, 1)
  }
  expect(r.history).toHaveLength(3)
  await db.exec(
    `update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key='content.test' and content_version=${first}) where content_key='content.test'`,
  )
  const saved = await write('content.test', {
    action: 'save',
    expectedRevision: r.revision,
    definition,
  })
  const next = await publish('content.test', saved.draft.draftVersion, first, 1)
  expect(next.current.contentVersion).toBe(first + 4)
  expect(
    (
      await db.query(
        "select content_version from app_private.combat_content_versions where content_key='content.test' order by content_version",
      )
    ).rows,
  ).toEqual(
    [first, first + 1, first + 2, first + 3, first + 4].map((content_version) => ({
      content_version,
    })),
  )
  expect(
    (
      await db.query(
        "select * from public.read_combat_content_version_v1('content.test','skill',$1)",
        [first],
      )
    ).rows,
  ).toHaveLength(1)
})
it('late create-with-parent request failure rolls back child, link, parent revision and all reverse references', async () => {
  const parent = await createDiscipline()
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-combat-catalogue-concurrency.sh'),
    'utf8',
  )
  const expression = script.match(/state_expression="([\s\S]*?)"\nwait_for_query/)![1]
  const snapshot = async () =>
    (await db.query<{ state: string }>(`select ${expression} state`)).rows[0]!.state
  const before = await snapshot()
  await db.exec(
    `create function app_private.fail_content_request_test() returns trigger language plpgsql as $$ begin raise exception 'FORCED_LATE_REQUEST_FAILURE'; end; $$; create trigger forced_content_failure before insert on app_private.combat_content_record_requests for each row execute function app_private.fail_content_request_test();`,
  )
  await denied(
    () =>
      write('content.test', {
        action: 'create',
        requestId: '00000000-0000-4000-8000-000000000099',
        contentKind: 'skill',
        definition,
        parentKey: 'discipline.test',
        expectedParentRevision: parent.revision,
      }),
    /FORCED_LATE_REQUEST_FAILURE/,
  )
  expect(await snapshot()).toBe(before)
})
it('fresh restore permits its own retained reference without reopening the archived record before publication', async () => {
  const selfDefinition = {
    ...definition,
    requirements: {
      kind: 'prime-presence',
      subject: 'owner',
      abilityId: 'content.test',
      present: true,
    },
  }
  const first = await write('content.test', {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000099',
    contentKind: 'skill',
    definition: selfDefinition,
  })
  const current = await publish('content.test', first.draft.draftVersion, null)
  const archived = await write('content.test', {
    action: 'archive',
    expectedRevision: current.revision,
  })
  const restored = await write('content.test', {
    action: 'restore',
    expectedRevision: archived.revision,
    sourceVersion: current.current.contentVersion,
  })
  expect(restored.draft.definition.requirements).toEqual(selfDefinition.requirements)
  expect((await publish('content.test', restored.draft.draftVersion, null)).lifecycle).toBe(
    'active',
  )
})
it('archived parent relationships can be removed without reactivating either record or allowing an archived new link', async () => {
  const parent = await createDiscipline()
  const child = await create()
  const linked = await write('discipline.test', {
    action: 'link',
    expectedRevision: parent.revision,
    childKey: 'content.test',
    requestId: '00000000-0000-4000-8000-000000000097',
  })
  const archived = await write('discipline.test', {
    action: 'archive',
    expectedRevision: linked.revision,
  })
  await write('content.test', { action: 'archive', expectedRevision: child.revision })
  const removed = await write('discipline.test', {
    action: 'unlink',
    expectedRevision: archived.revision,
    childKey: 'content.test',
    requestId: '00000000-0000-4000-8000-000000000096',
  })
  expect(removed).toMatchObject({ lifecycle: 'archived', links: [] })
  await denied(
    () =>
      write('discipline.test', {
        action: 'link',
        expectedRevision: removed.revision,
        childKey: 'content.test',
        requestId: '00000000-0000-4000-8000-000000000095',
      }),
    /LINK_INVALID/,
  )
})
it('eight-Skill limit rejects a ninth create-with-parent without leaving an orphan', async () => {
  const parent = await createDiscipline()
  await db.exec(
    "insert into app_private.combat_content_records(content_key,content_kind,lifecycle) select 'content.limit-'||i,'skill','draft' from generate_series(1,8) i; insert into app_private.combat_content_links select 'discipline.test','content.limit-'||i from generate_series(1,8) i;",
  )
  expect((await record('discipline.test')).links).toHaveLength(8)
  await denied(
    () =>
      write('content.orphan', {
        action: 'create',
        requestId: '00000000-0000-4000-8000-000000000099',
        contentKind: 'skill',
        definition: { ...definition, id: 'content.orphan' },
        parentKey: 'discipline.test',
        expectedParentRevision: parent.revision,
      }),
    /LINK_LIMIT/,
  )
  expect(await record('content.orphan')).toBeNull()
  expect((await record('discipline.test')).revision).toBe(parent.revision)
})
it.each(['skill', 'essence', 'resonance', 'status', 'effect-profile'])(
  'preserves complete %s records through saved publication, exact history and restore',
  async (kind) => {
    const key = `preserve.${kind}`
    const body =
      kind === 'essence'
        ? {
            essenceId: key,
            contentVersion: 1,
            skill: { id: key, contentVersion: 1, privateAccuracy: { chanceBasisPoints: 5500 } },
            media: { artworkId: 'unchanged' },
          }
        : { ...definition, id: key, privateField: { retained: [1, 2, 3] } }
    const created = await write(key, {
      action: 'create',
      requestId: '00000000-0000-4000-8000-000000000099',
      contentKind: kind,
      definition: body,
    })
    const current = await publish(key, created.draft.draftVersion, null, 7)
    expect(current.current.definition).toMatchObject(
      kind === 'essence'
        ? { ...body, contentVersion: 8, skill: { ...body.skill, contentVersion: 8 } }
        : { ...body, contentVersion: 8 },
    )
    const restored = await write(key, {
      action: 'restore',
      expectedRevision: current.revision,
      sourceVersion: 8,
    })
    expect(restored.draft.definition).toEqual(current.current.definition)
    expect(
      (await db.query('select * from public.read_combat_content_version_v1($1,$2,8)', [key, kind]))
        .rows,
    ).toHaveLength(1)
  },
)

// This validates the actual native schedule's preparation SQL. It cannot model
// PostgreSQL cross-session waits; those remain the physical native CI gate.
it('native Stage B schedule producers all reach real guarded writes with their prepared arguments', async () => {
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-combat-catalogue-concurrency.sh'),
    'utf8',
  )
  const grantFunction = script.match(/^grant_skill\(\) \{.*$/m)?.[0]
  const producerFunction = script.match(/producer_b\(\) \{[\s\S]*?\n\}/)?.[0]
  expect(grantFunction).toBeDefined()
  expect(producerFunction).toBeDefined()
  for (const key of ['ci.b-stage-grant', 'ci.b-stage-import'])
    await write(key, {
      action: 'create',
      requestId: crypto.randomUUID(),
      contentKind: 'skill',
      definition: { id: key, sourceDisciplineId: 'vanguard' },
    })
  await db.exec(`update public.characters set level=2 where id='${character}'`)
  const selected = (
    await db.query<{ value: unknown }>(
      `select jsonb_agg(jsonb_build_object('skillId',skill_id,'contentVersion',skill_content_version,'sourceDisciplineId',source_discipline_id,'eligibilityDisciplineId','vanguard') order by skill_id) value from (select * from app_private.character_skill_unlocks where character_id='${character}' and source_discipline_id='vanguard' and skill_id like 'vanguard.%' order by skill_id limit 2) s`,
    )
  ).rows[0]!.value
  const version = (
    await db.query<{ build_version: number }>(
      `select build_version from app_private.character_active_builds where character_id='${character}'`,
    )
  ).rows[0]!.build_version
  for (const table of [
    'character_skill_unlocks',
    'character_build_discipline_skills',
    'character_saved_build_loadouts',
    'phase4_skill_catalog',
    'character_active_builds',
    'character_attribute_personal_allocations',
    'character_discipline_skill_grants',
  ]) {
    const statement = execFileSync(
      'bash',
      ['-c', `${grantFunction}\n${producerFunction}\nproducer_b "$GUARDED_TABLE"`],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GUARDED_TABLE: table,
          admission_character: character,
          admission_user: other,
          selected_b: JSON.stringify(selected),
          version_b: String(version),
        },
      },
    )
    const before = (
      await db.query<{ state: unknown }>(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') state from app_private.${table} t`,
      )
    ).rows[0]!.state
    await db.exec('savepoint native_preparation; set local role service_role;')
    try {
      await db.exec(statement)
    } catch (error) {
      throw new Error(`Native producer for ${table}: ${String(error)}`, { cause: error })
    }
    await db.exec('reset role')
    const after = (
      await db.query<{ state: unknown }>(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') state from app_private.${table} t`,
      )
    ).rows[0]!.state
    expect(after, `Actual write to ${table}`).not.toEqual(before)
    await db.exec('rollback to savepoint native_preparation; release savepoint native_preparation;')
  }
})

it('globally sorts named content with tied names across bounded cursors and server-wide search', async () => {
  const names = ['Zed Global', 'Alpha Global', 'Alpha Global', 'Middle Global']
  for (const [i, name] of names.entries())
    await write(`content.sort-${i}`, {
      action: 'create',
      requestId: `00000000-0000-4000-8000-00000000020${i}`,
      contentKind: 'skill',
      definition: { ...definition, id: `content.sort-${i}`, name },
    })
  const page = async (sort: string, after: unknown = null, search = 'Global') =>
    (
      await db.query<{
        value: { records: { contentKey: string; name: string }[]; nextCursor: string | null }
      }>("select public.list_combat_content_records_v1($1,null,'skill',null,$2,$3,2) value", [
        owner,
        search,
        JSON.stringify({ sort, after }),
      ])
    ).rows[0]!.value
  const first = await page('name-asc')
  expect(first.records.map((r) => r.contentKey)).toEqual(['content.sort-1', 'content.sort-2'])
  const second = await page('name-asc', JSON.parse(first.nextCursor!))
  expect(second.records.map((r) => r.name)).toEqual(['Middle Global', 'Zed Global'])
  const descending = await page('name-desc')
  expect(descending.records.map((r) => r.name)).toEqual(['Zed Global', 'Middle Global'])
  expect(
    (await page('name-desc', JSON.parse(descending.nextCursor!))).records.map((r) => r.contentKey),
  ).toEqual(['content.sort-1', 'content.sort-2'])
  await db.exec('savepoint invalid_cursor')
  await expect(
    page('name-asc', { sort: 'name-desc', key: 'content.sort-1', name: 'Alpha Global' }),
  ).rejects.toThrow('COMBAT_CONTENT_CURSOR_INVALID')
  await db.exec('rollback to savepoint invalid_cursor; release savepoint invalid_cursor')
  const basicPage = (
    await db.query<{ value: { records: { contentKey: string }[] } }>(
      "select public.list_combat_content_records_v1($1,null,'basic',null,null,null,100) value",
      [owner],
    )
  ).rows[0]!.value
  expect(basicPage.records.map((r) => r.contentKey).sort()).toEqual([
    'basic.guard',
    'basic.move',
    'basic.recover',
    'basic.recover.mp',
    'unarmed.basic',
  ])
  const skillPage = (
    await db.query<{ value: { records: { contentKey: string }[] } }>(
      "select public.list_combat_content_records_v1($1,null,'discipline-skill',null,'Global',null,100) value",
      [owner],
    )
  ).rows[0]!.value
  expect(skillPage.records).toHaveLength(4)
  expect((await page('name-asc', null, 'Zed Global')).records.map((r) => r.contentKey)).toEqual([
    'content.sort-0',
  ])
  const old = (
    await db.query<{ value: { records: { contentKey: string }[] } }>(
      "select public.list_combat_content_records_v1($1,null,'skill',null,'Global','content.sort-1',2) value",
      [owner],
    )
  ).rows[0]!.value
  expect(old.records.map((r) => r.contentKey)).toEqual(['content.sort-2', 'content.sort-3'])
})

it('restores an available system baseline to draft without fabricating a publication and retains its source attribution', async () => {
  const key = 'basic.guard'
  const original = {
    id: key,
    contentVersion: 1,
    name: 'Guard',
    enabled: true,
    privateAccuracy: { kind: 'fixed', chanceBasisPoints: 7777 },
    text: { description: 'Original complete text' },
    media: {},
    ability: { behaviors: [] },
  }
  const saved = await write(key, {
    action: 'save',
    expectedRevision: (await record(key)).revision,
    definition: { ...original, name: 'Edited' },
  })
  const published = await publish(key, saved.draft.draftVersion, null, 1)
  const before = await db.query('select * from app_private.combat_content_versions order by id')
  const pointers = await db.query(
    'select * from app_private.combat_content_publications order by content_key',
  )
  const command = {
    action: 'restore',
    expectedRevision: published.revision,
    sourceVersion: 1,
    sourceKind: 'builtin',
    sourceDefinition: original,
  }
  await denied(() => write(key, { ...command, sourceVersion: 99 }), /BUILTIN_SOURCE_INVALID/)
  await denied(
    () => write(key, { ...command, sourceDefinition: { ...original, id: 'basic.move' } }),
    /IDENTITY/,
  )
  const restored = await write(key, command)
  expect(restored.draft.definition).toEqual(original)
  expect(restored.draft).toMatchObject({ restoredFrom: 1, restoredSource: 'builtin' })
  expect(
    (await db.query('select * from app_private.combat_content_versions order by id')).rows,
  ).toEqual(before.rows)
  expect(
    (await db.query('select * from app_private.combat_content_publications order by content_key'))
      .rows,
  ).toEqual(pointers.rows)
  await denied(() => write(key, command), /RECORD_CONFLICT/)
  const next = (
    await db.query<{ value: TestRecord }>(
      'select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,$6) value',
      [owner, key, restored.revision, restored.draft.definition, await token(), 1],
    )
  ).rows[0]!.value
  expect(next.current).toMatchObject({
    contentVersion: 3,
    restoredFrom: 1,
    restoredSource: 'builtin',
    authoredBy: null,
    authoredAt: null,
    restoredBy: owner,
    publishedBy: owner,
    definition: { ...original, contentVersion: 3 },
  })
  expect(next.history.map((row) => row.contentVersion)).toEqual([3, 2])
  const edited = await write(key, {
    action: 'save',
    expectedRevision: next.revision,
    definition: { ...original, name: 'New author' },
  })
  expect(edited.draft).toMatchObject({ restoredFrom: null, restoredSource: null })
})

it('executes the native finalized media and Tag lifecycle proof unchanged on the migration chain', async () => {
  await db.query("select set_config('task13.owner',$1,true)", [owner])
  const proofStarted = performance.now()
  await db.query("select set_config('task13.originals',$1,true)", [originals])
  await db.exec(
    readFileSync(
      resolve(root, '../../.github/scripts/verify-master-content-lifecycle.sql'),
      'utf8',
    ),
  )
  process.stdout.write(`Task13 shared SQL proof ms: ${performance.now() - proofStarted}\n`)
})

it.each([
  'p35-resonance',
  'p36-essence',
  'p37-saved-build-loadouts',
  'p38-representative-buildcraft',
])(
  'executes every native %s SQL query and its exact shell assertions on actual migrations',
  async (verifier) => {
    const script = readFileSync(
      resolve(root, `../../.github/scripts/verify-${verifier}.sh`),
      'utf8',
    )
    if (verifier === 'p37-saved-build-loadouts')
      await db.exec(
        'update app_private.character_build_attunement_policy_state set current_policy_version=1 where singleton',
      )
    let characterId = ''
    const checked = new Set<string>()
    const assertions = new Map(
      [...script.matchAll(/test "\$(\w+)" = '([^']*)'/g)].map((m) => [m[1], m[2]]),
    )
    for (const match of script.matchAll(/psql[^\n]+-(?:Atqc|c) "((?:[^"\\]|\\[\s\S])*)"/g)) {
      let sql = match[1]!
        .replaceAll('$user_id', owner)
        .replaceAll('$character_id', characterId)
        .replace('set role service_role;', '')
        .replaceAll('\\$', '$')
        .replaceAll('\\"', '"')
      for (const payload of script.matchAll(/(\w+_payload)='([^']*)'/g)) {
        sql = sql.replaceAll('$' + payload[1], payload[2]!)
      }
      if (sql.includes('$skill_id')) {
        for (const discipline of ['vanguard', 'lifebinder']) {
          const entries = script.match(new RegExp(`${discipline}_skills=\\(([\\s\\S]*?)\\)`))![1]!
          for (const entry of entries.matchAll(/'([^|']+)\|(\d+)'/g)) {
            const unlock = sql
              .replaceAll('$skill_id', entry[1]!)
              .replaceAll('$content_version', entry[2]!)
              .replaceAll('$source_discipline_id', discipline)
            const rows = (await db.exec(unlock)).flatMap((result) => result.rows)
            expect(String(Object.values(rows[0]!)[0])).toBe(
              `${entry[1]}|${discipline === 'vanguard'}`,
            )
          }
        }
        continue
      }
      const prefix = script.slice(0, match.index)
      const variable = prefix.match(/(\w+)="\$\(docker[^\n]*$/)?.[1]
      const expectedError =
        variable === 'locked_output'
          ? 'SECONDARY_ATTUNEMENT_LOCKED'
          : variable === 'atomic_output'
            ? 'DISCIPLINE_SKILL_NOT_LEARNED'
            : sql.includes('sha256:p38-illegal-mixed-source-overflow')
              ? 'DISCIPLINE_SKILL_SOURCE_CAPACITY_EXCEEDED'
              : undefined
      if (expectedError) {
        await denied(() => db.exec(sql), new RegExp(expectedError))
        continue
      }
      const results = await db.exec(sql)
      const rows = results.flatMap((result) => result.rows)
      if (!characterId) characterId = String(Object.values(rows[0]!)[0])
      const assertion = variable ? assertions.get(variable) : undefined
      if (rows.length && assertion !== undefined && variable) {
        expect(String(Object.values(rows[0]!)[0]), variable).toBe(assertion)
        checked.add(variable)
      }
    }
    expect([...checked].sort()).toEqual([...assertions.keys()].sort())
  },
)

it('runs native captured startup rejection and rollback assertions on all migrations', async () => {
  // PGlite lacks the pgTAP extension. These assertion adapters raise on any
  // mismatch; every fixture, admission call and authority query stays unchanged.
  await db.exec(`create schema if not exists extensions;
    create function extensions.no_plan() returns void language sql as 'select';
    create function extensions.finish() returns void language sql as 'select';
    create function extensions.ok(actual boolean, label text) returns void language plpgsql as $$ begin
      if actual is distinct from true then raise exception 'pgTAP assertion: %',label; end if;
    end $$;
    create function extensions.is(actual integer, expected integer, label text) returns void language plpgsql as $$ begin
      perform extensions.ok(actual is not distinct from expected,label || ': actual ' || actual || ', expected ' || expected);
    end $$;
    create function extensions.throws_ok(statement text, expected_code text, expected_message text, label text) returns void language plpgsql as $$
    declare caught boolean := false; code text; message text;
    begin
      begin execute statement;
      exception when others then
        caught := true; get stacked diagnostics code = returned_sqlstate, message = message_text;
        if code is distinct from expected_code or message is distinct from expected_message then
          raise exception 'pgTAP exception assertion: %; actual % %, expected % %',label,code,message,expected_code,expected_message;
        end if;
      end;
      if not caught then raise exception 'pgTAP exception assertion: %; no exception',label; end if;
    end $$;`)
  const proof = readFileSync(resolve(root, '../tests/captured_ability_startup.sql'), 'utf8')
    .replace('begin;', '')
    .replace('create extension if not exists pgtap with schema extensions;', '')
    .replace('rollback;', '')
  await db.exec(proof)
})

it('admits the native PvP fixture only with both current committed participant captures', async () => {
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-pvp-authority.sh'),
    'utf8',
  )
  const userOne = '00000000-0000-4000-8000-000000003081'
  const userTwo = '00000000-0000-4000-8000-000000003082'
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
    ('${userOne}','pvp-one@example.test',now()),('${userTwo}','pvp-two@example.test',now())`)
  const createSql = script.match(/create_character\(\)[\s\S]*?psql[^\n]+ "([\s\S]*?)"/)![1]!
  async function create(user: string, suffix: string) {
    const sql = createSql
      .replace('set role service_role;', '')
      .replaceAll('$user_id', user)
      .replaceAll('$idempotency_key', `00000000-0000-4000-8000-0000000030${suffix}`)
      .replaceAll('$fingerprint', `pvp-test-${suffix}`)
      .replaceAll('$name_key', `pvptest${suffix}`)
      .replaceAll('$name', `PvP Test ${suffix}`)
    return String(Object.values((await db.exec(sql)).flatMap((result) => result.rows)[0]!)[0])
  }
  const one = await create(userOne, '83')
  const two = await create(userTwo, '84')
  const lobby = (
    await db.query<{ id: string }>("select public.create_pvp_lobby_v1($1,$2,'1v1',null,null) id", [
      userOne,
      one,
    ])
  ).rows[0]!.id
  const key = (
    await db.query<{ key: string }>("select public.get_pvp_lobby_v1($1,$2)->>'lobby_key' key", [
      userOne,
      lobby,
    ])
  ).rows[0]!.key
  await db.query('select public.join_pvp_lobby_v1($1,$2,$3)', [userTwo, two, key])
  for (const user of [userOne, userTwo]) {
    await db.query('select public.set_pvp_lobby_ready_v1($1,$2,true)', [user, lobby])
  }
  const captureSql = script
    .match(/committed_builds="\$\(docker[^\n]+ "([\s\S]*?)"/)![1]!
    .replace('set role service_role;', '')
    .replaceAll('$user_one', userOne)
    .replaceAll('$user_two', userTwo)
    .replaceAll('$character_one', one)
    .replaceAll('$character_two', two)
  const builds = JSON.parse(
    String(Object.values((await db.exec(captureSql)).flatMap((result) => result.rows)[0]!)[0]),
  )
  const env = {
    ...process.env,
    battle_id: 'battle:pvp-authority-regression',
    user_one: userOne,
    user_two: userTwo,
    character_one: one,
    character_two: two,
    combatant_one: `character:${one}`,
    combatant_two: `character:${two}`,
    committed_builds: JSON.stringify(builds),
  }
  function nativeJson(variable: string) {
    const assignment = script.match(new RegExp(`${variable}="\\$\\((jq[\\s\\S]*?)\\)"`))![1]!
    return JSON.parse(execFileSync('bash', ['-c', assignment], { env, encoding: 'utf8' }))
  }
  const snapshot = nativeJson('snapshot')
  const participants = nativeJson('participants')
  const createBattle = (prepared: unknown) =>
    db.query<{ battle_session_id: string }>(
      'select * from public.create_pvp_battle_session_v1($1,$2,$3,1,1,$4,$5)',
      [userOne, lobby, env.battle_id, prepared, participants],
    )
  const rollbackSql = script
    .match(/rollback_state="\$\(docker[^\n]+ "([\s\S]*?)"/)![1]!
    .replaceAll('$battle_id', env.battle_id)
    .replaceAll('$lobby_id', lobby)
    .replaceAll('$user_one', userOne)
    .replaceAll('$character_one', one)
    .replaceAll('$character_two', two)
  for (const index of [0, 1]) {
    for (const [field, value] of [
      ['sourceHash', 'stale'],
      ['buildVersion', 0],
      ['catalogueToken', 'stale'],
      ['characterId', character],
    ]) {
      const stale = structuredClone(snapshot)
      stale.buildAuthority.combatants[index][String(field)] = value
      await denied(() => createBattle(stale), /PLAYER_PREPARATION_STALE/)
      const rollbackState = String(
        Object.values((await db.exec(rollbackSql)).flatMap((result) => result.rows)[0]!)[0],
      )
      expect(rollbackState).toBe('0|0|true')
    }
  }
  const admitted = await createBattle(snapshot)
  expect(admitted.rows).toHaveLength(1)
  expect((await createBattle(snapshot)).rows[0]!.battle_session_id).toBe(
    admitted.rows[0]!.battle_session_id,
  )
  const stored = (
    await db.query<{ value: unknown }>(
      "select current_snapshot->'buildAuthority'->'combatants' value from app_private.battle_sessions where id=$1",
      [admitted.rows[0]!.battle_session_id],
    )
  ).rows[0]!.value
  expect(stored).toEqual(builds)
})

it.each(['pvp-map-sizes', 'character-support-action'])(
  'executes native %s transaction assertions on actual migrations',
  async (verifier) => {
    const script = readFileSync(
      resolve(root, `../../.github/scripts/verify-${verifier}.sh`),
      'utf8',
    )
    const create = script
      .match(/character_id="\$\(docker[^\n]+ "([\s\S]*?)"/)![1]!
      .replace('set role service_role;', '')
      .replaceAll('$user_id', owner)
    const characterId = String(
      Object.values((await db.exec(create)).flatMap((result) => result.rows)[0]!)[0],
    )
    const proof = script
      .match(/<<SQL\n([\s\S]*?)\nSQL/)![1]!
      .replaceAll('$user_id', owner)
      .replaceAll('$character_id', characterId)
      .replaceAll('\\$', '$')
      .replace(/^begin;/, '')
      .replace(/rollback;\s*$/, '')
    await db.exec(proof)
  },
)

it('executes native historical rebalance predecessor and retained snapshot assertions', async () => {
  const script = readFileSync(
    resolve(root, '../../.github/scripts/verify-p4-discipline-rebalance-publication.sh'),
    'utf8',
  )
  const predecessor = readFileSync(
    resolve(root, '20260903200000_p36_essence_framework.sql'),
    'utf8',
  )
  const start = predecessor.indexOf(
    'create or replace function app_private.resolve_essence_reference_v1(',
  )
  await db.exec(predecessor.slice(start, predecessor.indexOf('$$;', start) + 3))
  const proof = script
    .match(/cat <<'SQL'\n([\s\S]*?)\nSQL/)![1]!
    .replace(":'user_id'", `'${owner}'`)
    .replace(/rollback;\s*$/, '')
  await db.exec(proof)
})

it('atomically commits edits with stale/authority rollback and no duplicate unchanged publication', async () => {
  const created = await create()
  const commit = (revision: number, value: unknown, actor = owner, expectedToken?: string) =>
    db.query<{ value: TestRecord }>(
      'select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,$6) value',
      [actor, created.contentKey, revision, value, expectedToken ?? '', 1],
    )
  const before = await record(created.contentKey)
  await denied(
    () => commit(before.revision, { ...definition, name: 'Denied' }, other, 'a'.repeat(32)),
    /OPERATOR_REQUIRED/,
  )
  const first = (
    await commit(before.revision, { ...definition, name: 'Committed' }, owner, await token())
  ).rows[0]!.value
  expect(first.current.definition.name).toBe('Committed')
  expect(first.draft).toBeNull()
  const counts = async () =>
    (
      await db.query(
        'select count(*) count from app_private.combat_content_versions where content_key=$1',
        [created.contentKey],
      )
    ).rows
  const baseline = await counts()
  const freshToken = await token()
  await denied(
    () => commit(before.revision, { ...definition, name: 'Stale' }, owner, freshToken),
    /REVISION_CONFLICT/,
  )
  const unchanged = (await commit(first.revision, first.current.definition, owner, await token()))
    .rows[0]!.value
  expect(unchanged.revision).toBe(first.revision)
  expect(await counts()).toEqual(baseline)
  const current = await record(created.contentKey)
  expect(current.current.definition.name).toBe('Committed')
  expect(current.draft).toBeNull()
})

it('rolls back the saved draft and record when atomic publication fails', async () => {
  const created = await create()
  const before = await record(created.contentKey)
  const beforeToken = await token()
  const beforeVersions = (
    await db.query(
      'select id from app_private.combat_content_versions where content_key=$1 order by id',
      [created.contentKey],
    )
  ).rows
  await db.exec(`create function app_private.reject_test_publication() returns trigger
    language plpgsql as $$ begin raise exception 'TEST_PUBLICATION_REJECTED'; end $$;
    create trigger reject_test_publication before insert on app_private.combat_content_versions
    for each row execute function app_private.reject_test_publication();`)
  await denied(
    () =>
      db.query('select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,$6)', [
        owner,
        created.contentKey,
        before.revision,
        { ...definition, name: 'Must roll back' },
        beforeToken,
        1,
      ]),
    /TEST_PUBLICATION_REJECTED/,
  )
  expect(await record(created.contentKey)).toEqual(before)
  expect(await token()).toBe(beforeToken)
  expect(
    (
      await db.query(
        'select id from app_private.combat_content_versions where content_key=$1 order by id',
        [created.contentKey],
      )
    ).rows,
  ).toEqual(beforeVersions)
})

it('attributes a changed restored draft as new authorship through Commit Now', async () => {
  const created = await create()
  const published = await publish(created.contentKey, created.draft.draftVersion, null)
  const restored = await write(created.contentKey, {
    action: 'restore',
    expectedRevision: published.revision,
    sourceVersion: published.current.contentVersion,
  })
  const committed = (
    await db.query<{ value: TestRecord }>(
      'select public.commit_combat_content_record_v1($1,null,$2,$3,$4,$5,$6) value',
      [
        owner,
        created.contentKey,
        restored.revision,
        { ...restored.draft.definition, name: 'Newly authored after restore' },
        await token(),
        1,
      ],
    )
  ).rows[0]!.value
  expect(committed.current).toMatchObject({
    restoredFrom: null,
    restoredBy: null,
    restoredSource: null,
    authoredBy: owner,
    definition: { name: 'Newly authored after restore' },
  })
  expect(committed.draft).toBeNull()
})

it('unchanged effect timing retains policy rows and activity while stale and unauthorized calls still reject', async () => {
  const read = async () =>
    (
      await db.query<{ value: { version: number; modes: Record<string, string> } }>(
        'select public.read_combat_effect_timing_policy_v1() value',
      )
    ).rows[0]!.value
  const initial = await read()
  const rows = async () =>
    (
      await db.query(
        'select * from app_private.combat_effect_timing_policy_versions order by version',
      )
    ).rows
  const activity = async () =>
    (await db.query('select * from app_private.master_panel_activity order by id')).rows
  const before = await rows()
  const beforeActivity = await activity()
  const publish = async (actor: string, version: number, modes: unknown) =>
    db.query<{ value: unknown }>(
      'select public.publish_combat_effect_timing_policy_v2($1,$2,$3::jsonb,$4) value',
      [actor, version, modes, await token()],
    )
  expect((await publish(owner, initial.version, initial.modes)).rows[0]!.value).toEqual(initial)
  expect(await rows()).toEqual(before)
  expect(await activity()).toEqual(beforeActivity)
  await denied(() => publish(other, initial.version, initial.modes), /OWNER_REQUIRED/)
  await denied(() => publish(owner, initial.version - 1, initial.modes), /VERSION_CONFLICT/)
  await denied(() => publish(owner, initial.version, null), /INVALID_TIMING_POLICY/)
  const changed = {
    ...initial.modes,
    damage: initial.modes.damage === 'instant' ? 'delayed' : 'instant',
  }
  expect((await publish(owner, initial.version, changed)).rows[0]!.value).toMatchObject({
    version: initial.version + 1,
    modes: changed,
  })
  expect((await rows()).length).toBe(before.length + 1)
})

it('successful Archive records who and what once in Activity, and transaction rollback removes the entry', async () => {
  const saved = await create()
  const published = await publish('content.test', saved.draft.draftVersion, null)
  const activity = async () =>
    (
      await db.query(
        'select actor,action,subject,detail from app_private.master_panel_activity order by id',
      )
    ).rows
  const beforeActivity = await activity()
  const beforeHistory = (
    await db.query(
      "select * from app_private.combat_content_versions where content_key='content.test' order by content_version",
    )
  ).rows
  await denied(
    () =>
      write(
        'content.test',
        { action: 'archive', expectedRevision: published.revision },
        other,
        character,
      ),
    /MASTER_PANEL|CAPABILITY|OPERATOR/,
  )
  await denied(
    () => write('content.test', { action: 'archive', expectedRevision: published.revision - 1 }),
    /RECORD_CONFLICT/,
  )
  expect(await activity()).toEqual(beforeActivity)
  await db.exec('savepoint before_archive')
  const archived = await write('content.test', {
    action: 'archive',
    expectedRevision: published.revision,
  })
  expect(archived.lifecycle).toBe('archived')
  expect(archived.current).toBeNull()
  expect(await activity()).toEqual([
    ...beforeActivity,
    { actor: 'Game Owner', action: 'Archived content', subject: 'Test', detail: '' },
  ])
  expect(
    (
      await db.query(
        "select * from app_private.combat_content_versions where content_key='content.test' order by content_version",
      )
    ).rows,
  ).toEqual(beforeHistory)
  await db.exec('rollback to savepoint before_archive')
  expect(await activity()).toEqual(beforeActivity)
  expect((await record('content.test')).current).toEqual(published.current)
  const committed = await write('content.test', {
    action: 'archive',
    expectedRevision: published.revision,
  })
  const afterArchive = await activity()
  expect(afterArchive).toHaveLength(beforeActivity.length + 1)
  await write('content.test', { action: 'archive', expectedRevision: committed.revision })
  expect(await activity()).toEqual(afterArchive)
})

it('Archive of an unpublished record uses its draft name in the Owner activity reader', async () => {
  const saved = await create()
  await write('content.test', { action: 'archive', expectedRevision: saved.revision })
  const result = (
    await db.query<{
      value: { entries: { actor: string; action: string; subject: string; detail: string }[] }
    }>('select public.read_master_panel_activity_v1($1,100,null) value', [owner])
  ).rows[0]!.value
  expect(result.entries).toHaveLength(1)
  expect(result.entries[0]).toMatchObject({
    actor: 'Game Owner',
    action: 'Archived content',
    subject: 'Test',
    detail: '',
  })
  expect(JSON.stringify(result)).not.toContain('privateAccuracy')
  expect(JSON.stringify(result)).not.toContain(owner)
})

it('actorless system archival does not invent a Staff activity attribution', async () => {
  await create()
  const before = (await db.query('select * from app_private.master_panel_activity order by id'))
    .rows
  await db.exec(
    "update app_private.combat_content_records set lifecycle='archived',updated_by=null where content_key='content.test'",
  )
  expect(
    (await db.query('select * from app_private.master_panel_activity order by id')).rows,
  ).toEqual(before)
})

it('Archive activity capture remains private rather than granting direct browser or service execution', async () => {
  const result = await db.query<{ role: string; allowed: boolean }>(
    `select role,has_function_privilege(role,'app_private.capture_master_content_archive_activity_v1()','EXECUTE') as allowed from (values('anon'),('authenticated'),('service_role')) roles(role) order by role`,
  )
  expect(result.rows).toEqual([
    { role: 'anon', allowed: false },
    { role: 'authenticated', allowed: false },
    { role: 'service_role', allowed: false },
  ])
})

it('native Tag race preparation handles seeded metadata and an already published Tag without resetting history', async () => {
  const prepare = readFileSync(
    resolve(root, '../../.github/scripts/prepare-combat-tag-race.sql'),
    'utf8',
  )
  const before = await record('tag.damage')
  expect(before).not.toBeNull()
  expect(before.current).toBeNull()
  await db.query("select set_config('task13.owner',$1,true)", [owner])
  await db.exec('set local role service_role')
  await db.exec(prepare)
  const first = await record('tag.damage')
  expect(first.draft).not.toBeNull()
  const published = await publish('tag.damage', first.draft.draftVersion, null, null)
  expect(published.current.contentVersion).toBe(2)
  const prior = published.current.definition
  await db.exec(prepare)
  const next = await record('tag.damage')
  expect(next.draft).not.toBeNull()
  const nextPublished = await publish(
    'tag.damage',
    next.draft.draftVersion,
    published.current.contentVersion,
    null,
  )
  expect(nextPublished.current.contentVersion).toBe(published.current.contentVersion + 1)
  expect(nextPublished.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ contentVersion: published.current.contentVersion }),
    ]),
  )
  expect(
    (
      await db.query<{ definition: unknown }>(
        "select definition from public.read_combat_content_version_v1('tag.damage','tag',$1)",
        [published.current.contentVersion],
      )
    ).rows[0]!.definition,
  ).toEqual(prior)
})
