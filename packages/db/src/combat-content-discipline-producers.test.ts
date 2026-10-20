import { readFileSync, readdirSync } from 'node:fs'
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
async function createLegacyDiscipline() {
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
const authored = {
  schemaVersion: 1,
  id: 'discipline.authored',
  contentVersion: 1,
  name: 'Authored Discipline',
  description: 'A real published producer.',
  sortOrder: 1,
  enabled: true,
  media: {},
  core: { might: 11, finesse: 6, vitality: 4, agility: 3, intellect: 4, resolve: 3 },
  focus: ['might', 'finesse'],
  enabledForPrimary: true,
  enabledForSecondary: true,
  linkedSkills: [],
  skillStages: [],
  unlock: { kind: 'always' },
  essenceId: null,
  resonanceSelections: [],
  atlas: {
    family: 'martial',
    band: 'first-journey',
    disclosure: 'open',
    power: { reliability: 3, flexibility: 3, setup: 3, ruleAccess: 3, execution: 3 },
  },
}
async function authoredDraft(def = authored) {
  return write(def.id, {
    action: 'create',
    requestId: '00000000-0000-4000-8000-000000000087',
    contentKind: 'discipline',
    definition: def,
  })
}
it('saved publication projects the actual definition, Core and current catalogue without changing any character facts', async () => {
  const before = (await db.query('select to_jsonb(c) value from public.characters c')).rows
  const buildBefore = (
    await db.query('select to_jsonb(b) value from app_private.character_active_builds b')
  ).rows
  const grantsBefore = (
    await db.query(
      'select to_jsonb(g) value from app_private.character_skill_unlocks g order by skill_id',
    )
  ).rows
  const saved = await authoredDraft()
  const published = await publish(authored.id, saved.draft.draftVersion, null)
  const version = published.current.contentVersion
  expect(
    (
      await db.query(
        'select definition_version,primary_profile_version from app_private.discipline_definitions where discipline_id=$1',
        [authored.id],
      )
    ).rows,
  ).toEqual([{ definition_version: version, primary_profile_version: version }])
  expect(
    (
      await db.query(
        'select core_base_attributes,focus_attributes,off_focus_cap,stat_offsets from app_private.discipline_primary_profiles where discipline_id=$1',
        [authored.id],
      )
    ).rows,
  ).toEqual([
    {
      core_base_attributes: authored.core,
      focus_attributes: authored.focus,
      off_focus_cap: 40,
      stat_offsets: {},
    },
  ])
  expect(
    (
      await db.query(
        'select discipline_id,definition_version from public.get_character_discipline_catalog_v2($1,$2) where discipline_id=$3',
        [other, character, authored.id],
      )
    ).rows,
  ).toEqual([{ discipline_id: authored.id, definition_version: version }])
  expect((await db.query('select to_jsonb(c) value from public.characters c')).rows).toEqual(before)
  expect(
    (await db.query('select to_jsonb(b) value from app_private.character_active_builds b')).rows,
  ).toEqual(buildBefore)
  expect(
    (
      await db.query(
        'select to_jsonb(g) value from app_private.character_skill_unlocks g order by skill_id',
      )
    ).rows,
  ).toEqual(grantsBefore)
})
it('restored publication appends new Core and identity versions while retaining the exact former rows', async () => {
  const saved = await authoredDraft()
  const first = await publish(authored.id, saved.draft.draftVersion, null)
  const before = (
    await db.query(
      'select to_jsonb(p) value from app_private.discipline_primary_profiles p where discipline_id=$1',
      [authored.id],
    )
  ).rows
  const restored = await write(authored.id, {
    action: 'restore',
    expectedRevision: first.revision,
    sourceVersion: first.current.contentVersion,
  })
  const second = await publish(
    authored.id,
    restored.draft.draftVersion,
    first.current.contentVersion,
  )
  expect(second.current.contentVersion).toBe(first.current.contentVersion + 1)
  expect(
    (
      await db.query(
        'select to_jsonb(p) value from app_private.discipline_primary_profiles p where discipline_id=$1 and profile_version=$2',
        [authored.id, first.current.contentVersion],
      )
    ).rows,
  ).toEqual(before)
  expect(
    (
      await db.query(
        'select definition_version from public.get_character_discipline_catalog_v2($1,$2) where discipline_id=$3',
        [other, character, authored.id],
      )
    ).rows,
  ).toEqual([{ definition_version: second.current.contentVersion }])
})
it('unsupported old Discipline drafts remain blocked with no publication or Core writes', async () => {
  const saved = await createLegacyDiscipline()
  await denied(
    () => publish('discipline.test', saved.draft.draftVersion, null),
    /DISCIPLINE_PUBLICATION_INCOMPLETE/,
  )
  expect((await record('discipline.test')).draft).toEqual(saved.draft)
  expect(
    (
      await db.query(
        "select 1 from app_private.discipline_definitions where discipline_id='discipline.test'",
      )
    ).rows,
  ).toEqual([])
})
it('existing unique-Core and missing relationship failures roll back the entire saved publication', async () => {
  const existing = (
    await db.query<{ core_base_attributes: typeof authored.core }>(
      'select core_base_attributes from app_private.discipline_primary_profiles limit 1',
    )
  ).rows[0]!.core_base_attributes
  const saved = await authoredDraft({ ...authored, core: existing })
  await denied(
    () => publish(authored.id, saved.draft.draftVersion, null),
    /DISCIPLINE_CORE_BASE_MUST_BE_UNIQUE/,
  )
  expect((await record(authored.id)).current).toBeNull()
  expect(
    (
      await db.query(
        'select 1 from app_private.discipline_primary_profiles where discipline_id=$1',
        [authored.id],
      )
    ).rows,
  ).toEqual([])
  const edited = await write(authored.id, {
    action: 'save',
    expectedRevision: saved.revision,
    definition: { ...authored, essenceId: 'missing.essence' },
  })
  await denied(
    () => publish(authored.id, edited.draft.draftVersion, null),
    /DISCIPLINE_ESSENCE_UNAVAILABLE/,
  )
  expect((await record(authored.id)).current).toBeNull()
})
it('physical old-pointer rollback selects the exact prior Core while the next publication exceeds all physical versions', async () => {
  const saved = await authoredDraft()
  const first = await publish(authored.id, saved.draft.draftVersion, null)
  const edited = await write(authored.id, {
    action: 'save',
    expectedRevision: first.revision,
    definition: { ...authored, core: { ...authored.core, might: 10, finesse: 7 } },
  })
  const second = await publish(authored.id, edited.draft.draftVersion, first.current.contentVersion)
  await db.query(
    'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
    [authored.id, first.current.contentVersion],
  )
  expect(
    (
      await db.query(
        'select definition_version from public.get_character_discipline_catalog_v2($1,$2) where discipline_id=$3',
        [other, character, authored.id],
      )
    ).rows,
  ).toEqual([{ definition_version: first.current.contentVersion }])
  const restored = await write(authored.id, {
    action: 'restore',
    expectedRevision: second.revision,
    sourceVersion: first.current.contentVersion,
  })
  const next = await publish(authored.id, restored.draft.draftVersion, first.current.contentVersion)
  expect(next.current.contentVersion).toBe(second.current.contentVersion + 1)
  expect(
    (
      await db.query(
        'select count(*)::int n from app_private.discipline_primary_profiles where discipline_id=$1',
        [authored.id],
      )
    ).rows,
  ).toEqual([{ n: 3 }])
})
it('published release prerequisites use real progression facts without letting publication grant mastery', async () => {
  const saved = await authoredDraft({
    ...authored,
    unlock: {
      kind: 'all',
      rules: [{ kind: 'mastery', disciplineId: 'vanguard', minimumStage: 2 }],
    },
  } as typeof authored)
  await publish(authored.id, saved.draft.draftVersion, null)
  expect(
    (
      await db.query('select app_private.discipline_release_unlocked_v1($1,$2) unlocked', [
        character,
        authored.id,
      ])
    ).rows,
  ).toEqual([{ unlocked: false }])
  await db.query(
    "update app_private.character_discipline_progress set mastery_xp=100 where character_id=$1 and discipline_id='vanguard'",
    [character],
  )
  expect(
    (
      await db.query('select app_private.discipline_release_unlocked_v1($1,$2) unlocked', [
        character,
        authored.id,
      ])
    ).rows,
  ).toEqual([{ unlocked: true }])
  expect(
    (
      await db.query(
        'select 1 from app_private.character_discipline_masteries where character_id=$1 and discipline_id=$2',
        [character, authored.id],
      )
    ).rows,
  ).toEqual([])
})
it('unknown authored prerequisite references block the complete publication instead of creating an unreachable discipline', async () => {
  const saved = await authoredDraft({
    ...authored,
    unlock: { kind: 'mastery', disciplineId: 'missing.discipline', minimumStage: 2 },
  } as typeof authored)
  await denied(
    () => publish(authored.id, saved.draft.draftVersion, null),
    /DISCIPLINE_PREREQUISITE_UNAVAILABLE/,
  )
  expect((await record(authored.id)).current).toBeNull()
})
it('actual Primary change uses the current pointer and preserves personal choices and old Core pins', async () => {
  const personalBefore = (
    await db.query<{ personal_attributes: Record<string, number> }>(
      'select personal_attributes from public.get_character_attribute_allocation_v2($1,$2)',
      [other, character],
    )
  ).rows[0]!.personal_attributes as Record<string, number>
  const saved = await authoredDraft()
  const first = await publish(authored.id, saved.draft.draftVersion, null)
  const edit = await write(authored.id, {
    action: 'save',
    expectedRevision: first.revision,
    definition: { ...authored, core: { ...authored.core, might: 10, finesse: 7 } },
  })
  const second = await publish(authored.id, edit.draft.draftVersion, first.current.contentVersion)
  await db.query(
    'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
    [authored.id, first.current.contentVersion],
  )
  const args = [
    other,
    character,
    1,
    true,
    authored.id,
    false,
    null,
    '00000000-0000-4000-8000-000000000080',
    'authored-change-fingerprint',
  ]
  await db.query(
    'select * from public.change_character_disciplines_v3($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    args,
  )
  expect(
    (
      await db.query(
        'select primary_definition_version,primary_profile_version,build_version::int from app_private.character_active_builds where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([
    {
      primary_definition_version: first.current.contentVersion,
      primary_profile_version: first.current.contentVersion,
      build_version: 2,
    },
  ])
  const allocation = (
    await db.query<{
      base_attributes: Record<string, number>
      personal_attributes: Record<string, number>
    }>(
      'select base_attributes,personal_attributes from public.get_character_attribute_allocation_v2($1,$2)',
      [other, character],
    )
  ).rows[0]!
  expect(allocation.base_attributes).toEqual(authored.core)
  expect(allocation.personal_attributes).toEqual(personalBefore)
  expect(
    (
      await db.query(
        'select core_base_attributes from app_private.discipline_primary_profiles where discipline_id=$1 and profile_version=$2',
        [authored.id, second.current.contentVersion],
      )
    ).rows,
  ).toEqual([{ core_base_attributes: { ...authored.core, might: 10, finesse: 7 } }])
  await denied(
    () => write(authored.id, { action: 'archive', expectedRevision: second.revision }),
    /COMBAT_CONTENT_DEPENDENCIES/,
  )
})
it('an archived unused authored Discipline never reappears from physical history in current catalogues', async () => {
  const saved = await authoredDraft()
  const pub = await publish(authored.id, saved.draft.draftVersion, null)
  await write(authored.id, { action: 'archive', expectedRevision: pub.revision })
  expect(
    (
      await db.query(
        'select discipline_id from public.get_primary_discipline_catalog_v1() where discipline_id=$1',
        [authored.id],
      )
    ).rows,
  ).toEqual([])
  expect(
    (
      await db.query(
        'select discipline_id from public.get_character_discipline_catalog_v2($1,$2) where discipline_id=$3',
        [other, character, authored.id],
      )
    ).rows,
  ).toEqual([])
  await denied(
    () =>
      db.query(
        'select * from public.change_character_disciplines_v3($1,$2,1,true,$3,false,null,$4,$5)',
        [
          other,
          character,
          authored.id,
          '00000000-0000-4000-8000-000000000080',
          'archived-change-fingerprint',
        ],
      ),
    /PRIMARY_DISCIPLINE_UNAVAILABLE/,
  )
})
it('a late publication failure rolls back projected identity, Core and pointers along with content history', async () => {
  const saved = await authoredDraft()
  const before = await record(authored.id)
  await db.exec(`create function app_private.reject_discipline_publication_test() returns trigger language plpgsql as $$ begin raise exception 'FORCED_DISCIPLINE_LATE_FAILURE'; end; $$;
 create trigger late_discipline_failure before insert on app_private.combat_content_attribution for each row execute function app_private.reject_discipline_publication_test();`)
  await denied(
    () => publish(authored.id, saved.draft.draftVersion, null),
    /FORCED_DISCIPLINE_LATE_FAILURE/,
  )
  expect(await record(authored.id)).toEqual(before)
  for (const table of [
    'discipline_definitions',
    'discipline_primary_profiles',
    'discipline_current_definitions',
  ]) {
    expect(
      (await db.query(`select 1 from app_private.${table} where discipline_id=$1`, [authored.id]))
        .rows,
    ).toEqual([])
  }
})
it('new Discipline projection helpers and current-pointer storage have no browser or service mutation surface', async () => {
  const helpers = [
    'current_discipline_definitions_v1',
    'validate_authored_discipline_unlock_v1',
    'validate_authored_discipline_envelope_v1',
    'project_published_discipline_v1',
    'select_published_discipline_v1',
    'authored_discipline_unlock_satisfied_v1',
    'lock_current_discipline_selection_v1',
  ]
  const results = (
    await db.query<{ name: string; anon: boolean; authenticated: boolean; service: boolean }>(
      `select p.proname name,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any($1)`,
      [helpers],
    )
  ).rows
  expect(results).toHaveLength(helpers.length)
  expect(results.every((r) => !r.anon && !r.authenticated && !r.service)).toBe(true)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1,'app_private.discipline_current_definitions','select,insert,update,delete') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
  }
  expect(
    (
      await db.query<{ relrowsecurity: boolean }>(
        "select relrowsecurity from pg_class where oid='app_private.discipline_current_definitions'::regclass",
      )
    ).rows[0]!.relrowsecurity,
  ).toBe(true)
})
