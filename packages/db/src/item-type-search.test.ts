import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { defaultBasicSkills } from '../../game-core/src/combat/combat-basic-actions'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import type { RuntimeItemDefinition } from '../../game-core/src/content/items'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '00000000-0000-4000-8000-000000008001'
const other = '00000000-0000-4000-8000-000000008002'
const ability = defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability!
const fixtures = [
  itemFixture({
    id: 'type.a',
    name: 'Aster',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 2 },
    ability,
    actions: { attack: { behaviorId: ability.behaviors[0]!.id, name: 'Strike' } },
  }),
  itemFixture({
    id: 'type.b',
    name: 'Bell',
    itemClass: 'hand-armor',
    equipment: { slot: 'hand', hands: 1 },
  }),
  itemFixture({
    id: 'type.c',
    name: 'Clover',
    itemClass: 'battle-item',
    inventoryCategory: 'battle-items',
    equipment: { slot: 'hand', hands: 1 },
    maximumStack: 99,
    ability,
    actions: { use: { behaviorId: ability.behaviors[0]!.id, name: 'Drink' } },
    battleUses: 2,
  }),
  itemFixture({ id: 'type.d', name: 'Dusk' }),
  itemFixture({ id: 'type.e', name: 'Elm', equipment: { slot: 'body', hands: 1 } }),
  itemFixture({ id: 'type.f', name: 'Frost', equipment: { slot: 'boots', hands: 1 } }),
  itemFixture({ id: 'type.g', name: 'Grove', equipment: { slot: 'pants', hands: 1 } }),
  ...(['material', 'general', 'event', 'companion'] as const).map((itemClass, index) =>
    itemFixture({
      id: ['type.h', 'type.i', 'type.j', 'type.k'][index]!,
      name: ['Haze', 'Ink', 'Jade', 'Kestrel'][index]!,
      itemClass,
      inventoryCategory: itemClass === 'material' ? 'materials' : itemClass,
      equipment: null,
      maximumStack: 99,
      qualityPoints: 0,
    }),
  ),
]
interface ListResult {
  records: {
    contentKey: string
    contentKind: string
    name: string
    lifecycle: string
    revision: number
  }[]
  nextCursor: string | null
}
let db: PGlite
const seed = (items: RuntimeItemDefinition[]) =>
  db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [JSON.stringify(items)])
