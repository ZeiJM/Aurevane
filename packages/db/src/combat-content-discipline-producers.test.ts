import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveResonanceForPair } from '../../game-core/src/combat/resonance'
import { resolveEssenceForBuild } from '../../game-core/src/combat/essence'
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
let predecessorLearned: Record<string, unknown>[]
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
    if (name === '20261020225734_discipline_skill_earned_provenance.sql') {
      await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');
    insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
    values('${character}','${other}',0,1,'Test Player','test-player','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());`)
      await db.exec(
        `select * from public.record_character_skill_unlock_v1('${character}',(select skill_id from app_private.phase4_skill_catalog where discipline_id='wildwarden' order by skill_id limit 1),(select content_version from app_private.phase4_skill_catalog where discipline_id='wildwarden' order by skill_id limit 1),'wildwarden','support','discipline-testing-open:v1');`,
      )
      predecessorLearned = (
        await db.query<Record<string, unknown>>(
          'select * from app_private.character_skill_unlocks order by character_id,skill_id',
        )
      ).rows
    }
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(`Migration ${name}: ${String(error)}`, { cause: error })
    }
  }
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
  linkedSkills: [] as string[],
  skillStages: [] as { skillId: string; minimumStage: number }[],
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

async function publishAuxiliary(
  kind: 'essence' | 'resonance',
  id: string,
  changes: Record<string, unknown> = {},
) {
  const native =
    kind === 'resonance'
      ? resolveResonanceForPair('vanguard', 'lifebinder')!
      : resolveEssenceForBuild('vanguard', null)!
  const definition =
    kind === 'resonance'
      ? { ...native, id, ...changes }
      : {
          ...native,
          essenceId: id,
          skill: { ...(native as ReturnType<typeof resolveEssenceForBuild>)!.skill, id },
          ...changes,
        }
  const saved = await write(id, {
    action: 'create',
    requestId: crypto.randomUUID(),
    contentKind: kind,
    definition,
  })
  return publish(id, saved.draft.draftVersion, null)
}
async function publishNativeDiscipline(
  id: string,
  changes: Record<string, unknown> = {},
  expectedToken?: string,
) {
  const domain = (
    await db.query<{
      name: string
      summary: string
      core_base_attributes: object
      focus_attributes: string[]
    }>(
      'select d.name,d.summary,p.core_base_attributes,p.focus_attributes from app_private.current_discipline_definitions_v1() d join app_private.discipline_primary_profiles p on p.discipline_id=d.discipline_id and p.profile_version=d.primary_profile_version where d.discipline_id=$1',
      [id],
    )
  ).rows[0]!
  const definition = {
    ...authored,
    id,
    name: domain.name,
    description: domain.summary,
    core: domain.core_base_attributes,
    focus: domain.focus_attributes,
    ...changes,
  }
  const exists =
    (await db.query('select 1 from app_private.combat_content_records where content_key=$1', [id]))
      .rows.length > 0
  const prior = exists ? await record(id) : null
  const saved = await write(
    id,
    prior
      ? { action: 'save', expectedRevision: prior.revision, definition }
      : { action: 'create', requestId: crypto.randomUUID(), contentKind: 'discipline', definition },
  )
  return publish(
    id,
    saved.draft.draftVersion,
    prior?.current?.contentVersion ?? null,
    1,
    expectedToken,
  )
}
async function pairReference(a = 'vanguard', b = 'lifebinder') {
  return (
    await db.query<{ value: { resonanceId: string; contentVersion: number } | null }>(
      'select app_private.resolve_resonance_reference_v1($1,$2) value',
      [a, b],
    )
  ).rows[0]!.value
}
it('actual SQL current extensions follow explicit custom identities and current publication versions in either pair order', async () => {
  const resonance = await publishAuxiliary('resonance', 'resonance.authored')
  const essence = await publishAuxiliary('essence', 'essence.authored')
  await publishNativeDiscipline('vanguard', {
    essenceId: 'essence.authored',
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  for (const pair of [
    ['vanguard', 'lifebinder'],
    ['lifebinder', 'vanguard'],
  ]) {
    expect(await pairReference(pair[0], pair[1])).toMatchObject({
      resonanceId: 'resonance.authored',
      contentVersion: resonance.current.contentVersion,
    })
  }
  expect(
    (
      await db.query<{ value: unknown }>(
        "select app_private.resolve_essence_reference_v1('vanguard',null) value",
      )
    ).rows[0]!.value,
  ).toMatchObject({
    essenceId: 'essence.authored',
    contentVersion: essence.current.contentVersion,
    skillContentVersion: essence.current.contentVersion,
  })
  expect(
    (
      await db.query<{ value: unknown }>(
        "select app_private.resolve_essence_reference_v1('vanguard','lifebinder') value",
      )
    ).rows[0]!.value,
  ).toBeNull()
})
it.each([
  ['vanguard', 'lifebinder'],
  ['lifebinder', 'vanguard'],
])(
  'conflicting published pair declarations block atomically in order %s then %s',
  async (first, second) => {
    await publishAuxiliary('resonance', 'resonance.authored')
    await publishAuxiliary('resonance', 'resonance.other')
    await publishNativeDiscipline(first, {
      resonanceSelections: [{ withDisciplineId: second, resonanceId: 'resonance.authored' }],
    })
    await denied(
      () =>
        publishNativeDiscipline(second, {
          resonanceSelections: [{ withDisciplineId: first, resonanceId: 'resonance.other' }],
        }),
      /DISCIPLINE_RESONANCE_SELECTION_CONFLICT/,
    )
    expect(await pairReference()).toMatchObject({ resonanceId: 'resonance.authored' })
  },
)
it('removing one declaration preserves the other explicit claim; removing both never resurrects the builtin pair', async () => {
  await publishAuxiliary('resonance', 'resonance.authored')
  await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  await publishNativeDiscipline('lifebinder', {
    resonanceSelections: [{ withDisciplineId: 'vanguard', resonanceId: 'resonance.authored' }],
  })
  await publishNativeDiscipline('vanguard', { resonanceSelections: [] })
  expect(await pairReference()).toMatchObject({ resonanceId: 'resonance.authored' })
  await publishNativeDiscipline('lifebinder', { resonanceSelections: [] })
  expect(await pairReference()).toBeNull()
  expect(await pairReference('lifebinder', 'vanguard')).toBeNull()
})
it('untouched builtin selection follows its actual current content pointer, never the latest physical version', async () => {
  const native = resolveResonanceForPair('vanguard', 'lifebinder')!
  const saved = await write(native.id, {
    action: 'save',
    expectedRevision: (await record(native.id)).revision,
    definition: native,
  })
  const first = await publish(native.id, saved.draft.draftVersion, null)
  const next = await write(native.id, {
    action: 'save',
    expectedRevision: first.revision,
    definition: { ...native, name: 'New pointer' },
  })
  const second = await publish(native.id, next.draft.draftVersion, first.current.contentVersion)
  expect(await pairReference()).toMatchObject({
    resonanceId: native.id,
    contentVersion: second.current.contentVersion,
  })
  await db.query(
    'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
    [native.id, first.current.contentVersion],
  )
  expect(await pairReference()).toMatchObject({
    resonanceId: native.id,
    contentVersion: first.current.contentVersion,
  })
})
it('canonical selection service read exposes exact versioned pins and token but has no browser execution grant', async () => {
  const published = await publishAuxiliary('resonance', 'resonance.authored')
  await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  const value = (
    await db.query<{ value: unknown }>(
      "select public.read_current_discipline_selection_v1('vanguard','lifebinder') value",
    )
  ).rows[0]!.value
  expect(value).toMatchObject({
    selectionVersion: 1,
    catalogueToken: await token(),
    essence: null,
    resonance: {
      resonanceId: 'resonance.authored',
      contentVersion: published.current.contentVersion,
      disciplinePair: ['lifebinder', 'vanguard'],
    },
  })
  for (const role of ['anon', 'authenticated', 'service_role']) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'public.read_current_discipline_selection_v1(text,text)','execute') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(role === 'service_role')
    for (const name of ['current_resonance_selection_key_v1', 'current_essence_selection_key_v1'])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            `select has_function_privilege($1,'app_private.${name}(text,text)','execute') allowed`,
            [role],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
  }
})
it('a stale catalogue CAS cannot change canonical pair selection or append a published Discipline version', async () => {
  await publishAuxiliary('resonance', 'resonance.authored')
  const first = await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  const stale = await token()
  await publishAuxiliary('resonance', 'resonance.other')
  const draft = await write('vanguard', {
    action: 'save',
    expectedRevision: first.revision,
    definition: {
      ...first.current.definition,
      resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.other' }],
    },
  })
  const before = await record('vanguard')
  await denied(
    () => publish('vanguard', draft.draft.draftVersion, first.current.contentVersion, 1, stale),
    /COMBAT_CONTENT_CATALOGUE_CONFLICT/,
  )
  expect(await record('vanguard')).toEqual(before)
  expect(await pairReference()).toMatchObject({ resonanceId: 'resonance.authored' })
})
it('selected disabled or corrupt current definitions fail closed instead of choosing the builtin', async () => {
  const published = await publishAuxiliary('resonance', 'resonance.authored')
  await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  // Model already-retained corruption independently of the new publication guard.
  await db.exec(
    'alter table app_private.combat_content_publications disable trigger validate_discipline_selections',
  )
  // Inject separate invalid physical rows to test the read boundary; immutable old rows remain untouched.
  for (const [index, change] of [
    { enabled: false },
    { disciplinePair: ['arcanist', 'vanguard'] },
  ].entries()) {
    const version = 100 + index
    await db.query(
      'insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by) values($1,$2,$3,$4,$5)',
      [
        'resonance.authored',
        'resonance',
        version,
        { ...published.current.definition, contentVersion: version, ...change },
        owner,
      ],
    )
    await db.query(
      'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
      ['resonance.authored', version],
    )
    await denied(
      () => pairReference(),
      index === 0 ? /COMBAT_CONTENT_SELECTION_DISABLED/ : /COMBAT_CONTENT_SELECTION_INVALID/,
    )
  }
})
it('removing actual builtin selections releases only those dependency blockers and permits archive without resurrection', async () => {
  const resonance = resolveResonanceForPair('vanguard', 'lifebinder')!
  const essence = resolveEssenceForBuild('vanguard', null)!
  await publishNativeDiscipline('vanguard', { resonanceSelections: [], essenceId: null })
  for (const key of [resonance.id, essence.essenceId]) {
    const current = await record(key)
    expect(current.usedBy).toEqual([])
    await write(key, { action: 'archive', expectedRevision: current.revision })
  }
  expect(await pairReference()).toBeNull()
  expect(
    (
      await db.query<{ value: unknown }>(
        "select app_private.resolve_essence_reference_v1('vanguard',null) value",
      )
    ).rows[0]!.value,
  ).toBeNull()
  const untouched = resolveResonanceForPair('vanguard', 'arcanist')
  if (untouched) throw new Error('Unexpected nonexistent builtin control.')
  const stillUsed = resolveResonanceForPair('lifebinder', 'farstrider')!
  expect((await record(stillUsed.id)).usedBy).toContainEqual({
    kind: 'builtin-resonance-selection',
    key: 'farstrider+lifebinder',
    blocking: true,
  })
})
it('publication refuses disabling an actually selected target and rolls back current history and draft consumption', async () => {
  const target = await publishAuxiliary('resonance', 'resonance.authored')
  await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  const draft = await write('resonance.authored', {
    action: 'save',
    expectedRevision: target.revision,
    definition: { ...target.current.definition, enabled: false },
  })
  const before = await record('resonance.authored')
  await denied(
    () => publish('resonance.authored', draft.draft.draftVersion, target.current.contentVersion),
    /COMBAT_CONTENT_SELECTION_DISABLED/,
  )
  expect(await record('resonance.authored')).toEqual(before)
  expect(await pairReference()).toMatchObject({
    resonanceId: 'resonance.authored',
    contentVersion: target.current.contentVersion,
  })
})
it('publication cannot select a disabled target; removal permits later target disable and replacement', async () => {
  const target = await publishAuxiliary('resonance', 'resonance.authored', { enabled: false })
  await denied(
    () =>
      publishNativeDiscipline('vanguard', {
        resonanceSelections: [
          { withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' },
        ],
      }),
    /COMBAT_CONTENT_SELECTION_DISABLED/,
  )
  expect(await pairReference()).toMatchObject({
    resonanceId: resolveResonanceForPair('vanguard', 'lifebinder')!.id,
  })
  const saved = await write('resonance.authored', {
    action: 'save',
    expectedRevision: target.revision,
    definition: { ...target.current.definition, enabled: true },
  })
  const enabled = await publish(
    'resonance.authored',
    saved.draft.draftVersion,
    target.current.contentVersion,
  )
  await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.authored' }],
  })
  await publishNativeDiscipline('vanguard', { resonanceSelections: [] })
  const disabled = await write('resonance.authored', {
    action: 'save',
    expectedRevision: enabled.revision,
    definition: { ...enabled.current.definition, enabled: false },
  })
  await publish('resonance.authored', disabled.draft.draftVersion, enabled.current.contentVersion)
  expect(await pairReference()).toBeNull()
})
it('a conflicting old pointer rollback cannot replace canonical pair selection or its projected Core', async () => {
  await publishAuxiliary('resonance', 'resonance.first')
  await publishAuxiliary('resonance', 'resonance.second')
  const first = await publishNativeDiscipline('vanguard', {
    resonanceSelections: [{ withDisciplineId: 'lifebinder', resonanceId: 'resonance.first' }],
  })
  await publishNativeDiscipline('vanguard', { resonanceSelections: [] })
  await publishNativeDiscipline('lifebinder', {
    resonanceSelections: [{ withDisciplineId: 'vanguard', resonanceId: 'resonance.second' }],
  })
  const before = await record('vanguard')
  const domainBefore = (
    await db.query(
      "select * from app_private.current_discipline_definitions_v1() where discipline_id='vanguard'",
    )
  ).rows
  await denied(
    () =>
      db.query(
        'update app_private.combat_content_publications set version_id=(select id from app_private.combat_content_versions where content_key=$1 and content_version=$2) where content_key=$1',
        ['vanguard', first.current.contentVersion],
      ),
    /DISCIPLINE_RESONANCE_SELECTION_CONFLICT/,
  )
  expect(await record('vanguard')).toEqual(before)
  expect(
    (
      await db.query(
        "select * from app_private.current_discipline_definitions_v1() where discipline_id='vanguard'",
      )
    ).rows,
  ).toEqual(domainBefore)
  expect(await pairReference()).toMatchObject({ resonanceId: 'resonance.second' })
  for (const role of ['anon', 'authenticated', 'service_role'])
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'app_private.validate_current_discipline_selections_v1()','execute') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
})
it('existing native grant bytes retain their earned provenance and eligibility through the storage migration', async () => {
  const rows = (
    await db.query<{
      source_discipline_id: string
      eligibility_discipline_id: string
      learned_at: Date
      earned_at: Date
      source_kind: string
      earned_source_kind: string
      source_id: string
      earned_source_id: string
    }>(
      'select l.*,g.eligibility_discipline_id,g.earned_at,g.earned_source_kind,g.earned_source_id from app_private.character_skill_unlocks l join app_private.character_discipline_skill_grants g using(character_id,skill_id) where character_id=$1',
      [character],
    )
  ).rows
  expect(
    (
      await db.query(
        'select * from app_private.character_skill_unlocks order by character_id,skill_id',
      )
    ).rows,
  ).toEqual(predecessorLearned)
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.eligibility_discipline_id).toBe(row.source_discipline_id)
    if (row.source_kind === 'support' && row.source_id === 'discipline-testing-open:v1') {
      expect(row.earned_at).toBeNull()
      expect(row.earned_source_kind).toBeNull()
      expect(row.earned_source_id).toBeNull()
    } else {
      expect(row.earned_at).toEqual(row.learned_at)
      expect(row.earned_source_kind).toBe(row.source_kind)
      expect(row.earned_source_id).toBe(row.source_id)
    }
  }
})
async function sharedSkill() {
  return (
    await db.query<{ skill_id: string; content_version: number }>(
      "select skill_id,content_version from app_private.phase4_skill_catalog where discipline_id='lifebinder' order by skill_id limit 1",
    )
  ).rows[0]!
}
it('publishing a shared link grants nothing; actual provisioning records distinct earned Discipline eligibility and intrinsic source', async () => {
  const skill = await sharedSkill()
  await db.query('select * from public.record_character_skill_unlock_v1($1,$2,$3,$4,$5,$6)', [
    character,
    skill.skill_id,
    skill.content_version,
    'lifebinder',
    'gameplay',
    'earned-control',
  ])
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  expect(
    (
      await db.query(
        'select 1 from app_private.character_discipline_skill_grants where character_id=$1 and skill_id=$2 and eligibility_discipline_id=$3',
        [character, skill.skill_id, 'vanguard'],
      )
    ).rows,
  ).toEqual([])
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  const rows = (
    await db.query<{
      source_discipline_id: string
      eligibility_discipline_id: string
      earned_at: string | null
    }>(
      'select l.source_discipline_id,g.eligibility_discipline_id,g.earned_at from app_private.character_skill_unlocks l join app_private.character_discipline_skill_grants g using(character_id,skill_id) where character_id=$1 and skill_id=$2 order by eligibility_discipline_id',
      [character, skill.skill_id],
    )
  ).rows
  expect(rows).toHaveLength(2)
  expect(rows.map((r) => r.eligibility_discipline_id)).toEqual(['lifebinder', 'vanguard'])
  expect(rows.every((r) => r.source_discipline_id === 'lifebinder' && r.earned_at !== null)).toBe(
    true,
  )
  const before = (
    await db.query(
      'select * from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
      [character, skill.skill_id],
    )
  ).rows
  await publishNativeDiscipline('vanguard', { linkedSkills: [], skillStages: [] })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  expect(
    (
      await db.query(
        'select * from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
        [character, skill.skill_id],
      )
    ).rows,
  ).toEqual(before)
})
it('testing access is not earned eligibility and an actual mastery grant upgrades it without rewriting its testing provenance', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 5 }],
  })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  const before = (
    await db.query<{
      learned_at: unknown
      earned_at: unknown
      source_id: string
      earned_source_id: string | null
    }>(
      'select g.*,g.granted_at learned_at,g.grant_source_id source_id from app_private.character_discipline_skill_grants g where character_id=$1 and skill_id=$2 and eligibility_discipline_id=$3',
      [character, skill.skill_id, 'vanguard'],
    )
  ).rows[0]!
  expect(before).toMatchObject({
    earned_at: null,
    earned_source_id: null,
    source_id: 'discipline-testing-open:v1',
  })
  await db.query('select * from public.record_character_discipline_mastery_v1($1,$2,$3,$4)', [
    character,
    'vanguard',
    'owner',
    'actual-mastery-control',
  ])
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  const after = (
    await db.query<{
      learned_at: unknown
      earned_at: unknown
      source_id: string
      earned_source_id: string
    }>(
      'select g.*,g.granted_at learned_at,g.grant_source_id source_id from app_private.character_discipline_skill_grants g where character_id=$1 and skill_id=$2 and eligibility_discipline_id=$3',
      [character, skill.skill_id, 'vanguard'],
    )
  ).rows[0]!
  expect(after.learned_at).toEqual(before.learned_at)
  expect(after.source_id).toBe(before.source_id)
  expect(after.earned_at).not.toBeNull()
  expect(after.earned_source_id).toBe('discipline-mastery:v1')
})
it('a cross-only learned row does not fabricate native eligibility in the old reader or the joined availability authority', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  expect(
    (
      await db.query(
        'select * from public.get_character_learned_skills_v1($1,$2) where skill_id=$3',
        [other, character, skill.skill_id],
      )
    ).rows,
  ).toEqual([])
  expect(
    (
      await db.query(
        'select source_discipline_id,eligibility_discipline_id from public.get_character_learned_skills_v2($1,$2) where skill_id=$3',
        [other, character, skill.skill_id],
      )
    ).rows,
  ).toEqual([{ source_discipline_id: 'lifebinder', eligibility_discipline_id: 'vanguard' }])
  expect(
    (
      await db.query('select * from public.get_character_learned_skills_v2($1,$2)', [
        owner,
        character,
      ])
    ).rows,
  ).toEqual([])
})
it('late attached-grant failure rolls back the new learned row and all grant facts', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  await db.exec(
    "create function app_private.reject_grant_test() returns trigger language plpgsql as $$ begin raise exception 'FORCED_GRANT_FAILURE'; end; $$; create trigger reject_grant_test after insert on app_private.character_discipline_skill_grants for each row execute function app_private.reject_grant_test();",
  )
  await denied(
    () => db.query('select app_private.provision_mastery_skills_v1($1)', [character]),
    /FORCED_GRANT_FAILURE/,
  )
  expect(
    (
      await db.query(
        'select * from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
        [character, skill.skill_id],
      )
    ).rows,
  ).toEqual([])
  expect(
    (
      await db.query(
        'select * from app_private.character_discipline_skill_grants where character_id=$1 and skill_id=$2',
        [character, skill.skill_id],
      )
    ).rows,
  ).toEqual([])
})
it('attached grants require a real learned identity, keep private RLS/ACLs and retain usable unearned native testing access', async () => {
  await denied(
    () =>
      db.query(
        "insert into app_private.character_discipline_skill_grants values($1,'missing.skill','vanguard',now(),'gameplay','missing',now(),'gameplay','missing')",
        [character],
      ),
    /foreign key/,
  )
  const testing = (
    await db.query<{ skill_id: string; earned_at: unknown }>(
      'select * from public.get_character_learned_skills_v2($1,$2) where eligibility_discipline_id=$3',
      [other, character, 'wildwarden'],
    )
  ).rows
  expect(testing).toHaveLength(1)
  expect(testing[0]!.earned_at).toBeNull()
  expect(
    (
      await db.query(
        'select * from public.get_character_learned_skills_v1($1,$2) where skill_id=$3',
        [other, character, testing[0]!.skill_id],
      )
    ).rows,
  ).toHaveLength(1)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1,'app_private.character_discipline_skill_grants','select,insert,update,delete') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
    for (const signature of [
      'app_private.grant_discipline_skill_v1(uuid,text,integer,text,text,text,text,boolean)',
      'app_private.current_discipline_skill_catalog_v1(text)',
      'app_private.character_discipline_skill_availability_v1(uuid)',
    ])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') allowed",
            [role, signature],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'public.get_character_learned_skills_v2(uuid,uuid)','execute') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(role === 'service_role')
  }
  expect(
    (
      await db.query<{ enabled: boolean }>(
        "select relrowsecurity enabled from pg_class where oid='app_private.character_discipline_skill_grants'::regclass",
      )
    ).rows[0]!.enabled,
  ).toBe(true)
})
async function saveSkillReferences(skills: object[]) {
  const version = (
    await db.query<{ build_version: number }>(
      'select build_version from app_private.character_active_builds where character_id=$1',
      [character],
    )
  ).rows[0]!.build_version
  return db.query(
    'select * from public.save_character_discipline_skill_loadout_v1($1,$2,$3,$4,$5,$6)',
    [other, character, version, skills, crypto.randomUUID(), 'earned-selection-test'],
  )
}
it('actual equipped and committed references persist selected earned eligibility without reparenting intrinsic Skill source', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  await saveSkillReferences([
    {
      skillId: skill.skill_id,
      contentVersion: (
        await db.query<{ skill_content_version: number }>(
          'select skill_content_version from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
          [character, skill.skill_id],
        )
      ).rows[0]!.skill_content_version,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
    },
  ])
  expect(
    (
      await db.query(
        'select source_discipline_id,eligibility_discipline_id from app_private.character_build_discipline_skills where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([{ source_discipline_id: 'lifebinder', eligibility_discipline_id: 'vanguard' }])
  const snapshot = (
    await db.query<{ value: { disciplineSkills: unknown[] } }>(
      'select public.get_character_committed_build_snapshot_v2($1,$2) value',
      [other, character],
    )
  ).rows[0]!.value
  expect(snapshot.disciplineSkills).toContainEqual(
    expect.objectContaining({
      skillId: skill.skill_id,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
    }),
  )
})
it('a new selection infers only a sole active grant and demands an explicit choice when both Disciplines qualify', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  const reference = {
    skillId: skill.skill_id,
    contentVersion: (
      await db.query<{ skill_content_version: number }>(
        'select skill_content_version from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
        [character, skill.skill_id],
      )
    ).rows[0]!.skill_content_version,
    sourceDisciplineId: 'lifebinder',
  }
  await saveSkillReferences([reference])
  await db.query('select * from public.record_character_discipline_mastery_v1($1,$2,$3,$4)', [
    character,
    'lifebinder',
    'owner',
    'secondary-control',
  ])
  const version = (
    await db.query<{ build_version: number }>(
      'select build_version from app_private.character_active_builds where character_id=$1',
      [character],
    )
  ).rows[0]!.build_version
  await db.query(
    'select * from public.change_character_disciplines_v3($1,$2,$3,false,null,true,$4,$5,$6)',
    [other, character, version, 'lifebinder', crypto.randomUUID(), 'secondary-selection-control'],
  )
  await denied(() => saveSkillReferences([reference]), /DISCIPLINE_SKILL_ELIGIBILITY_REQUIRED/)
  await saveSkillReferences([{ ...reference, eligibilityDisciplineId: 'vanguard' }])
  expect(
    (
      await db.query(
        'select eligibility_discipline_id from app_private.character_build_discipline_skills where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([{ eligibility_discipline_id: 'vanguard' }])
})
it.each([null, 42, {}, ' vanguard', 'vanguard\n'])(
  'present malformed eligibility %j is rejected before replacing a valid selection',
  async (eligibility) => {
    const native = (
      await db.query<{ skill_id: string; skill_content_version: number }>(
        'select skill_id,skill_content_version from app_private.character_skill_unlocks where character_id=$1 and source_discipline_id=$2 order by skill_id limit 1',
        [character, 'vanguard'],
      )
    ).rows[0]!
    const reference = {
      skillId: native.skill_id,
      contentVersion: native.skill_content_version,
      sourceDisciplineId: 'vanguard',
    }
    await saveSkillReferences([reference])
    const before = (
      await db.query(
        'select * from app_private.character_build_discipline_skills where character_id=$1',
        [character],
      )
    ).rows
    await denied(
      () => saveSkillReferences([{ ...reference, eligibilityDisciplineId: eligibility }]),
      /SKILL_LOADOUT_REFERENCE_INVALID/,
    )
    expect(
      (
        await db.query(
          'select * from app_private.character_build_discipline_skills where character_id=$1',
          [character],
        )
      ).rows,
    ).toEqual(before)
  },
)
it('a retained unequipped earned grant blocks archiving its eligibility Discipline after the link is removed', async () => {
  const skill = await sharedSkill()
  const draft = await authoredDraft({
    ...authored,
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  const first = await publish(authored.id, draft.draft.draftVersion, null)
  await db.query('select app_private.grant_discipline_skill_v1($1,$2,$3,$4,$5,$6,$7,true)', [
    character,
    skill.skill_id,
    skill.content_version,
    'lifebinder',
    authored.id,
    'gameplay',
    'actual-earned-control',
  ])
  const unlinked = await write(authored.id, {
    action: 'save',
    expectedRevision: first.revision,
    definition: { ...first.current.definition, linkedSkills: [], skillStages: [] },
  })
  const current = await publish(
    authored.id,
    unlinked.draft.draftVersion,
    first.current.contentVersion,
  )
  expect(current.usedBy).toContainEqual({
    kind: 'discipline-skill-grant',
    key: `${character}:${skill.skill_id}:${authored.id}`,
    blocking: true,
  })
  expect(
    (
      await db.query(
        'select * from app_private.character_build_discipline_skills where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([])
  await denied(
    () => write(authored.id, { action: 'archive', expectedRevision: current.revision }),
    /COMBAT_CONTENT_DEPENDENCIES/,
  )
  expect((await record(authored.id)).lifecycle).toBe('active')
})
it('named loadouts retain explicit eligibility and historical omitted eligibility activates as native even when another grant qualifies', async () => {
  const skill = await sharedSkill()
  await publishNativeDiscipline('vanguard', {
    linkedSkills: [skill.skill_id],
    skillStages: [{ skillId: skill.skill_id, minimumStage: 1 }],
  })
  await db.query('select app_private.provision_mastery_skills_v1($1)', [character])
  await db.query('select * from public.record_character_discipline_mastery_v1($1,$2,$3,$4)', [
    character,
    'lifebinder',
    'owner',
    'saved-native-control',
  ])
  await db.query(
    'select * from public.change_character_disciplines_v3($1,$2,1,false,null,true,$3,$4,$5)',
    [other, character, 'lifebinder', crypto.randomUUID(), 'saved-native-secondary'],
  )
  const version = (
    await db.query<{ skill_content_version: number }>(
      'select skill_content_version from app_private.character_skill_unlocks where character_id=$1 and skill_id=$2',
      [character, skill.skill_id],
    )
  ).rows[0]!.skill_content_version
  await saveSkillReferences([
    {
      skillId: skill.skill_id,
      contentVersion: version,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'lifebinder',
    },
  ])
  let buildVersion = (
    await db.query<{ build_version: number }>(
      'select build_version from app_private.character_active_builds where character_id=$1',
      [character],
    )
  ).rows[0]!.build_version
  await db.query(
    'select * from public.save_character_build_loadout_v1($1,$2,1::smallint,$3,$4,$5,$6)',
    [other, character, 'Saved native', buildVersion, crypto.randomUUID(), 'saved-native-persist'],
  )
  expect(
    (
      await db.query<{ discipline_skills: unknown[] }>(
        'select discipline_skills from app_private.character_saved_build_loadouts where character_id=$1',
        [character],
      )
    ).rows[0]!.discipline_skills,
  ).toEqual([
    {
      skillId: skill.skill_id,
      contentVersion: version,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'lifebinder',
    },
  ])
  // Model an existing old saved row; activation must not rewrite its historical body.
  await db.query(
    "update app_private.character_saved_build_loadouts set discipline_skills=jsonb_build_array((discipline_skills->0)-'eligibilityDisciplineId') where character_id=$1",
    [character],
  )
  const before = (
    await db.query(
      'select * from app_private.character_saved_build_loadouts where character_id=$1',
      [character],
    )
  ).rows
  await saveSkillReferences([])
  buildVersion = (
    await db.query<{ build_version: number }>(
      'select build_version from app_private.character_active_builds where character_id=$1',
      [character],
    )
  ).rows[0]!.build_version
  await db.query(
    'select * from public.activate_character_build_loadout_v1($1,$2,1::smallint,$3,$4,$5)',
    [other, character, buildVersion, crypto.randomUUID(), 'saved-native-activate'],
  )
  expect(
    (
      await db.query(
        'select eligibility_discipline_id from app_private.character_build_discipline_skills where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([{ eligibility_discipline_id: 'lifebinder' }])
  expect(
    (
      await db.query(
        'select * from app_private.character_saved_build_loadouts where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual(before)
})
it('new selection helpers remain private and capacity rejects before expensive eligibility lookup or state writes', async () => {
  const before = (
    await db.query('select * from app_private.character_active_builds where character_id=$1', [
      character,
    ])
  ).rows
  await denied(
    () => saveSkillReferences(Array.from({ length: 5 }, () => ({}))),
    /DISCIPLINE_SKILL_CAPACITY_EXCEEDED/,
  )
  expect(
    (
      await db.query('select * from app_private.character_active_builds where character_id=$1', [
        character,
      ])
    ).rows,
  ).toEqual(before)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const signature of [
      'app_private.default_native_skill_eligibility_v1()',
      'app_private.resolve_skill_eligibility_v1(uuid,jsonb,text,text)',
    ])
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') allowed",
            [role, signature],
          )
        ).rows[0]!.allowed,
      ).toBe(false)
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'public.get_character_discipline_skill_loadout_v2(uuid,uuid)','execute') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(role === 'service_role')
  }
})
it('the actual build-change pruning trigger preserves a valid three-plus-one selection and its exact pins', async () => {
  await db.query('select * from public.record_character_discipline_mastery_v1($1,$2,$3,$4)', [
    character,
    'lifebinder',
    'owner',
    'capacity-control',
  ])
  await db.query(
    'select * from public.change_character_disciplines_v3($1,$2,1,false,null,true,$3,$4,$5)',
    [other, character, 'lifebinder', crypto.randomUUID(), 'capacity-secondary-control'],
  )
  const rows = (
    await db.query<{
      skill_id: string
      skill_content_version: number
      source_discipline_id: string
    }>(
      "select skill_id,skill_content_version,source_discipline_id from app_private.character_skill_unlocks where character_id=$1 and source_discipline_id in ('vanguard','lifebinder') order by skill_id",
      [character],
    )
  ).rows
  const selected = [
    ...rows.filter((r) => r.source_discipline_id === 'vanguard').slice(0, 3),
    ...rows.filter((r) => r.source_discipline_id === 'lifebinder').slice(0, 1),
  ].map((r) => ({
    skillId: r.skill_id,
    contentVersion: r.skill_content_version,
    sourceDisciplineId: r.source_discipline_id,
    eligibilityDisciplineId: r.source_discipline_id,
  }))
  await saveSkillReferences(selected)
  const before = (
    await db.query(
      'select * from app_private.character_build_discipline_skills where character_id=$1 order by slot_index',
      [character],
    )
  ).rows
  await db.query(
    'update app_private.character_active_builds set primary_discipline_id=primary_discipline_id where character_id=$1',
    [character],
  )
  expect(
    (
      await db.query(
        'select * from app_private.character_build_discipline_skills where character_id=$1 order by slot_index',
        [character],
      )
    ).rows,
  ).toEqual(before)
  expect(before).toHaveLength(4)
})
