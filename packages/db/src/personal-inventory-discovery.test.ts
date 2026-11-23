import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '11111111-1111-4111-8111-111111111111'
const sibling = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const eventKey = 'event.fixture-fragments'
const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const initial = { version: 1, position, route: [], nextStepAt: null }
const first = itemFixture({
  id: 'fixture.fragment-one',
  name: 'First fragment',
  itemClass: 'general',
  inventoryCategory: 'general',
  equipment: null,
  qualityPoints: 0,
  maximumStack: 5,
})
const second = { ...first, id: 'fixture.fragment-two', name: 'Second fragment' }
const definition = {
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.fragments-fixture',
  contentVersion: 1,
  title: 'The fragment mystery',
  summary: 'Disposable hidden discovery.',
  internalNotes: 'Private fixture details.',
  family: 'lore-revelation',
  category: 'hidden-discoveries',
  scope: { type: 'global' },
  inventoryDiscovery: {
    firstItemId: first.id,
    secondItemId: second.id,
    clue: 'The two fragments fit together.',
  },
  phases: [
    {
      id: 'discovery',
      name: 'Discovery',
      objectives: [],
      effects: [],
      cleanupEffects: [],
      transition: { type: 'manual' },
    },
  ],
  rewardPackageRefs: [],
  aftermathRefs: [],
}

let db: PGlite
let runId: string
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  for (const id of [owner, other]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `${id}@example.test`,
    ])
  }
  for (const [id, userId, slot, name] of [
    [owner, owner, 0, 'First player'],
    [sibling, owner, 1, 'Sibling character'],
    [other, other, 0, 'Other player'],
  ] as const) {
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
        presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
        might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        values($1,$2,$3,1,$4,$5,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, userId, slot, name, name.toLowerCase()],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [owner],
  )
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([first, second]),
  ])
}, 60000)
afterAll(async () => db?.close())

const publish = (value: unknown) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,null,gen_random_uuid(),null,true)',
    [owner, eventKey, JSON.stringify(value)],
  )
beforeEach(async () => {
  await db.exec('begin')
  await publish(definition)
  runId = (
    await db.query<{ run_id: string }>(
      `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:discovery',
        clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour',null,true)`,
      [owner, eventKey],
    )
  ).rows[0]!.run_id
})
afterEach(async () => db.exec('rollback'))

async function start() {
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [owner, runId],
  )
}
const grant = (revision: number, itemIds: string[], userId = owner, characterId = userId) =>
  db.query('select public.grant_character_items_v1($1,$2,$3,$4,$5::jsonb)', [
    userId,
    characterId,
    revision,
    `fixture:grant:${revision}`,
    JSON.stringify(itemIds.map((itemId) => ({ itemId, quantity: 1 }))),
  ])
const read = async (userId = owner, characterId = userId) =>
  (
    await db.query<{ result: { personalQuests: unknown[]; eventObjectives: unknown[] } }>(
      'select public.read_world_state_v1($1,$2,$3) result',
      [userId, characterId, initial],
    )
  ).rows[0]!.result
const visible = {
  runId: expect.any(String),
  title: definition.title,
  body: definition.inventoryDiscovery.clue,
  discovery: true,
}
const attempts = async () =>
  (
    await db.query(
      'select user_id,character_id,run_id from app_private.event_personal_quest_attempts',
    )
  ).rows
const carried = async () =>
  (
    await db.query<{ id: string; item_id: string; quantity: number }>(
      'select id,item_id,quantity from app_private.character_item_stacks where character_id=$1 order by item_id',
      [owner],
    )
  ).rows
async function rejected(call: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected_discovery')
  await expect(call()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected_discovery; release savepoint rejected_discovery')
}
const discard = async (revision: number, stackId: string) => {
  const token = (
    await db.query<{ token: string }>(
      `select public.read_character_items_view_v1($1,$1)->>'catalogueToken' token`,
      [owner],
    )
  ).rows[0]!.token
  return db.query('select public.write_character_items_v1($1,$1,$2,$3,$4::jsonb)', [
    owner,
    revision,
    token,
    JSON.stringify({ action: 'discard', stackId }),
  ])
}

it('privately discovers pre-existing ownership once without consuming either fragment', async () => {
  await grant(0, [first.id])
  await grant(1, [second.id])
  expect((await read()).personalQuests).toEqual([])
  expect(await attempts()).toEqual([])
  await start()

  const before = await carried()
  const discovered = await read()
  expect(discovered.personalQuests).toEqual([visible])
  expect(discovered.eventObjectives).toEqual([])
  expect(await carried()).toEqual(before)
  expect((await read(owner, sibling)).personalQuests).toEqual([])
  expect((await read(other)).personalQuests).toEqual([])
  await rejected(() => read(other, owner), 'WORLD_NOT_OWNED')
  expect(await attempts()).toEqual([{ user_id: owner, character_id: owner, run_id: runId }])

  await discard(2, before[0]!.id)
  await db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 millisecond' where id=$1",
    [runId],
  )
  expect((await read()).personalQuests).toEqual([visible])
  expect((await carried()).map((stack) => stack.item_id)).toEqual([second.id])
  await grant(0, [first.id, second.id], other)
  expect((await read(other)).personalQuests).toEqual([])
  expect(await attempts()).toHaveLength(1)
})

