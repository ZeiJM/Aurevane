import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import type { ItemInventorySnapshot } from '../../game-core/src/character/item-inventory'
import { createCombatEncounterState, executeCombatAction } from '../../game-core/src/combat/actions'
import { createPendingBattle, startBattle } from '../../game-core/src/combat/battle-state'
import { createTacticalBattleState } from '../../game-core/src/combat/board'
import { surrenderPvpCombatant } from '../../game-core/src/combat/pvp-quality'
import {
  PV1F_COMBAT_CONTENT,
  createPv1fTemporaryResources,
} from '../../game-core/src/combat/pv1f-action-economy'
import { createStatDrivenCombatEncounterState } from '../../game-core/src/combat/stat-driven-combat'
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
const challenger = '55555555-5555-4555-8555-555555555555'
const otherChallenger = '66666666-6666-4666-8666-666666666666'
const challengerPosition = { ...position, x: 4 }
const recoveryPackage = 'fixture.restoration-recovery'
const trialPackage = 'fixture.restoration-trial'
const trialDefinition = (key = 'event.fixture-restoration-trial') => ({
  ...definition,
  eventKey: key,
  inventoryDiscovery: {
    ...definition.inventoryDiscovery,
    restoration: {
      ...definition.inventoryDiscovery.restoration,
      recoveryRewardPackageRef: recoveryPackage,
      trial: {
        npcId: challenger,
        offer: 'Choose the trial to prove yourself.',
        active: 'Challenge the field guardian.',
        ready: 'Return to the forge after your victory.',
        rewardPackageRef: trialPackage,
      },
    },
  },
})
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
  for (const [id, name] of [
    [challenger, 'Trial guardian'],
    [otherChallenger, 'Ordinary challenger'],
  ] as const) {
    await saveChallenger(id, name)
    await db.query("select public.write_master_npc_design_v1($1,null,$2,1,'commit-world',null)", [
      owner,
      id,
    ])
  }
  await db.query(
    `insert into app_private.event_reward_budget_policies(budget_ref,reward_kind,max_per_claim,approved_by)
      values('fixture.restoration-budget','character-xp',100,$1)`,
    [owner],
  )
  for (const [key, amount] of [
    [recoveryPackage, 21],
    [trialPackage, 47],
    ['fixture.same-trial-amount', 47],
  ] as const) {
    await db.query(
      `insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
        values($1,1,'character-xp',$2,$3,'fixture.restoration-budget')`,
      [key, amount, owner],
    )
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
      result: { state: { version: number }; personalQuests: unknown[]; eventObjectives: unknown[] }
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

function saveChallenger(id: string, name: string, revision = 0) {
  return db.query("select public.write_master_npc_design_v1($1,null,$2,$3,'save',$4)", [
    owner,
    id,
    revision,
    {
      name,
      portraitRef: null,
      uses: ['world'],
      arena: null,
      world: {
        ...(id === challenger ? challengerPosition : checkpoint),
        radius: 2,
        greeting: 'The challenger is waiting.',
        encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: [] },
      },
    },
  ])
}

async function prepareTrial(event = trialDefinition(), giveFragments = true, scheduleHours = 4) {
  await publish(event)
  runId = (
    await db.query<{ run_id: string }>(
      `select * from public.schedule_event_run_v2($1,null::uuid,$2,gen_random_uuid(),'schedule:trial',
        clock_timestamp()+interval '1 hour' * $3::integer,
        clock_timestamp()+interval '1 hour' * ($3::integer+1),null,true)`,
      [owner, event.eventKey, scheduleHours],
    )
  ).rows[0]!.run_id
  await start()
  if (giveFragments) await grant(0, [first.id, second.id])
  await read()
}

