import { afterAll, beforeAll, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { starterItemDefinitions } from '../../game-core/src/content/starter-items'

const owner = '00000000-0000-4000-8000-000000000001'
let db: PGlite
let beforeMigration: unknown
let afterMigration: unknown
async function persistedBodies(database: PGlite) {
  const tables = [
    'runtime_item_source_definitions',
    'combat_content_records',
    'combat_content_versions',
    'combat_content_drafts',
    'combat_content_publications',
  ]
  return Promise.all(
    tables.map(
      async (table) =>
        (
          await database.query(
            `select to_jsonb(t) body from app_private.${table} t order by to_jsonb(t)::text`,
          )
        ).rows,
    ),
  )
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase(async (database, name) => {
    if (name !== '20261106143000_item_technique_descriptions.sql') return
    await database.exec(
      `insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()); insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');`,
    )
    const initial = weapon()
    const binding = { ...initial.actions!.support! }
    delete binding.description
    const source8 = {
      ...initial,
      contentVersion: 8,
      actions: { ...initial.actions, support: binding },
    }
    await database.query('select public.seed_runtime_item_sources_v1($1)', [
      JSON.stringify([source8]),
    ])
    const key = 'test.preserved-master-purpose'
    const definition = { ...source8, id: key }
    const saved = (
      await database.query<{
        value: { revision: number; draft: { draftVersion: number; baseVersion: number | null } }
      }>('select public.write_combat_content_record_v1($1,null,$2,$3) value', [
        owner,
        key,
        { action: 'create', requestId: crypto.randomUUID(), contentKind: 'item', definition },
      ])
    ).rows[0]!.value
    const token = (
      await database.query<{ token: string }>(
        "select public.read_combat_content_catalogue_v1()->>'token' token",
      )
    ).rows[0]!.token
    const published = (
      await database.query<{ value: { revision: number } }>(
        'select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,null) value',
        [owner, key, saved.draft.draftVersion, saved.draft.baseVersion, token],
      )
    ).rows[0]!.value
    await database.query('select public.write_combat_content_record_v1($1,null,$2,$3)', [
      owner,
      key,
      {
        action: 'save',
        expectedRevision: published.revision,
        definition: { ...definition, name: 'Preserved Owner draft' },
      },
    ])
    beforeMigration = await persistedBodies(database)
  })
  afterMigration = await persistedBodies(db)
}, 60000)
afterAll(async () => {
  await db?.close()
})
const weapon = () =>
  structuredClone(starterItemDefinitions().find((item) => item.id === 'stormcaller-staff')!)
function withDescription(description: unknown, role = 'support') {
  const item = weapon()
  return {
    ...item,
    actions: {
      ...item.actions,
      [role]: { ...item.actions![role as 'support' | 'attack'], description },
    },
  }
}
async function seed(item: unknown) {
  return db.query('select public.seed_runtime_item_sources_v1($1)', [JSON.stringify([item])])
}

it('admits weapon purpose text through real source authority and preserves exact historical source bodies', async () => {
  const initial = weapon()
  const binding = { ...initial.actions!.support! }
  delete binding.description
  const historical = {
    ...initial,
    contentVersion: 8,
    actions: { ...initial.actions, support: binding },
  }
  await seed(historical)
  const current = {
    ...withDescription('Gain a protective Barrier.'),
    contentVersion: 10,
  }
  await seed(current)
  const result = await db.query<{
    version: number
    definition: { actions: { support: { description?: string } } }
  }>(
    'select content_version version,definition from app_private.runtime_item_source_definitions where item_id=$1 order by content_version',
    [historical.id],
  )
  expect(
    result.rows.map((row) => [row.version, row.definition.actions.support.description]),
  ).toEqual([
    [historical.contentVersion, undefined],
    [current.contentVersion, 'Gain a protective Barrier.'],
  ])
  await expect(
    seed({
      ...current,
      actions: {
        ...current.actions,
        support: { ...current.actions.support, description: 'Changed same-version purpose.' },
      },
    }),
  ).rejects.toThrow('ITEM_SOURCE_CONFLICT')
})

