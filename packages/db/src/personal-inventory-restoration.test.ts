import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import type { ItemInventorySnapshot } from '../../game-core/src/character/item-inventory'
import { defaultBasicSkills } from '../../game-core/src/combat/combat-basic-actions'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'

const owner = '11111111-1111-4111-8111-111111111111'
const sibling = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const eventKey = 'event.fixture-restoration'
const giver = '77777777-7777-4777-8777-777777777777'
const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
const initial = { version: 1, position, route: [], nextStepAt: null }
const checkpoint = { ...position, x: 3 }
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
const swordAbility = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability!
const sword = itemFixture({
  id: 'fixture.restored-sword',
  name: 'Restored sword fixture',
  itemClass: 'weapon',
  equipment: { slot: 'hand', hands: 1 },
  ability: swordAbility,
  actions: { attack: { behaviorId: swordAbility.behaviors[0]!.id, name: 'Restored Cut' } },
})
const filler = itemFixture({ id: 'fixture.restore-filler' })
const capturedWeapon = { ...sword, id: 'fixture.captured-weapon' }
const publishedWeapon = { ...sword, id: 'fixture.published-weapon' }
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
    restoration: {
      giverNpcId: giver,
      checkpoint,
      outputItemId: sword.id,
      offer: 'Choose the recovery route to restore the blade.',
      travel: 'Follow the route and return with both fragments.',
      ready: 'Bring both fragments to the forge.',
      completed: 'The blade is restored.',
    },
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
  const draft = {
    name: 'Restoration smith',
    portraitRef: null,
    uses: ['world', 'story'],
    arena: null,
    world: { ...position, radius: 1, greeting: 'Welcome to the forge.' },
  }
  for (const [revision, action, value] of [
    [0, 'save', JSON.stringify(draft)],
    [1, 'commit-story', null],
    [2, 'commit-world', null],
  ] as const) {
    await db.query('select public.write_master_npc_design_v1($1,null,$2,$3,$4,$5::jsonb)', [
      owner,
      giver,
      revision,
      action,
      value,
    ])
  }
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([first, second, sword, filler, capturedWeapon, publishedWeapon]),
  ])
}, 60000)
afterAll(async () => db?.close())

const publish = <T extends { eventKey: string }>(value: T, base: number | null = null) =>
  db.query(
    'select * from public.publish_event_definition_v2($1,null::uuid,$2,$3::jsonb,$4,gen_random_uuid(),null,true)',
    [owner, value.eventKey, value, base],
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
    await db.query<{
      result: { state: unknown; personalQuests: unknown[]; eventObjectives: unknown[] }
    }>('select public.read_world_state_v1($1,$2,$3) result', [userId, characterId, initial])
  ).rows[0]!.result
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
type InventoryView = {
  battleLocked: boolean
  catalogueToken: string
  discardableStackIds: string[]
  snapshot: ItemInventorySnapshot
}
const inventory = async (characterId = owner) =>
  (
    await db.query<{ value: InventoryView }>(
      'select public.read_character_items_view_v1($1,$2) value',
      [owner, characterId],
    )
  ).rows[0]!.value
const discard = (view: InventoryView, stackId: string, userId = owner, characterId = owner) =>
  db.query<{ value: { state: InventoryView } }>(
    'select public.write_character_items_v1($1,$2,$3,$4,$5::jsonb) value',
    [
      userId,
      characterId,
      view.snapshot.revision,
      view.catalogueToken,
      { action: 'discard', stackId },
    ],
  )

const interact = (
  version: number,
  action: string,
  command: string | null = null,
  options: { actor?: string; run?: string; fingerprint?: string; characterId?: string } = {},
) => {
  const {
    actor = owner,
    run = runId,
    fingerprint = `fixture:${action}`,
    characterId = actor,
  } = options
  return db.query(
    'select public.commit_world_personal_quest_v1($1,$2,$3,coalesce($4,gen_random_uuid()),$5,$6,$7) state',
    [actor, characterId, version, command, run, action, fingerprint],
  )
}
const move = (version: number, kind: string, next: unknown) =>
  db.query('select public.commit_world_state_v1($1,$1,$2,gen_random_uuid(),$3,$4)', [
    owner,
    version,
    kind,
    next,
  ])