async function challenge(
  version: number,
  options: { npc?: string; character?: string; user?: string; startupWin?: boolean } = {},
) {
  const { npc = challenger, character = owner, user = owner, startupWin = false } = options
  const battleId = `trial-fixture-${crypto.randomUUID()}`
  const player = `character:${character}`
  const opponent = 'recruit:fixture'
  const combatants = [player, opponent].map((id, index) => ({
    id,
    teamId: index === 0 ? 'players' : 'opponents',
    initiative: index === 0 ? 2 : 1,
    baseMovementBudget: 2,
    hp: 10,
    maxHp: 10,
    mp: 0,
    maxMp: 0,
    temporaryResources: createPv1fTemporaryResources(15),
  }))
  const battle = startBattle(
    createPendingBattle({ battleId, rulesVersion: 1, contentVersion: 1, rngSeed: 100, combatants }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: combatants.map((unit, x) => ({
      combatantId: unit.id,
      position: { x, y: 0 },
      facing: x === 0 ? 'east' : 'west',
      movementProfileId: 'ground',
    })),
  })
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    combatants.map((unit) => ({
      combatantId: unit.id,
      provenance: { kind: 'scenario', sourceId: 'scenario:trial-test', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  const capture = (
    await db.query<{ capture: object }>(
      `select public.get_character_committed_build_snapshot_v2($1,$2) || jsonb_build_object('sourceHash',app_private.player_source_hash_v1($2)) capture`,
      [user, character],
    )
  ).rows[0]!.capture
  const arenaNpc = (
    await db.query<{ value: object }>(
      "select world - array['sectorId','x','y','radius','greeting','encounter'] value from app_private.npc_designs where id=$1",
      [npc],
    )
  ).rows[0]!.value
  const authority = {
    worldBattleOrigin: 'npc',
    arenaNpc,
    buildAuthority: { combatants: [{ ...capture, characterId: character, combatantId: player }] },
  }
  const victory = executeCombatAction(
    state,
    {
      id: 'world-fixture.strike',
      version: 1,
      sourceType: 'scenario',
      tags: [],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'primary-unit', amount: 15 }],
    },
    { kind: 'unit', combatantId: opponent },
    PV1F_COMBAT_CONTENT,
  )
  const admitted = (
    await db.query<{ battle_session_id: string }>(
      `select * from public.start_world_npc_battle_v1($1,$2,$3,gen_random_uuid(),$4,$5,$6,$5,1,1,$7,$8,$9,$10,$11)`,
      [
        user,
        character,
        version,
        npc,
        battleId,
        `canonical:${battleId}`,
        { ...(startupWin ? victory.state : state), ...authority },
        [
          { combatant_id: player, participant_role: 'player', character_id: character },
          { combatant_id: opponent, participant_role: 'opponent', character_id: null },
        ],
        startupWin ? { ...state, ...authority } : null,
        startupWin ? victory.events : null,
        startupWin
          ? {
              schemaVersion: 1,
              commandVisibility: { kind: 'public' },
              eventVisibilityOverrides: [],
            }
          : null,
      ],
    )
  ).rows[0]!.battle_session_id
  return {
    admitted,
    finish: async (surrender = false) => {
      const result = surrender ? surrenderPvpCombatant(state, opponent) : victory
      await db.query(
        `select * from public.commit_battle_intent_v3($1::text,gen_random_uuid(),'fixture:trial-terminal',$1::uuid,$2,1,$3,$4,null)`,
        [user, admitted, { ...result.state, ...authority }, result.events],
      )
    },
  }
}

async function awardedAmounts() {
  return (
    await db.query<{ requested_amount: number }>(
      'select requested_amount from app_private.character_xp_grants where character_id=$1',
      [owner],
    )
  ).rows.map(({ requested_amount }) => requested_amount)
}

it('validates different budgeted XP rewards and a committed World encounter for two-route restoration', async () => {
  for (const reward of [trialPackage, 'fixture.same-trial-amount', 'fixture.missing-package']) {
    const draft = trialDefinition()
    draft.inventoryDiscovery.restoration.recoveryRewardPackageRef = reward
    await rejected(() => publish(draft), 'EVENT_INVENTORY_RESTORATION_REWARDS_INVALID')
  }
  const incomplete = trialDefinition()
  Reflect.deleteProperty(incomplete.inventoryDiscovery.restoration, 'recoveryRewardPackageRef')
  await rejected(() => publish(incomplete), 'EVENT_INVENTORY_RESTORATION_REWARDS_INVALID')
  const noEncounter = trialDefinition()
  noEncounter.inventoryDiscovery.restoration.trial.npcId = giver
  await rejected(() => publish(noEncounter), 'EVENT_INVENTORY_RESTORATION_TRIAL_NPC_UNAVAILABLE')
  await publish(trialDefinition())
})

it('requires a fresh owned World trial victory, uses one route, and grants only trial XP at confirmed restoration', async () => {
  await prepareTrial()
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({
      action: 'choose-restoration',
      alternativeAction: 'choose-restoration-trial',
      trialOffer: 'Choose the trial to prove yourself.',
    }),
  ])
  expect((await read(owner, sibling)).personalQuests).toEqual([])
  const firstFight = await challenge(1)
  await firstFight.finish()
  const choice = crypto.randomUUID()
  const choiceVersion = (await read()).state.version
  await interact(choiceVersion, 'choose-restoration-trial', choice)
  const chosenVersion = (await read()).state.version
  await rejected(
    () => interact(chosenVersion, 'choose-restoration'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await walk(chosenVersion, position, checkpoint)
  await walk(chosenVersion + 2, checkpoint, position)
  await rejected(
    () => interact(chosenVersion + 4, 'restore-item'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({
      body: 'Challenge the field guardian.',
      progress: 'active',
      destination: challengerPosition,
      action: null,
    }),
  ])
  expect((await read()).personalQuests[0]).not.toHaveProperty('trialOffer')
  await (await challenge(1, { character: sibling })).finish()
  await (await challenge((await read()).state.version, { npc: otherChallenger })).finish()
  const conceded = await challenge((await read()).state.version)
  await conceded.finish(true)
  expect(
    (
      await db.query(
        'select outcome from app_private.world_npc_terminal_receipts where battle_session_id=$1',
        [conceded.admitted],
      )
    ).rows,
  ).toEqual([{ outcome: 'surrender' }])
  const afterSurrender = (await read()).state.version
  await rejected(() => interact(afterSurrender, 'restore-item'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  const won = await challenge(afterSurrender, { startupWin: true })
  expect(
    (
      await db.query(
        'select outcome from app_private.world_npc_terminal_receipts where battle_session_id=$1',
        [won.admitted],
      )
    ).rows,
  ).toEqual([{ outcome: 'victory' }])
  expect(await awardedAmounts()).toEqual([])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({
      body: 'Return to the forge after your victory.',
      progress: 'ready',
      destination: position,
      action: 'restore-item',
    }),
  ])
  const restore = crypto.randomUUID()
  const restoreVersion = (await read()).state.version
  await interact(restoreVersion, 'restore-item', restore)
  await walk(restoreVersion + 1, position, checkpoint)
  expect((await interact(choiceVersion, 'choose-restoration-trial', choice)).rows).toEqual([
    { state: (await read()).state },
  ])
  expect((await interact(restoreVersion, 'restore-item', restore)).rows).toEqual([
    { state: (await read()).state },
  ])
  await rejected(
    () => interact(choiceVersion, 'choose-restoration', choice),
    'WORLD_COMMAND_CONFLICT',
  )
  expect(await awardedAmounts()).toEqual([47])
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'completed', awardedXp: 47 }),
  ])
})

