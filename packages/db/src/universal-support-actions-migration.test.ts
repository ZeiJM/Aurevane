import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { inspectMigrationSecurity } from './migration-policy'
import {
  defaultBasicSkills,
  resolveBuiltinBasicSkillVersion,
} from '../../game-core/src/combat/combat-basic-actions'
import { defaultCombatTagDefinitions } from '../../game-core/src/combat/combat-tag-wording'

const migration = '20261102031427_universal_support_actions.sql'
const sql = () =>
  readFileSync(resolve(process.cwd(), '../../supabase/migrations', migration), 'utf8')
const user = '00000000-0000-4000-8000-000000000041'
const characters = [
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000052',
  '00000000-0000-4000-8000-000000000053',
]
const legacyRequest = '00000000-0000-4000-8000-000000000061'
const choices = [
  'basic.recover',
  'basic.recover.mp',
  'basic.pilfer',
  'basic.fleetstep',
  'basic.invocation',
]
const signature = 'public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'
let db: PGlite
let before: {
  active: Record<string, unknown>[]
  saved: Record<string, unknown>[]
  protected: unknown
  acl: unknown
  audits: unknown
  pilfer: unknown
}
async function active(database = db) {
  return (
    await database.query<Record<string, unknown>>(
      'select * from app_private.character_active_builds order by character_id',
    )
  ).rows
}
async function saved(database = db) {
  return (
    await database.query<Record<string, unknown>>(
      'select * from app_private.character_saved_build_loadouts order by character_id,slot_index',
    )
  ).rows
}
async function protectedState(database = db) {
  const result: Record<string, unknown> = {}
  for (const table of [
    'battle_sessions',
    'battle_snapshots',
    'battle_events',
    'combat_content_versions',
    'combat_content_publications',
    'combat_content_drafts',
    'character_support_action_idempotency',
    'character_saved_build_loadout_save_idempotency',
    'character_saved_build_loadout_activation_idempotency',
    'character_saved_build_loadout_activation_audit',
    'character_build_discipline_skills',
    'character_attribute_personal_allocations',
  ])
    result[table] = (
      await database.query(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') state from app_private.${table} t`,
      )
    ).rows
  result.characters = (
    await database.query('select to_jsonb(c) state from public.characters c order by id')
  ).rows
  return result
}
async function acl(database = db) {
  return (
    await database.query(
      'select proacl,prosecdef,proconfig,proargnames,prorettype from pg_proc where oid=$1::regprocedure',
      [signature],
    )
  ).rows
}
async function save(
  choice: string,
  version: number,
  request = crypto.randomUUID(),
  fingerprint = `support:${choice}`,
  character = characters[0]!,
  database = db,
) {
  return database.query<{ build_version: number; replayed: boolean; saved_at: Date }>(
    'select * from public.save_character_support_action_v1($1,$2,$3,$4,$5,$6)',
    [user, character, version, choice, request, fingerprint],
  )
}
async function version(character = characters[0]!) {
  return Number(
    (
      await db.query<{ build_version: number }>(
        'select build_version from app_private.character_active_builds where character_id=$1',
        [character],
      )
    ).rows[0]!.build_version,
  )
}
async function denied(run: () => Promise<unknown>, pattern: RegExp) {
  await db.exec('savepoint denied')
  await expect(run()).rejects.toThrow(pattern)
  await db.exec('rollback to savepoint denied; release savepoint denied')
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name !== migration) return
    await database.query('insert into auth.users(id) values($1)', [user])
    await database.query(
      "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
      [user],
    )
    for (const [index, character] of characters.entries()) {
      await database.query(
        `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        values($1,$2,$3,1,$4,$4,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
        [character, user, index, `support-${index}`],
      )
      const choice = ['basic.guard', 'basic.recover', 'basic.recover.mp'][index]!
      await save(
        choice,
        1,
        index === 0 ? legacyRequest : crypto.randomUUID(),
        `legacy:${choice}`,
        character,
        database,
      )
      await database.query(
        'select * from public.save_character_build_loadout_v1($1,$2,1::smallint,$3,2,$4,$5)',
        [user, character, `Saved ${index}`, crypto.randomUUID(), `saved-support-${index}`],
      )
      if (index === 1) {
        await save('basic.guard', 2, crypto.randomUUID(), 'legacy:saved-guard', character, database)
        await database.query(
          'select * from public.save_character_build_loadout_v1($1,$2,2::smallint,$3,3,$4,$5)',
          [user, character, 'Retained Guard slot', crypto.randomUUID(), 'saved-guard-slot'],
        )
        await save(
          'basic.recover',
          3,
          crypto.randomUUID(),
          'legacy:restored-hp',
          character,
          database,
        )
      }
    }
    await database.query(
      `insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot) values('00000000-0000-4000-8000-000000000071',$1,'retained-guard-support',1,1,'completed','{"supportActionId":"basic.guard","capturedAbilitySources":[{"abilityId":"basic.guard","contentVersion":1}],"tactical":{"battle":{"battleId":"retained-guard-support","rulesVersion":1,"contentVersion":1,"lifecycle":"completed","combatants":[{"id":"player"},{"id":"enemy"}],"rng":{}}}}')`,
      [user],
    )
    await database.exec(`insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) select id,2,current_snapshot from app_private.battle_sessions;
      insert into app_private.battle_events(battle_session_id,battle_version,event_index,event) values('00000000-0000-4000-8000-000000000071',2,0,'{"event":"combat_action_used","actionId":"basic.guard"}');`)
    await database.query(
      "insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by) values('basic.guard','skill',1,$1,$2)",
      [resolveBuiltinBasicSkillVersion('basic.guard', 1)!, user],
    )
    await database.query(
      "insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by) select content_key,content_kind,id,published_by from app_private.combat_content_versions where content_key='basic.guard'",
    )
    await database.query(
      "insert into app_private.combat_content_drafts(content_key,content_kind,definition,base_version,updated_by) values('basic.guard','skill',$1,1,$2)",
      [{ id: 'basic.guard', contentVersion: 1, name: 'Retained Owner draft' }, user],
    )
    await database.query(
      "insert into app_private.combat_content_records(content_key,content_kind,lifecycle,revision,version_floor,builtin_version,builtin_name,updated_by) values('basic.pilfer','skill','draft',9,7,1,'Owner Pilfer metadata',$1)",
      [user],
    )
    before = {
      active: await active(database),
      saved: await saved(database),
      protected: await protectedState(database),
      acl: await acl(database),
      audits: (
        await database.query(
          'select * from app_private.character_support_action_change_audit order by id',
        )
      ).rows,
      pilfer: (
        await database.query(
          "select * from app_private.combat_content_records where content_key='basic.pilfer'",
        )
      ).rows,
    }
  })
}, 60000)
afterAll(async () => {
  await db?.close()
})

it('migrates only current Guard selections with version/audit provenance and leaves all historical data literal', async () => {
  const after = await active()
  expect(after[0]).toEqual({
    ...before.active[0],
    support_action_id: 'basic.recover',
    build_version: Number(before.active[0]!.build_version) + 1,
    updated_at: expect.any(Date),
  })
  expect(after.slice(1)).toEqual(before.active.slice(1))
  const slots = await saved()
  expect(slots).toEqual([
    { ...before.saved[0], support_action_id: 'basic.recover', updated_at: expect.any(Date) },
    before.saved[1],
    { ...before.saved[2], support_action_id: 'basic.recover', updated_at: expect.any(Date) },
    before.saved[3],
  ])
  expect(await protectedState()).toEqual(before.protected)
  expect(await acl()).toEqual(before.acl)
  expect(
    (
      await db.query(
        'select * from app_private.character_support_action_change_audit where request_fingerprint<>$1 order by id',
        ['migration:universal-support-actions:v1'],
      )
    ).rows,
  ).toEqual(before.audits)
  expect(
    (
      await db.query(
        "select * from app_private.combat_content_records where content_key='basic.pilfer'",
      )
    ).rows,
  ).toEqual(before.pilfer)
  expect(
    (
      await db.query(
        'select before_support_action_id,after_support_action_id,build_version_before,build_version_after from app_private.character_support_action_change_audit where request_fingerprint=$1',
        ['migration:universal-support-actions:v1'],
      )
    ).rows,
  ).toEqual([
    {
      before_support_action_id: 'basic.guard',
      after_support_action_id: 'basic.recover',
      build_version_before: 2,
      build_version_after: 3,
    },
  ])
  expect(
    (
      await db.query(
        'select character_id,slot_index,before_support_action_id,before_updated_at,source_build_version,replacement_support_action_id from app_private.character_support_loadout_retirement_audit order by character_id,slot_index',
      )
    ).rows,
  ).toEqual([
    {
      character_id: characters[0],
      slot_index: 1,
      before_support_action_id: 'basic.guard',
      before_updated_at: before.saved[0]!.updated_at,
      source_build_version: 2,
      replacement_support_action_id: 'basic.recover',
    },
    {
      character_id: characters[1],
      slot_index: 2,
      before_support_action_id: 'basic.guard',
      before_updated_at: before.saved[2]!.updated_at,
      source_build_version: 3,
      replacement_support_action_id: 'basic.recover',
    },
  ])
  const first = {
    active: after,
    saved: slots,
    protected: await protectedState(),
    audit: (
      await db.query('select * from app_private.character_support_action_change_audit order by id')
    ).rows,
  }
  await db.exec(sql())
  expect({
    active: await active(),
    saved: await saved(),
    protected: await protectedState(),
    audit: (
      await db.query('select * from app_private.character_support_action_change_audit order by id')
    ).rows,
  }).toEqual(first)
})

it('permits all five current Support values through save, saved-loadout activation and current snapshot readback', async () => {
  await db.exec('begin')
  try {
    for (const choice of choices) {
      const currentVersion = await version()
      const request = crypto.randomUUID()
      const changed = (await save(choice, currentVersion, request)).rows[0]!
      expect(Number(changed.build_version)).toBe(currentVersion + 1)
      expect((await save(choice, currentVersion, request)).rows[0]).toEqual({
        ...changed,
        replayed: true,
      })
      expect(
        (
          await db.query<{ value: { supportActionId: string } }>(
            'select public.get_character_committed_build_snapshot_v2($1,$2) value',
            [user, characters[0]],
          )
        ).rows[0]!.value.supportActionId,
      ).toBe(choice)
      await db.query(
        'select * from public.save_character_build_loadout_v1($1,$2,2::smallint,$3,$4,$5,$6)',
        [
          user,
          characters[0],
          'New Support',
          await version(),
          crypto.randomUUID(),
          `saved:${choice}`,
        ],
      )
      await save(choice === 'basic.recover' ? 'basic.recover.mp' : 'basic.recover', await version())
      await db.query(
        'select * from public.activate_character_build_loadout_v1($1,$2,2::smallint,$3,$4,$5)',
        [user, characters[0], await version(), crypto.randomUUID(), `activate:${choice}`],
      )
      expect(
        (
          await db.query<{ support_action_id: string }>(
            'select support_action_id from public.get_character_saved_build_loadouts_v2($1,$2) where slot_index=2',
            [user, characters[0]],
          )
        ).rows[0]!.support_action_id,
      ).toBe(choice)
      expect((await active())[0]!.support_action_id).toBe(choice)
    }
  } finally {
    await db.exec('rollback')
  }
})

it('retains exact historical Guard receipts but rejects fresh Guard, unknown choices and stale/foreign writes', async () => {
  await db.exec('begin')
  try {
    const state = await protectedState()
    expect(
      (await save('basic.guard', 1, legacyRequest, 'legacy:basic.guard')).rows[0],
    ).toMatchObject({ build_version: 2, replayed: true })
    await denied(() => save('basic.guard', 3), /SUPPORT_ACTION_INVALID/)
    await denied(() => save('invented', 3), /SUPPORT_ACTION_INVALID/)
    await denied(
      () =>
        db.query(
          "update app_private.character_active_builds set support_action_id='basic.guard' where character_id=$1",
          [characters[0]],
        ),
      /character_active_build_support_action_allowed/,
    )
    await denied(
      () =>
        db.query(
          "update app_private.character_saved_build_loadouts set support_action_id='basic.guard' where character_id=$1",
          [characters[0]],
        ),
      /character_saved_build_support_action_allowed/,
    )
    await denied(() => save('basic.pilfer', 2), /CHARACTER_BUILD_VERSION_CONFLICT/)
    await denied(
      () => save('basic.pilfer', 3, legacyRequest, 'legacy:basic.guard'),
      /IDEMPOTENCY_CONFLICT/,
    )
    await denied(
      () =>
        db.query('select * from public.save_character_support_action_v1($1,$2,3,$3,$4,$5)', [
          '00000000-0000-4000-8000-000000000099',
          characters[0],
          'basic.pilfer',
          crypto.randomUUID(),
          'foreign-request',
        ]),
      /CHARACTER_BUILD_NOT_FOUND/,
    )
    expect(await protectedState()).toEqual(state)
    for (const table of ['character_active_builds', 'character_saved_build_loadouts']) {
      const column = (
        await db.query<{ column_default: string }>(
          "select column_default from information_schema.columns where table_schema='app_private' and table_name=$1 and column_name='support_action_id'",
          [table],
        )
      ).rows[0]!
      expect(column.column_default).toBe("'basic.recover'::text")
    }
    expect(inspectMigrationSecurity(sql())).toEqual([])
    expect(
      (
        await db.query(
          "select relrowsecurity rls,has_table_privilege('authenticated',oid,'select,insert,update,delete') client,has_table_privilege('service_role',oid,'select') service from pg_class where oid='app_private.character_support_loadout_retirement_audit'::regclass",
        )
      ).rows,
    ).toEqual([{ rls: true, client: false, service: true }])
  } finally {
    await db.exec('rollback')
  }
})

it('registers editable current Basic identities while retiring only Guard metadata and preserving exact versions and draft pointers', async () => {
  const listed = (
    await db.query<{ result: { records: { contentKey: string }[] } }>(
      "select public.list_combat_content_records_v1($1,null,'basic',null,null,null,100) result",
      [user],
    )
  ).rows[0]!.result.records.map((row) => row.contentKey).sort()
  expect(listed).toEqual([
    'basic.fleetstep',
    'basic.invocation',
    'basic.move',
    'basic.pilfer',
    'basic.recover',
    'basic.recover.mp',
    'unarmed.basic',
  ])
  expect(
    (
      await db.query<{ result: { records: { contentKey: string }[] } }>(
        "select public.list_combat_content_records_v1($1,null,'basic','archived',null,null,100) result",
        [user],
      )
    ).rows[0]!.result.records.map((row) => row.contentKey),
  ).toEqual(['basic.guard'])
  const guard = (
    await db.query<{
      result: { lifecycle: string; current: unknown; draft: unknown; history: unknown[] }
    }>("select public.read_combat_content_record_v1($1,null,'basic.guard') result", [user])
  ).rows[0]!.result
  expect(guard).toMatchObject({
    lifecycle: 'archived',
    current: null,
    draft: { definition: { name: 'Retained Owner draft' } },
  })
  expect(guard.history).toHaveLength(1)
  await expect(
    db.query("select * from public.read_current_combat_content_v1('basic.guard','skill')"),
  ).rejects.toThrow(/COMBAT_CONTENT_ARCHIVED/)
  expect(
    (
      await db.query<{ catalogue: { archivedKeys: string[] } }>(
        'select public.read_combat_content_catalogue_v1() catalogue',
      )
    ).rows[0]!.catalogue.archivedKeys,
  ).toContain('basic.guard')
  expect(
    (
      await db.query<{ definition: { enabled: boolean } }>(
        "select * from public.read_combat_content_version_v1('basic.guard','skill',1)",
      )
    ).rows[0]!.definition.enabled,
  ).toBe(true)
  await db.exec('begin')
  try {
    for (const key of choices.slice(2)) {
      const initial = (
        await db.query<{
          result: {
            revision: number
            versionFloor: number
            builtin: { contentVersion: number; name: string }
          }
        }>('select public.read_combat_content_record_v1($1,null,$2) result', [user, key])
      ).rows[0]!.result
      const definition = defaultBasicSkills().find((row) => row.id === key)!
      expect(definition).toBeTruthy()
      expect(initial.builtin.contentVersion).toBe(definition.contentVersion)
      const committed = (
        await db.query<{
          result: { current: { contentVersion: number; definition: unknown }; draft: unknown }
        }>(
          'select public.commit_combat_content_record_v1($1,null,$2,$3,$4,public.read_combat_content_catalogue_token_v1(),$5) result',
          [user, key, initial.revision, definition, initial.versionFloor],
        )
      ).rows[0]!.result
      expect(committed.draft).toBeNull()
      expect(committed.current.definition).toEqual({
        ...definition,
        contentVersion: committed.current.contentVersion,
      })
      expect(
        (
          await db.query<{ definition: unknown }>(
            "select * from public.read_current_combat_content_v1($1,'skill')",
            [key],
          )
        ).rows[0]!.definition,
      ).toEqual(committed.current.definition)
      await denied(
        () =>
          db.query("select app_private.validate_content_record_identity_v1($1,'status',$2)", [
            key,
            { id: key, contentVersion: 1 },
          ]),
        /BASIC_KIND_INVALID/,
      )
    }
  } finally {
    await db.exec('rollback')
  }
})

it('registers Loot wording as metadata only and binds its reviewed publication to a real Pilfer commit', async () => {
  await db.exec('begin')
  try {
    const initial = (
      await db.query<{ result: { revision: number; versionFloor: number } | null }>(
        "select public.read_combat_content_record_v1($1,null,'tag.loot') result",
        [user],
      )
    ).rows[0]!.result
    expect(initial).not.toBeNull()
    const definition = defaultCombatTagDefinitions().find((row) => row.id === 'tag.loot')!
    expect(definition).toBeTruthy()
    const tag = (
      await db.query<{ result: { current: { contentVersion: number } } }>(
        "select public.commit_combat_content_record_v1($1,null,'tag.loot',$2,$3,public.read_combat_content_catalogue_token_v1(),$4) result",
        [user, initial!.revision, definition, initial!.versionFloor],
      )
    ).rows[0]!.result
    const current = (
      await db.query<{ result: { revision: number; versionFloor: number } }>(
        "select public.read_combat_content_record_v1($1,null,'basic.pilfer') result",
        [user],
      )
    ).rows[0]!.result
    const pilfer = (
      await db.query<{
        result: { current: { definition: { ability: { tagPresentation: unknown[] } } } }
      }>(
        "select public.commit_combat_content_record_v1($1,null,'basic.pilfer',$2,$3,public.read_combat_content_catalogue_token_v1(),$4) result",
        [
          user,
          current.revision,
          defaultBasicSkills().find((row) => row.id === 'basic.pilfer'),
          current.versionFloor,
        ],
      )
    ).rows[0]!.result
    expect(pilfer.current.definition.ability.tagPresentation).toContainEqual(
      expect.objectContaining({
        tagId: 'loot',
        contentVersion: tag.current.contentVersion,
        name: 'Loot',
      }),
    )
    await denied(
      () =>
        db.query("select public.write_combat_content_record_v1($1,null,'tag.unknown-loot', $2)", [
          user,
          {
            action: 'create',
            requestId: crypto.randomUUID(),
            contentKind: 'tag',
            definition: { ...definition, id: 'tag.unknown-loot', tagId: 'unknown-loot' },
          },
        ]),
      /CONTENT_TAG_ID_INVALID/,
    )
  } finally {
    await db.exec('rollback')
  }
})
