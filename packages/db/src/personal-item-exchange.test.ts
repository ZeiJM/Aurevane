import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'

const actor = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const eventKey = 'event.fixture-item-exchange'
const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const initial = { version: 1, position, route: [], nextStepAt: null }
const seed = itemFixture({
  id: 'fixture.emberseed',
  name: 'Emberseeds',
  inventoryCategory: 'materials',
  itemClass: 'material',
  equipment: null,
  qualityPoints: 0,
  maximumStack: 5,
})
const key = itemFixture({
  id: 'fixture.realm-key',
  name: 'Realm key',
  inventoryCategory: 'event',
  itemClass: 'event',
  equipment: null,
  qualityPoints: 0,
})
const filler = { ...key, id: 'fixture.inventory-filler' }
const futureInput = { ...filler, id: 'fixture.future-input' }
const journey = {
  type: 'item-exchange',
  giverId: 'eastern-watch-officer',
  inputItemId: seed.id,
  inputQuantity: 7,
  outputItemId: key.id,
  offer: 'The gate opens with this key.',
  active: 'Bring seven emberseeds.',
  ready: 'Hand over seven emberseeds for the key.',
  completed: 'Access to the sealed realm is yours.',
}
const definition = {
  schemaVersion: 1,
  eventKey,
  templateKey: 'template.item-exchange-fixture',
  contentVersion: 1,
  title: 'The sealed realm',
  summary: 'Disposable item exchange fixture.',
  internalNotes: '',
  family: 'narrative-event',
  category: 'story-campaigns',
  scope: { type: 'region', key: 'verdant-expanse' },
  personalJourney: journey,
  phases: [
    {
      id: 'quest',
      name: 'Quest',
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
  for (const [id, index, name] of [
    [actor, 0, 'First player'],
    [other, 1, 'Second player'],
  ]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      id,
      `fixture-${index}@example.test`,
    ])
    await db.query(
      `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,
        presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,
        might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
        values($1,$1,0,1,$2,$3,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
      [id, name, `fixture-player-${index}`],
    )
  }
  await db.query(
    "insert into app_private.master_panel_role_assignments(user_id,role) values($1,'game-owner')",
    [actor],
  )
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([seed, key, filler, futureInput]),
  ])
}, 60000)
afterAll(async () => db?.close())

const publish = (payload: unknown) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,null,gen_random_uuid(),null,true)',
    [actor, eventKey, payload],
  )

beforeEach(async () => {
  await db.exec('begin')
  await publish(definition)
  runId = (
    await db.query<{ run_id: string }>(
      `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:exchange',
        clock_timestamp()+interval '1 minute',clock_timestamp()+interval '1 hour',null,true)`,
      [actor, eventKey],
    )
  ).rows[0]!.run_id
  await db.query(
    "update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id=$1",
    [runId],
  )
  await db.query(
    "select * from public.operate_event_run_v2($1,null::uuid,$2,1,gen_random_uuid(),'start',null,true)",
    [actor, runId],
  )
})
afterEach(async () => db.exec('rollback'))

const read = async (id = actor) =>
  (
    await db.query<{ result: { personalQuests: unknown[] } }>(
      'select public.read_world_state_v1($1,$1,$2) result',
      [id, initial],
    )
  ).rows[0]!.result.personalQuests
const action = (version: number, kind: string, commandId: string | null = null, id = actor) =>
  db.query(
    'select public.commit_world_personal_quest_v1($1,$1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6)',
    [id, version, commandId, runId, kind, `fixture:${kind}`],
  )
const grant = (revision: number, grantKey: string, items: { itemId: string; quantity: number }[]) =>
  db.query('select public.grant_character_items_v1($1,$1,$2,$3,$4::jsonb)', [
    actor,
    revision,
    grantKey,
    JSON.stringify(items),
  ])
const owned = async () =>
  (
    await db.query<{ item_id: string; quantity: number }>(
      `select item_id, sum(quantity)::int quantity from app_private.character_item_stacks
        where character_id=$1 and item_id in ($2,$3) group by item_id order by item_id`,
      [actor, seed.id, key.id],
    )
  ).rows
const access = async (id = actor) =>
  (
    await db.query<{ value: boolean }>(
      'select app_private.has_personal_exchange_access_v1($1,$1,$2) value',
      [id, eventKey],
    )
  ).rows[0]!.value

type RecoveryView = {
  catalogueToken: string
  discardableStackIds: string[]
  snapshot: { revision: number; stacks: { id: string; itemId: string; slotIndex: number }[] }
}
const inventory = async (id = actor) =>
  (
    await db.query<{ value: RecoveryView }>(
      'select public.read_character_items_view_v1($1,$1) value',
      [id],
    )
  ).rows[0]!.value
const discard = (view: RecoveryView, stackId: string, id = actor) =>
  db.query('select public.write_character_items_v1($1,$1,$2,$3,$4)', [
    id,
    view.snapshot.revision,
    view.catalogueToken,
    { action: 'discard', stackId },
  ])

const eventDashboard = (userId: string) =>
  db.query<{ value: { personalRewards: unknown[]; personalRewardsPendingCount: number } }>(
    'select public.read_event_operation_dashboard_v1($1,null::uuid,$2) value',
    [userId, runId],
  )

async function rejected(call: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected_exchange')
  await expect(call()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected_exchange; release savepoint rejected_exchange')
}

it('protects an exchange input as soon as its definition is published', async () => {
  const futureKey = 'event.fixture-future-exchange'
  await grant(0, 'fixture:future-input', [{ itemId: futureInput.id, quantity: 1 }])
  const before = await inventory()
  const stack = before.snapshot.stacks.find((row) => row.itemId === futureInput.id)!
  expect(before.discardableStackIds).toContain(stack.id)
  await db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,null,gen_random_uuid(),null,true)',
    [
      actor,
      futureKey,
      {
        ...definition,
        eventKey: futureKey,
        personalJourney: { ...journey, inputItemId: futureInput.id, inputQuantity: 1 },
      },
    ],
  )
  expect(
    (await db.query('select id from app_private.event_runs where event_key=$1', [futureKey])).rows,
  ).toEqual([])
  const after = await inventory()
  expect(after.discardableStackIds).not.toContain(stack.id)
  await rejected(() => discard(after, stack.id), 'ITEM_DISCARD_PROTECTED')
})

it('consumes seven previously carried seeds once across two tabs and records a private key and access', async () => {
  await grant(0, 'fixture:seeds-before-acceptance', [{ itemId: seed.id, quantity: 14 }])
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'available', action: 'accept' }),
  ])
  await rejected(() => action(1, 'hand-over'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await action(1, 'accept')
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'ready', action: 'hand-over', inputOwned: 14 }),
  ])
  expect(await read(other)).toEqual([
    expect.objectContaining({ progress: 'available', action: 'accept', inputOwned: 0 }),
  ])
  const first = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  await action(2, 'hand-over', first)
  await action(2, 'hand-over', first)
  await rejected(() => action(2, 'hand-over', second), 'WORLD_STALE_VERSION')
  await rejected(() => action(3, 'hand-over', second), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect(await owned()).toEqual([
    { item_id: seed.id, quantity: 7 },
    { item_id: key.id, quantity: 1 },
  ])
  expect(await access()).toBe(true)
  expect(await access(other)).toBe(false)
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'completed', action: null, accessGranted: true }),
  ])
})

it('keeps an earned key claim after the occurrence expires when the reward category was full', async () => {
  await grant(0, 'fixture:full-inventory', [
    { itemId: seed.id, quantity: 7 },
    { itemId: filler.id, quantity: 40 },
  ])
  await read()
  await action(1, 'accept')
  await action(2, 'hand-over')
  expect(await access()).toBe(true)
  expect(await owned()).toEqual([])
  const pendingRewards = (await eventDashboard(actor)).rows[0]!.value
  expect(pendingRewards.personalRewardsPendingCount).toBe(1)
  expect(pendingRewards.personalRewards).toEqual([
    expect.objectContaining({
      characterId: actor,
      itemName: 'Realm key',
      itemClaimPending: true,
      awardedXp: 0,
    }),
  ])
  await rejected(() => eventDashboard(other), 'EVENT_STAFF_REQUIRED')
  await db.exec('savepoint orphaned_reward')
  await db.query(
    'update app_private.event_personal_quest_attempts set character_id=gen_random_uuid() where run_id=$1',
    [runId],
  )
  const orphaned = (await eventDashboard(actor)).rows[0]!.value
  expect(orphaned.personalRewards).toEqual([])
  expect(orphaned.personalRewardsPendingCount).toBe(0)
  await db.exec('rollback to savepoint orphaned_reward; release savepoint orphaned_reward')
  const disableKey = () =>
    db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([{ ...key, contentVersion: 3, enabled: false }]),
    ])
  await rejected(disableKey, 'ITEM_PENDING_EVENT_EXCHANGE')
  await rejected(async () => {
    const version = (
      await db.query<{ id: string }>(
        `insert into app_private.combat_content_versions(content_key,content_kind,content_version,definition,published_by)
          values($1,'item',3,$2,$3) returning id`,
        [key.id, { ...key, contentVersion: 3, enabled: false }, actor],
      )
    ).rows[0]!.id
    return db.query(
      `insert into app_private.combat_content_publications(content_key,content_kind,version_id,updated_by)
        values($1,'item',$2,$3)`,
      [key.id, version, actor],
    )
  }, 'ITEM_PENDING_EVENT_EXCHANGE')
  await rejected(
    () =>
      db.query(
        `select public.write_combat_content_record_v1($1,null,$2,
          jsonb_build_object('action','archive','expectedRevision',
            (select revision from app_private.combat_content_records where content_key=$2)))`,
        [actor, key.id],
      ),
    'ITEM_PENDING_EVENT_EXCHANGE',
  )
  await db.query(
    'update app_private.event_runs set scheduled_end_at=clock_timestamp() where id=$1',
    [runId],
  )
  expect(await read()).toEqual([
    expect.objectContaining({
      progress: 'completed',
      action: 'claim-exchange',
      accessGranted: true,
    }),
  ])
  await rejected(() => action(3, 'claim-exchange'), 'ITEM_CAPACITY')
  const fullInventory = await inventory()
  const fillerStack = fullInventory.snapshot.stacks.find(
    (stack) => stack.itemId === filler.id && stack.slotIndex === 0,
  )!
  expect(fullInventory.discardableStackIds).toContain(fillerStack.id)
  const otherInventory = await inventory(other)
  await rejected(() => discard(otherInventory, fillerStack.id, other), 'ITEM_DISCARD_PROTECTED')
  await discard(fullInventory, fillerStack.id)
  const recovered = await inventory()
  expect(recovered.snapshot.revision).toBe(fullInventory.snapshot.revision + 1)
  expect(recovered.snapshot.stacks.map((stack) => stack.id)).toEqual(
    fullInventory.snapshot.stacks
      .filter((stack) => stack.id !== fillerStack.id)
      .map((stack) => stack.id),
  )
  await rejected(() => discard(fullInventory, fillerStack.id), 'ITEM_STALE_')
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([{ ...key, contentVersion: 2, name: 'Realm Key' }]),
  ])
  await action(3, 'claim-exchange')
  const claimed = await inventory()
  const claimedKey = claimed.snapshot.stacks.find((stack) => stack.itemId === key.id)!
  expect(claimed.discardableStackIds).not.toContain(claimedKey.id)
  await rejected(() => discard(claimed, claimedKey.id), 'ITEM_DISCARD_PROTECTED')

  const delivered = (await eventDashboard(actor)).rows[0]!.value
  expect(delivered.personalRewardsPendingCount).toBe(0)
  expect(delivered.personalRewards).toEqual([
    expect.objectContaining({
      characterId: actor,
      itemName: 'Realm key',
      itemClaimPending: false,
    }),
  ])
  expect(
    (
      await db.query(
        'select acquired_content_version from app_private.character_item_stacks where character_id=$1 and item_id=$2',
        [actor, key.id],
      )
    ).rows,
  ).toEqual([{ acquired_content_version: 2 }])
  await rejected(() => action(4, 'claim-exchange'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await expect(disableKey()).resolves.toBeDefined()
  expect(await owned()).toEqual([{ item_id: key.id, quantity: 1 }])
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'completed', action: null, accessGranted: true }),
  ])
})

it('keeps the accepted attempt and stock intact when the current inventory is short', async () => {
  await grant(0, 'fixture:short', [{ itemId: seed.id, quantity: 6 }])
  await read()
  await action(1, 'accept')
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'active', action: null, inputOwned: 6 }),
  ])
  await rejected(() => action(2, 'hand-over'), 'WORLD_QUEST_ITEMS_MISSING')
  expect(await owned()).toEqual([{ item_id: seed.id, quantity: 6 }])
  expect(await access()).toBe(false)
})

it('enforces catalogue approval and keeps settlement and access helpers private', async () => {
  await rejected(
    () =>
      db.query('select app_private.assert_event_runtime_supported_v1($1::jsonb)', [
        { ...definition, personalJourney: { ...journey, outputItemId: 'fixture.unapproved' } },
      ]),
    'EVENT_PERSONAL_EXCHANGE_ITEMS_UNAVAILABLE',
  )
  expect(
    (
      await db.query(
        `select
          has_function_privilege('authenticated','public.commit_world_personal_quest_v1(uuid,uuid,bigint,uuid,uuid,text,text)','execute') as browser_settle,
          has_function_privilege('authenticated','app_private.has_personal_exchange_access_v1(uuid,uuid,text)','execute') as browser_access,
          has_function_privilege('service_role','app_private.settle_personal_item_exchange_v1(app_private.event_personal_quest_attempts,jsonb,boolean,timestamptz)','execute') as bypass_world`,
      )
    ).rows,
  ).toEqual([{ browser_settle: false, browser_access: false, bypass_world: false }])
})

it('rejects hand-ins from a different tile and while the original occurrence is closed', async () => {
  await grant(0, 'fixture:range', [{ itemId: seed.id, quantity: 7 }])
  await read()
  await action(1, 'accept')
  await db.query(
    "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','3') where character_id=$1",
    [actor],
  )
  await rejected(() => action(2, 'hand-over'), 'WORLD_QUEST_OUT_OF_RANGE')
  await db.query(
    "update app_private.character_world_state set state=jsonb_set(state,'{position,x}','2') where character_id=$1",
    [actor],
  )
  await db.query(
    'update app_private.event_runs set scheduled_end_at=clock_timestamp() where id=$1',
    [runId],
  )
  await rejected(() => action(2, 'hand-over'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect(await owned()).toEqual([{ item_id: seed.id, quantity: 7 }])
  expect(await access()).toBe(false)
})