it('converges on the same sword and grants only recovery XP when recovery was chosen', async () => {
  await prepareTrial()
  await interact(1, 'choose-restoration')
  await rejected(() => interact(2, 'choose-restoration-trial'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await walk(2, position, checkpoint)
  await walk(4, checkpoint, position)
  await interact(6, 'restore-item')
  expect(await awardedAmounts()).toEqual([21])
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'completed', awardedXp: 21 }),
  ])
})

it('does not credit a replacement publication and lets a stranded trial switch to recovery once', async () => {
  await prepareTrial()
  await saveChallenger(challenger, 'Updated trial guardian', 2)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ alternativeAction: 'choose-restoration-trial' }),
  ])
  const trialChoice = crypto.randomUUID()
  await interact(1, 'choose-restoration-trial', trialChoice)
  await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'commit-world',null)", [
    owner,
    challenger,
  ])
  await (await challenge(2)).finish()
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({
      body: 'The trial opponent is no longer available. Return to the smith to choose the recovery route.',
      destination: position,
      action: 'choose-restoration',
      progress: 'active',
    }),
  ])
  const afterBattle = (await read()).state.version
  await rejected(() => interact(afterBattle, 'restore-item'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect(await awardedAmounts()).toEqual([])
  expect((await carried()).map(({ item_id }) => item_id)).toEqual([first.id, second.id])

  const recoveryChoice = crypto.randomUUID()
  await interact(afterBattle, 'choose-restoration', recoveryChoice)
  await rejected(
    () => interact(afterBattle + 1, 'choose-restoration'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await rejected(
    () => interact(afterBattle + 1, 'choose-restoration-trial'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await walk(afterBattle + 1, position, checkpoint)
  await walk(afterBattle + 3, checkpoint, position)
  await interact(afterBattle + 5, 'restore-item')
  const state = (await read()).state
  expect((await interact(1, 'choose-restoration-trial', trialChoice)).rows).toEqual([{ state }])
  expect((await interact(afterBattle, 'choose-restoration', recoveryChoice)).rows).toEqual([
    { state },
  ])
  expect(await awardedAmounts()).toEqual([21])
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
})

it('retains a qualified battle and its victory when the opponent retires after admission', async () => {
  await prepareTrial()
  await interact(1, 'choose-restoration-trial')
  const fight = await challenge(2)
  await db.query("select public.write_master_npc_design_v1($1,null,$2,2,'retire-world',null)", [
    owner,
    challenger,
  ])
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({
      body: 'Challenge the field guardian.',
      progress: 'active',
      action: null,
    }),
  ])
  await fight.finish()
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'ready', action: 'restore-item' }),
  ])
  await interact((await read()).state.version, 'restore-item')
  expect(await awardedAmounts()).toEqual([47])
})