async function walk(version: number, from: typeof position, to: typeof position) {
  const time = (
    await db.query<{ time: number }>(
      'select floor(extract(epoch from clock_timestamp())*1000)::bigint time',
    )
  ).rows[0]!.time
  await move(version, 'walk', {
    ...initial,
    position: from,
    nextStepAt: time,
    route: [{ position: to, durationMs: 275 }],
  })
  await move(version + 1, 'tick', { ...initial, position: to })
}
const prepare = async () => {
  await start()
  await grant(0, [first.id, second.id])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'choose-restoration', local: true }),
  ])
}

it('requires chosen recovery and committed checkpoint arrival, spends the pair once, and equips the restored weapon', async () => {
  await prepare()
  await rejected(() => interact(1, 'restore-item'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await walk(1, position, checkpoint)
  await walk(3, checkpoint, position)
  await interact(5, 'choose-restoration')
  await rejected(() => interact(6, 'restore-item'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await walk(6, position, checkpoint)
  await rejected(() => interact(8, 'restore-item'), 'WORLD_QUEST_OUT_OF_RANGE')
  await walk(8, checkpoint, position)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'restore-item' }),
  ])

  const command = '88888888-8888-4888-8888-888888888888'
  const receipt = await interact(10, 'restore-item', command)
  expect((await interact(10, 'restore-item', command)).rows).toEqual(receipt.rows)
  await rejected(() => interact(10, 'restore-item'), 'WORLD_STALE_VERSION')
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'completed', action: null, itemClaimPending: false }),
  ])
  const item = (await carried())[0]!
  const token = (
    await db.query<{ token: string }>(
      `select public.read_character_items_view_v1($1,$1)->>'catalogueToken' token`,
      [owner],
    )
  ).rows[0]!.token
  await db.query('select public.write_character_items_v1($1,$1,2,$2,$3::jsonb)', [
    owner,
    token,
    JSON.stringify({
      action: 'equipment',
      equipment: { 'main-hand': item.id },
      selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
      replacePositions: [],
    }),
  ])
  const equipment = (
    await db.query<{ capture: { equipment: Array<{ item: { id: string } }> } }>(
      'select public.read_character_battle_equipment_v1($1,$1) capture',
      [owner],
    )
  ).rows[0]!.capture
  expect(equipment.equipment).toEqual([
    expect.objectContaining({
      item: expect.objectContaining({ id: sword.id, actions: sword.actions }),
    }),
  ])

  // A later World command must not erase the restoration receipt or let a
  // retry rewind movement. Different intent may not reuse the command ID.
  await walk(11, position, checkpoint)
  expect((await interact(10, 'restore-item', command)).rows).toEqual([
    { state: (await read()).state },
  ])
  for (const retry of [
    () => interact(11, 'restore-item', command),
    () => interact(10, 'choose-restoration', command, { fingerprint: 'fixture:restore-item' }),
    () => interact(10, 'restore-item', command, { run: giver }),
    () => interact(10, 'restore-item', command, { fingerprint: 'tampered' }),
    () => interact(10, 'report', command, { fingerprint: 'fixture:restore-item' }),
  ])
    await rejected(retry, 'WORLD_COMMAND_CONFLICT')
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
})