it('requires two distinct carried identities and records the acquisition before a World read', async () => {
  await start()
  await grant(0, [first.id])
  await grant(1, [first.id])
  await grant(0, [second.id], owner, sibling)
  expect((await read()).personalQuests).toEqual([])
  expect(await attempts()).toEqual([])

  await grant(2, [second.id])
  expect(await attempts()).toEqual([{ user_id: owner, character_id: owner, run_id: runId }])
  expect((await read()).personalQuests).toEqual([visible])
  expect((await read(owner, sibling)).personalQuests).toEqual([])
  expect((await carried()).map(({ item_id, quantity }) => ({ item_id, quantity }))).toEqual([
    { item_id: first.id, quantity: 2 },
    { item_id: second.id, quantity: 1 },
  ])
})

it('records qualification when previously carried stock leaves after activation before a World read', async () => {
  await grant(0, [first.id, second.id])
  await start()
  expect(await attempts()).toEqual([])
  await discard(1, (await carried())[0]!.id)
  expect(await attempts()).toHaveLength(1)
  expect((await read()).personalQuests).toEqual([visible])
})

it('rejects duplicate identities and public or rewarded definitions at the publication boundary', async () => {
  const validate = (value: unknown) =>
    db.query('select app_private.assert_event_runtime_supported_v1($1::jsonb)', [
      JSON.stringify(value),
    ])
  await rejected(
    () =>
      validate({
        ...definition,
        inventoryDiscovery: { ...definition.inventoryDiscovery, secondItemId: first.id },
      }),
    'EVENT_INVENTORY_DISCOVERY_INVALID',
  )
  await rejected(
    () => validate({ ...definition, category: 'world-events' }),
    'EVENT_INVENTORY_DISCOVERY_INVALID',
  )
  await rejected(
    () => validate({ ...definition, rewardPackageRefs: ['reward.fixture'] }),
    'EVENT_INVENTORY_DISCOVERY_INVALID',
  )
})

it('reconciles a character again after staff resume and ignores inventory changes during pause', async () => {
  await start()
  await grant(0, [first.id])
  expect((await read()).personalQuests).toEqual([])
  const operate = (version: number, operation: string) =>
    db.query(
      'select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,null,true)',
      [owner, runId, version, operation],
    )
  await operate(2, 'pause')
  await grant(1, [second.id])
  expect(await attempts()).toEqual([])
  expect((await read()).personalQuests).toEqual([])
  await operate(3, 'resume')
  expect((await read()).personalQuests).toEqual([visible])
  expect((await read()).personalQuests).toEqual([visible])
  expect(await attempts()).toHaveLength(1)
})

it('reconciles again when the second fragment commits after the activation read', async () => {
  await grant(0, [first.id])
  await start()
  expect((await read()).personalQuests).toEqual([])

  // A single-connection fixture cannot hold the grant open across the read.
  // Suppressing this one trigger reproduces its already-run, pre-Start view.
  await db.exec(
    'alter table app_private.character_item_stacks disable trigger observe_personal_inventory_discovery_added_v1',
  )
  await grant(1, [second.id])
  await db.exec(
    'alter table app_private.character_item_stacks enable trigger observe_personal_inventory_discovery_added_v1',
  )
  expect(await attempts()).toEqual([])
  expect((await read()).personalQuests).toEqual([visible])
  expect((await read()).personalQuests).toEqual([visible])
  expect(await attempts()).toHaveLength(1)
})

it('evaluates a newly visible activation with the time of the revision read', async () => {
  await grant(0, [first.id, second.id])
  expect((await read()).personalQuests).toEqual([])
  const earlier = (
    await db.query<{ value: string }>("select (clock_timestamp()-interval '1 second')::text value")
  ).rows[0]!.value
  await start()
  const reconciled = (
    await db.query<{ quests: unknown[] }>(
      'select app_private.read_world_personal_quests_v1($1,$1,$2,$3) quests',
      [owner, position, earlier],
    )
  ).rows[0]!.quests
  expect(reconciled).toEqual([visible])
  expect((await read()).personalQuests).toEqual([visible])
  expect(await attempts()).toHaveLength(1)
})

it('makes forged accepts of undiscovered hidden runs indistinguishable from unknown run IDs', async () => {
  await start()
  expect((await read()).personalQuests).toEqual([])
  const accept = (id: string) =>
    db.query('select public.commit_world_personal_quest_v1($1,$1,1,gen_random_uuid(),$2,$3,$4)', [
      owner,
      id,
      'accept',
      'fixture:forged-accept',
    ])
  await rejected(
    () => accept('44444444-4444-4444-8444-444444444444'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await rejected(() => accept(runId), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect((await read()).personalQuests).toEqual([])
  expect(await attempts()).toEqual([])
})