it('keeps the trial sword owed when Gear is full and grants XP only at settlement', async () => {
  await prepareTrial()
  await db.query('select public.grant_character_items_v1($1,$1,1,$2,$3::jsonb)', [
    owner,
    'fixture:fill-trial-gear',
    [{ itemId: filler.id, quantity: 40 }],
  ])
  await interact(1, 'choose-restoration-trial')
  await challenge(2, { startupWin: true })
  await interact((await read()).state.version, 'restore-item')
  expect(await awardedAmounts()).toEqual([47])
  expect(await carried()).toHaveLength(40)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ action: 'claim-restoration', itemClaimPending: true, awardedXp: 47 }),
  ])
  await db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 millisecond' where id=$1",
    [runId],
  )
  const gear = await inventory()
  await discard(gear, gear.discardableStackIds[0]!)
  const claim = crypto.randomUUID()
  const version = (await read()).state.version
  await interact(version, 'claim-restoration', claim)
  await interact(version, 'claim-restoration', claim)
  expect(await awardedAmounts()).toEqual([47])
  expect((await carried()).filter(({ item_id }) => item_id === sword.id)).toHaveLength(1)
  expect((await read()).personalQuests).toEqual([
    expect.objectContaining({ progress: 'completed', itemClaimPending: false, awardedXp: 47 }),
  ])
})