it('rejects malformed, unbounded, untrimmed, control and wrongly scoped purpose fields at SQL authority', async () => {
  for (const description of [
    null,
    42,
    {},
    '',
    ' ',
    ' leading',
    'trailing ',
    '\u00a0leading',
    'trailing\ufeff',
    'line\nbreak',
    'tab\tbreak',
    'delete\u007f',
    'x'.repeat(401),
    '😀'.repeat(401),
  ])
    await expect(seed(withDescription(description))).rejects.toThrow('ITEM_DESCRIPTION_INVALID')
  await expect(seed(withDescription('Attack.', 'attack'))).rejects.toThrow(
    'ITEM_DESCRIPTION_INVALID',
  )
  const item = weapon()
  await expect(
    seed({
      ...item,
      itemClass: 'hand-armor',
      actions: { support: { ...item.actions!.support, description: 'Ward.' } },
      ability: {
        ...item.ability,
        behaviors: item.ability!.behaviors.filter(
          (row) => row.id === item.actions!.support!.behaviorId,
        ),
      },
    }),
  ).rejects.toThrow('ITEM_DESCRIPTION_INVALID')
  await expect(
    seed({
      ...withDescription('Ward.'),
      actions: {
        ...item.actions,
        support: { ...item.actions!.support, description: 'Ward.', extra: true },
      },
    }),
  ).rejects.toThrow('ITEM_BINDING_INVALID')
})

it('counts Unicode code points consistently and keeps private validation unavailable to browser and service roles', async () => {
  await seed({ ...withDescription('😀'.repeat(400)), id: 'test.unicode-purpose' })
  const acl = await db.query<{ browser: boolean; service: boolean }>(
    "select has_function_privilege('authenticated','app_private.assert_item_technique_description_shape_v1(jsonb)','execute') browser,has_function_privilege('service_role','app_private.assert_item_technique_description_shape_v1(jsonb)','execute') service",
  )
  expect(acl.rows[0]).toEqual({ browser: false, service: false })
})

it('saves and commits purpose through ordinary Master authority while exact publication history remains absent', async () => {
  const initial = weapon()
  const binding = { ...initial.actions!.support! }
  delete binding.description
  const key = 'test.master-technique-purpose'
  const historical = {
    ...initial,
    id: key,
    contentVersion: 1,
    actions: { ...initial.actions, support: binding },
  }
  type Saved = {
    revision: number
    draft: { draftVersion: number; baseVersion: number | null }
    current: { contentVersion: number }
  }
  const write = async (command: Record<string, unknown>) =>
    (
      await db.query<{ value: Saved }>(
        'select public.write_combat_content_record_v1($1,null,$2,$3) value',
        [owner, key, command],
      )
    ).rows[0]!.value
  const publish = async (record: Saved) => {
    const token = (
      await db.query<{ token: string }>(
        "select public.read_combat_content_catalogue_v1()->>'token' token",
      )
    ).rows[0]!.token
    return (
      await db.query<{ value: Saved }>(
        'select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,null) value',
        [owner, key, record.draft.draftVersion, record.draft.baseVersion, token],
      )
    ).rows[0]!.value
  }
  let saved = await publish(
    await write({
      action: 'create',
      requestId: crypto.randomUUID(),
      contentKind: 'item',
      definition: historical,
    }),
  )
  const firstVersion = saved.current.contentVersion
  const current = {
    ...historical,
    actions: {
      ...historical.actions,
      support: { ...binding, description: 'An authored protective ward.' },
    },
  }
  await expect(
    write({
      action: 'save',
      expectedRevision: saved.revision,
      definition: {
        ...current,
        actions: {
          ...current.actions,
          support: { ...current.actions.support, description: ' invalid' },
        },
      },
    }),
  ).rejects.toThrow('ITEM_DESCRIPTION_INVALID')
  saved = await publish(
    await write({ action: 'save', expectedRevision: saved.revision, definition: current }),
  )
  const exact = async (version: number) =>
    (
      await db.query<{ definition: typeof current }>(
        "select definition from public.read_combat_content_version_v1($1,'item',$2)",
        [key, version],
      )
    ).rows[0]!.definition
  expect((await exact(firstVersion)).actions.support).not.toHaveProperty('description')
  expect((await exact(saved.current.contentVersion)).actions.support.description).toBe(
    'An authored protective ward.',
  )
})

it('leaves existing source8, publication, version and Owner draft bodies unchanged when migration applies', () => {
  expect(beforeMigration).toBeDefined()
  expect(afterMigration).toEqual(beforeMigration)
})