it('recovers a full-Gear restoration claim through a protected, explicit inventory discard', async () => {
  await prepare()
  const otherKey = 'event.fixture-other-restoration'
  const weaponDefinition = (outputItemId: string, contentVersion: number) => ({
    ...definition,
    eventKey: otherKey,
    contentVersion,
    inventoryDiscovery: {
      ...definition.inventoryDiscovery,
      restoration: { ...definition.inventoryDiscovery.restoration, outputItemId },
    },
  })
  await publish(weaponDefinition(capturedWeapon.id, 1))
  await db.query(
    `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:other',
        clock_timestamp()+interval '2 hours',clock_timestamp()+interval '3 hours',null,true)`,
    [owner, otherKey],
  )
  await publish(weaponDefinition(publishedWeapon.id, 2), 1)

  await db.query('select public.grant_character_items_v1($1,$1,1,$2,$3::jsonb)', [
    owner,
    'fixture:fill-gear',
    [
      { itemId: filler.id, quantity: 37 },
      { itemId: capturedWeapon.id, quantity: 1 },
      { itemId: publishedWeapon.id, quantity: 1 },
    ],
  ])
  await db.query('select public.grant_character_items_v1($1,$1,2,$2,$3::jsonb)', [
    owner,
    'event.fixture:gear',
    [{ itemId: filler.id, quantity: 1 }],
  ])
  await db.query('select public.grant_character_items_v1($1,$2,0,$3,$4::jsonb)', [
    owner,
    sibling,
    'fixture:fill-sibling-gear',
    [{ itemId: filler.id, quantity: 40 }],
  ])
  const before = await inventory()
  const ordinary = before.snapshot.stacks.filter(
    (stack) => stack.provenance === 'fixture:fill-gear' && stack.itemId === filler.id,
  )
  const [equipped, disposable, next] = ordinary
  await db.query('select public.set_character_item_equipment_v1($1,$1,$2,$3,$4,$5)', [
    owner,
    before.snapshot.revision,
    { head: equipped!.id },
    { kind: 'basic', actionId: 'basic.recover' },
    [],
  ])
  const unowed = await inventory()
  expect(unowed.discardableStackIds).not.toContain(disposable!.id)
  await rejected(() => discard(unowed, disposable!.id), 'ITEM_DISCARD_PROTECTED')
  await interact(1, 'choose-restoration')
  await walk(2, position, checkpoint)
  await walk(4, checkpoint, position)
  await interact(6, 'restore-item')
  const stock = await carried()
  expect(stock).toHaveLength(40)
  expect(stock.some(({ item_id }) => [first.id, second.id, sword.id].includes(item_id))).toBe(false)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'claim-restoration', itemClaimPending: true }),
  ])
  await rejected(() => interact(7, 'claim-restoration'), 'ITEM_CAPACITY')

  await db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 millisecond' where id=$1",
    [runId],
  )
  await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'retire-world',null)", [
    owner,
    giver,
  ])
  await rejected(
    () =>
      db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
        JSON.stringify([{ ...sword, contentVersion: 2, enabled: false }]),
      ]),
    'ITEM_PENDING_EVENT_EXCHANGE',
  )
  await walk(7, position, checkpoint)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: null, destination: position, itemClaimPending: true }),
  ])
  await walk(9, checkpoint, position)
  const full = await inventory()
  expect(full.discardableStackIds).toEqual(ordinary.slice(1).map(({ id }) => id))
  for (const protectedStack of full.snapshot.stacks.filter(
    ({ id }) => !full.discardableStackIds.includes(id),
  )) {
    await rejected(() => discard(full, protectedStack.id), 'ITEM_DISCARD_PROTECTED')
  }
  const siblingInventory = await inventory(sibling)
  expect(siblingInventory.discardableStackIds).toEqual([])
  await rejected(
    () => discard(siblingInventory, siblingInventory.snapshot.stacks[0]!.id, owner, sibling),
    'ITEM_DISCARD_PROTECTED',
  )
  await rejected(() => discard(full, disposable!.id, other), 'ITEM_OWNERSHIP')

  // Retained battle fixtures use replica mode to bypass capture construction only.
  await db.exec('savepoint pending_battle; set local session_replication_role=replica')
  const battle = crypto.randomUUID()
  await db.query(
    `insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot)
     values($1,$2,'fixture.restoration-items',1,1,'pending','{}')`,
    [battle, owner],
  )
  await db.query(
    `insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id)
     values($1,'player','player',$2,$2)`,
    [battle, owner],
  )
  await db.exec('set local session_replication_role=origin')
  expect((await inventory()).battleLocked).toBe(true)
  await rejected(() => discard(full, disposable!.id), 'ITEM_BATTLE_ACTIVE')
  await db.exec('rollback to savepoint pending_battle; release savepoint pending_battle')

  await db.exec('set local role service_role')
  const result = (await discard(full, disposable!.id)).rows[0]!.value.state
  await db.exec('reset role')
  expect(result.snapshot.revision).toBe(full.snapshot.revision + 1)
  expect(result.snapshot.stacks).toEqual(
    full.snapshot.stacks.filter(({ id }) => id !== disposable!.id),
  )
  expect(result.snapshot.equipment).toEqual(full.snapshot.equipment)
  expect(result.discardableStackIds).toEqual([])
  await rejected(() => discard(full, next!.id), 'ITEM_STALE_REVISION')
  await rejected(() => discard(result, next!.id), 'ITEM_DISCARD_PROTECTED')
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'claim-restoration', itemClaimPending: true }),
  ])
  const claim = '99999999-9999-4999-8999-999999999999'
  await interact(11, 'claim-restoration', claim)
  await interact(11, 'claim-restoration', claim)
  expect((await carried()).filter((entry) => entry.item_id === sword.id)).toHaveLength(1)
  expect((await inventory()).discardableStackIds).toEqual([])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'completed', itemClaimPending: false }),
  ])
})