it('reports the actual restoration date and sword in staff reward history', async () => {
  await prepareTrial()
  const dashboard = async () =>
    (
      await db.query<{ value: { personalRewards: unknown[] } }>(
        'select public.read_event_operation_dashboard_v1($1,null::uuid,$2) value',
        [owner, runId],
      )
    ).rows[0]!.value
  expect((await dashboard()).personalRewards).toEqual([])
  await interact(1, 'choose-restoration-trial')
  await challenge(2, { startupWin: true })
  await interact((await read()).state.version, 'restore-item')
  const receipt = (
    await db.query<{ discovery: string; restoration: string }>(
      `select to_jsonb(completed_at) discovery,to_jsonb(restoration_settled_at) restoration
        from app_private.event_personal_quest_attempts where run_id=$1 and character_id=$2`,
      [runId, owner],
    )
  ).rows[0]!
  expect(receipt.restoration).not.toBe(receipt.discovery)
  expect((await dashboard()).personalRewards).toEqual([
    expect.objectContaining({
      characterId: owner,
      completedAt: receipt.restoration,
      itemName: sword.name,
      awardedXp: 47,
      itemClaimPending: false,
    }),
  ])
})

it('preserves an admitted victory across event pause, expiry, and giver retirement', async () => {
  await prepareTrial()
  await interact(1, 'choose-restoration-trial')
  const operate = (revision: number, action: string) =>
    db.query(
      'select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,null,true)',
      [owner, runId, revision, action],
    )
  await operate(2, 'pause')
  const tooLate = await challenge(2)
  await tooLate.finish()
  const afterPause = (await read()).state.version
  await rejected(() => interact(afterPause, 'restore-item'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await operate(3, 'resume')

  const admitted = await challenge(afterPause)
  await operate(4, 'pause')
  await admitted.finish()
  await db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 millisecond' where id=$1",
    [runId],
  )
  await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'retire-world',null)", [
    owner,
    giver,
  ])
  const afterWin = await read()
  expect(afterWin.personalQuests).toEqual([
    expect.objectContaining({
      body: 'Return to the forge after your victory.',
      speaker: 'Restoration smith',
      progress: 'ready',
      destination: position,
      action: 'restore-item',
      local: true,
    }),
  ])
  await interact(afterWin.state.version, 'restore-item')
  expect(await awardedAmounts()).toEqual([47])
  expect(await carried()).toEqual([expect.objectContaining({ item_id: sword.id, quantity: 1 })])
})

it('reserves a selected current opponent for one unresolved trial at a time', async () => {
  await prepareTrial()
  const firstRun = runId
  const secondEvent = trialDefinition('event.fixture-second-trial')
  secondEvent.inventoryDiscovery.restoration.outputItemId = capturedWeapon.id
  await prepareTrial(secondEvent, false, 6)
  const secondRun = runId
  await interact(1, 'choose-restoration-trial', null, { run: firstRun })
  const quests = (await read()).personalQuests
  expect(quests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ runId: firstRun, body: 'Challenge the field guardian.' }),
      expect.objectContaining({ runId: secondRun, action: 'choose-restoration' }),
    ]),
  )
  expect(quests.find((row) => (row as { runId: string }).runId === secondRun)).not.toHaveProperty(
    'alternativeAction',
  )
  await rejected(
    () => interact(2, 'choose-restoration-trial', null, { run: secondRun }),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  const operateFirst = (revision: number, action: string) =>
    db.query(
      'select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,null,true)',
      [owner, firstRun, revision, action],
    )
  await operateFirst(2, 'pause')
  expect(
    (await read()).personalQuests.find((row) => (row as { runId: string }).runId === secondRun),
  ).not.toHaveProperty('alternativeAction')
  await rejected(
    () => interact(2, 'choose-restoration-trial', null, { run: secondRun }),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await operateFirst(3, 'resume')
  await challenge(2, { startupWin: true })
  expect((await read()).personalQuests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ runId: firstRun, action: 'restore-item' }),
      expect.objectContaining({ runId: secondRun, alternativeAction: 'choose-restoration-trial' }),
    ]),
  )
})
