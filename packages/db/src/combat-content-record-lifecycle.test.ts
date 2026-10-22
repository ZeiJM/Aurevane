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
beforeAll(async () => {
  db = await PGlite.create()
  // Only Supabase's platform identity and unavailable scheduler are fixtures.
  // Every Aurevane table, authorization function, producer and finalizer is real migration SQL.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now());
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
  floor = 1,
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
  const restoredPublication = await publish(
    'content.test',
    restored.draft.draftVersion,
    published.current.contentVersion,
  )
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
it('combined actor inventory includes original33 Players4 Content4 Media2 with private helpers inaccessible', async () => {
  expect(
    (
      await db.query(
        "select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames)",
      )
    ).rows,
  ).toHaveLength(43)
  const helpers = (
    await db.query<{ allowed: boolean }>(
      "select has_function_privilege('service_role',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and (p.proname like '%combat_content%' or p.proname in ('validate_noncombat_content_v1','validate_content_record_identity_v1','content_nonnegative_integer_v1','validate_content_requirement_v1','validate_content_command_v1','content_reference_targets_v1','index_content_references_v1','bound_content_links_v1')) and p.proname<>'prevent_combat_content_version_mutation_v1'",
    )
  ).rows
  expect(helpers.every((r) => !r.allowed)).toBe(true)
})
it('executes the complete native Staff fixture with all 43 real actor contracts on the current migration chain', async () => {
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
it('link limit keeps record reads bounded and failed create-with-parent leaves no orphan', async () => {
  const parent = await createDiscipline()
  await db.exec(
    "insert into app_private.combat_content_records(content_key,content_kind,lifecycle) select 'content.limit-'||i,'skill','draft' from generate_series(1,256) i; insert into app_private.combat_content_links select 'discipline.test','content.limit-'||i from generate_series(1,256) i;",
  )
  expect((await record('discipline.test')).links).toHaveLength(256)
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