it('rolls back the exchange if either fragment no longer exists and keeps the selected route', async () => {
  await prepare()
  await interact(1, 'choose-restoration')
  await walk(2, position, checkpoint)
  await walk(4, checkpoint, position)
  await discard(
    await inventory(),
    (await carried()).find((entry) => entry.item_id === second.id)!.id,
  )
  await rejected(() => interact(6, 'restore-item'), 'WORLD_QUEST_ITEMS_MISSING')
  expect((await carried()).map((entry) => entry.item_id)).toEqual([first.id])
  await grant(2, [second.id])
  await interact(6, 'restore-item')
  expect((await carried()).map((entry) => entry.item_id)).toEqual([sword.id])
})

it('reveals pre-existing stock privately and consumes exactly one of each distinct fragment', async () => {
  await grant(0, [first.id, first.id, second.id, second.id])
  await grant(0, [first.id], other)
  expect((await read()).personalQuests).toEqual([])
  await start()
  const holder = await read()
  expect(holder.personalQuests).toEqual([
    expect.objectContaining({
      action: 'choose-restoration',
      outputName: sword.name,
      body: definition.inventoryDiscovery.restoration.offer,
      discoveryClue: definition.inventoryDiscovery.clue,
    }),
  ])
  expect(holder.eventObjectives).toEqual([])
  expect((await read(other)).personalQuests).toEqual([])
  expect((await read(owner, sibling)).personalQuests).toEqual([])
  await rejected(
    () => interact(1, 'choose-restoration', null, { actor: other }),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await rejected(
    () => interact(1, 'choose-restoration', null, { actor: other, characterId: owner }),
    'ITEM_OWNERSHIP',
  )
  expect((await carried()).map(({ quantity }) => quantity)).toEqual([2, 2])
  await interact(1, 'choose-restoration')
  await walk(2, position, checkpoint)
  await walk(4, checkpoint, position)
  await interact(6, 'restore-item')
  expect(await carried()).toEqual(
    [first, second, sword].map(({ id }) => expect.objectContaining({ item_id: id, quantity: 1 })),
  )
  expect((await read(other)).personalQuests).toEqual([])
  expect((await read(owner, sibling)).personalQuests).toEqual([])
})

it('does not consume a pair if the character already carries the unique output', async () => {
  await prepare()
  await grant(1, [sword.id])
  await interact(1, 'choose-restoration')
  await walk(2, position, checkpoint)
  await walk(4, checkpoint, position)
  const before = await carried()
  await rejected(() => interact(6, 'restore-item'), 'WORLD_RESTORATION_WEAPON_ALREADY_EARNED')
  expect(await carried()).toEqual(before)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'restore-item', itemClaimPending: false }),
  ])
})

it('requires a usable weapon and restricts direct World mutations to the service boundary', async () => {
  await rejected(
    () =>
      publish(
        {
          ...definition,
          contentVersion: 2,
          inventoryDiscovery: {
            ...definition.inventoryDiscovery,
            restoration: { ...definition.inventoryDiscovery.restoration, outputItemId: filler.id },
          },
        },
        1,
      ),
    'EVENT_INVENTORY_RESTORATION_WEAPON_UNAVAILABLE',
  )
  await prepare()
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set local role ${role}`)
    await rejected(() => interact(1, 'choose-restoration'), 'permission denied')
    await db.exec('reset role')
  }
  await db.exec('set local role service_role')
  await rejected(
    () =>
      db.query(
        'select public.commit_world_personal_quest_before_restoration_v1($1,$1,1,gen_random_uuid(),$2,$3,$4)',
        [owner, runId, 'choose-restoration', 'fixture:legacy-bypass'],
      ),
    'permission denied',
  )
  await rejected(
    () => db.query('select * from app_private.personal_restoration_commands'),
    'permission denied',
  )
  await interact(1, 'choose-restoration')
  await db.exec('reset role')
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: null, destination: checkpoint }),
  ])
})