async function list(
  search: string | null,
  after: string | null = null,
  limit = 100,
  kind: string | null = 'item',
  lifecycle: string | null = null,
  actor = owner,
) {
  return (
    await db.query<{ value: ListResult }>(
      'select public.list_combat_content_records_v1($1,null,$2,$3,$4,$5,$6) value',
      [actor, kind, lifecycle, search, after, limit],
    )
  ).rows[0]!.value
}
const keys = (result: ListResult) => result.records.map((row) => row.contentKey)
async function save(item: RuntimeItemDefinition) {
  const record = (
    await db.query<{ value: { revision: number } }>(
      'select public.read_combat_content_record_v1($1,null,$2) value',
      [owner, item.id],
    )
  ).rows[0]!.value
  return (
    await db.query<{
      value: { revision: number; draft: { draftVersion: number; baseVersion: number | null } }
    }>('select public.write_combat_content_record_v1($1,null,$2,$3::jsonb) value', [
      owner,
      item.id,
      JSON.stringify({ action: 'save', expectedRevision: record.revision, definition: item }),
    ])
  ).rows[0]!.value
}
async function publish(item: RuntimeItemDefinition) {
  const draft = await save(item)
  const token = (
    await db.query<{ token: string }>(
      "select public.read_combat_content_catalogue_v1()->>'token' token",
    )
  ).rows[0]!.token
  await db.query('select public.publish_saved_combat_content_v1($1,null,$2,$3,$4,$5,1)', [
    owner,
    item.id,
    draft.draft.draftVersion,
    draft.draft.baseVersion,
    token,
  ])
}
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
    ('${owner}','type-owner@example.test',now()),('${other}','type-other@example.test',now());
    insert into app_private.master_panel_role_assignments(user_id,role) values('${owner}','game-owner');`)
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
  await seed(fixtures)
})
afterEach(async () => {
  await db.exec('rollback')
})

it.each([
  ['weapon', ['type.a']],
  ['armor', ['type.b', 'type.d', 'type.e', 'type.f', 'type.g']],
  ['hand-armor', ['type.b']],
  ['hand armor', ['type.b']],
  ['gloves', ['type.b']],
  ['gear', ['type.a', 'type.b', 'type.d', 'type.e', 'type.f', 'type.g']],
  ['battle-item', ['type.c']],
  ['battle items', ['type.c']],
  ['consumable', ['type.c']],
  ['consumables', ['type.c']],
  ['consumable 1', ['type.c']],
  ['consumable 2', ['type.c']],
  ['materials', ['type.h']],
  ['general', ['type.i']],
  ['event', ['type.j']],
  ['companion', ['type.k']],
  ['head', ['type.d']],
  ['body', ['type.e']],
  ['pants', ['type.g']],
  ['boots', ['type.f']],
  ['main hand', ['type.a']],
  ['main-hand', ['type.a']],
  ['off hand', ['type.b']],
  ['off-hand', ['type.b']],
  [' \tWeApOn\n ', ['type.a']],
] as const)(
  'finds source Items by %s without name or identity matches',
  async (search, expected) => {
    expect(keys(await list(search))).toEqual(expected)
  },
)

it('retains name/identity substring matches and the metadata-only response', async () => {
  expect(keys(await list('ASte'))).toEqual(['type.a'])
  const result = await list('type.b')
  expect(result.records).toEqual([
    { contentKey: 'type.b', contentKind: 'item', lifecycle: 'active', revision: 1, name: 'Bell' },
  ])
  expect(keys(await list(' \tBell\n '))).toEqual(['type.b'])
  expect(await list('unmatched-type')).toEqual({ records: [], nextCursor: null })
  expect(keys(await list('shield'))).toEqual([])
  expect(keys(await list(null))).toHaveLength(11)
  expect(keys(await list(' \t\n '))).toHaveLength(11)
})

it('uses the latest source version without searching superseded source slots', async () => {
  await seed([
    {
      ...fixtures[3]!,
      contentVersion: 2,
      name: 'New Dusk',
      equipment: { slot: 'boots', hands: 1 },
    },
  ])
  expect(keys(await list('head'))).toEqual([])
  expect(keys(await list('boots'))).toEqual(['type.d', 'type.f'])
  expect((await list('New Dusk')).records[0]?.name).toBe('New Dusk')
})

it('prefers published metadata to newer source metadata and draft metadata to both', async () => {
  const original = fixtures[3]!
  await publish({ ...original, name: 'Published Dusk', equipment: { slot: 'body', hands: 1 } })
  await seed([
    { ...original, contentVersion: 3, name: 'Source Dusk', equipment: { slot: 'pants', hands: 1 } },
  ])
  expect(keys(await list('head'))).toEqual([])
  expect(keys(await list('body'))).toEqual(['type.d', 'type.e'])
  expect(keys(await list('pants'))).toEqual(['type.g'])
  expect((await list('Published Dusk')).records[0]?.name).toBe('Published Dusk')
  await save({ ...original, name: 'Draft Dusk', equipment: { slot: 'boots', hands: 1 } })
  expect(keys(await list('body'))).toEqual(['type.e'])
  expect(keys(await list('boots'))).toEqual(['type.d', 'type.f'])
  expect(keys(await list('Published Dusk'))).toEqual([])
  expect((await list('Draft Dusk')).records[0]?.name).toBe('Draft Dusk')
})

it.each(['key-asc', 'key-desc', 'name-asc', 'name-desc'])(
  'filters type matches before every bounded %s cursor page',
  async (sort) => {
    // Deliberately give two matching records the same name and put nonmatches between them.
    await save({ ...fixtures[6]!, name: 'Bell' })
    const expected =
      sort === 'key-desc'
        ? ['type.g', 'type.f', 'type.e', 'type.d', 'type.b']
        : sort === 'name-desc'
          ? ['type.f', 'type.e', 'type.d', 'type.b', 'type.g']
          : sort === 'name-asc'
            ? ['type.b', 'type.g', 'type.d', 'type.e', 'type.f']
            : ['type.b', 'type.d', 'type.e', 'type.f', 'type.g']
    const found: string[] = []
    let selector = JSON.stringify({ sort })
    for (let page = 0; page < 4; page++) {
      const result = await list('armor', selector, 2)
      found.push(...keys(result))
      if (!result.nextCursor) break
      selector = JSON.stringify({ sort, after: JSON.parse(result.nextCursor) })
    }
    expect(found).toEqual(expected)
    expect(keys(await list('armor', 'type.d', 2))).toEqual(['type.e', 'type.f'])
  },
)

it('searches archived and disabled Items without invoking the runtime availability guard', async () => {
  await seed([{ ...fixtures[5]!, contentVersion: 2, enabled: false }])
  await db.query("select public.write_combat_content_record_v1($1,null,'type.d',$2::jsonb)", [
    owner,
    JSON.stringify({ action: 'archive', expectedRevision: 1 }),
  ])
  expect(keys(await list('head', null, 100, 'item', 'archived'))).toEqual(['type.d'])
  expect(keys(await list('head', null, 100, 'item', 'active'))).toEqual([])
  expect(keys(await list('boots', null, 100, 'item', 'active'))).toEqual(['type.f'])
})

it('keeps all-kind Item matching while preserving unrelated-kind names and Basic partitions', async () => {
  expect(keys(await list('gloves', null, 100, null))).toEqual(['type.b'])
  expect(keys(await list('armor', null, 100, 'skill'))).toEqual([])
  expect(keys(await list('Arc Bolt', null, 100, 'skill'))).toContain('aetherist.arc-bolt')
  const basics = keys(await list(null, null, 100, 'basic'))
  expect(basics).toContain('basic.pilfer')
  expect(basics).not.toContain('basic.guard')
  expect(keys(await list(null, null, 100, 'discipline-skill'))).not.toContain('basic.pilfer')
})

it('retains operator authorization and service-only function execution', async () => {
  await db.exec('savepoint denied')
  await expect(list('weapon', null, 100, 'item', null, other)).rejects.toThrow()
  await db.exec('rollback to savepoint denied')
  const privileges = (
    await db.query<{ role: string; allowed: boolean }>(
      `select role,has_function_privilege(role,'public.list_combat_content_records_v1(uuid,uuid,text,text,text,text,integer)','execute') allowed
     from unnest(array['anon','authenticated','service_role']) role`,
    )
  ).rows
  expect(privileges).toEqual([
    { role: 'anon', allowed: false },
    { role: 'authenticated', allowed: false },
    { role: 'service_role', allowed: true },
  ])
})
