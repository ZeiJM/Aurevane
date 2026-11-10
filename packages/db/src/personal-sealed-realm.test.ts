import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import {
  createPendingBattle,
  startBattle,
  defeatCurrentCombatant,
  endTurn,
  selectFinalFacing,
  type BattleState,
} from '../../game-core/src/combat/battle-state'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'

const actor = '11111111-1111-4111-8111-111111111111'
const other = '99999999-9999-4999-8999-999999999999'
const eventKey = 'event.fixture-sealed-realm'
const joe = '77777777-7777-4777-8777-777777777777'
const guardian = '88888888-8888-4888-8888-888888888888'
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
const journey = {
  type: 'item-exchange',
  giverId: joe,
  realm: {
    guardianNpcId: guardian,
    lore: 'The harvest charm opens a path through the old lock.',
    access: 'You have the key. Travel when you are ready.',
    challenge: 'The guardian is waiting inside.',
    retry: 'The gate remains open. You can try again.',
  },
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
  rewardPackageRefs: ['reward.fixture-sealed-realm'],
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
  await db.query(
    `insert into app_private.event_reward_budget_policies values('budget.fixture-sealed-realm','character-xp',100,$1,now())`,
    [actor],
  )
  await db.query(
    `insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
      values('reward.fixture-sealed-realm',1,'character-xp',25,$1,'budget.fixture-sealed-realm')`,
    [actor],
  )
  for (const [id, name] of [
    [joe, 'Maren Vale'],
    [guardian, 'Aurevane'],
  ]) {
    const placement =
      id === joe ? { ...position, radius: 1, greeting: 'Welcome to the farm.' } : null
    const draft = {
      name,
      portraitRef: null,
      uses: placement ? ['world', 'story'] : ['story'],
      arena: null,
      world: placement,
    }
    const write = (revision: number, kind: string, value: unknown = null) =>
      db.query('select public.write_master_npc_design_v1($1,null,$2,$3,$4,$5::jsonb)', [
        actor,
        id,
        revision,
        kind,
        value === null ? null : JSON.stringify(value),
      ])
    await write(0, 'save', draft)
    await write(1, 'commit-story')
    if (placement) await write(2, 'commit-world')
  }
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([seed, key, filler]),
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

async function rejected(call: () => Promise<unknown>, message: string) {
  await db.exec('savepoint rejected_exchange')
  await expect(call()).rejects.toThrow(message)
  await db.exec('rollback to savepoint rejected_exchange; release savepoint rejected_exchange')
}

const state = async () =>
  (
    await db.query<{ state: { version: number; position: typeof position } }>(
      'select state from app_private.character_world_state where character_id=$1',
      [actor],
    )
  ).rows[0]!.state

async function start(
  version: number,
  id: string,
  commandId: string,
  boss = true,
  winAtStartup = false,
) {
  const player = {
    id: `character:${actor}`,
    teamId: 'player',
    initiative: 2,
    baseMovementBudget: 2,
    hp: 10,
    maxHp: 10,
    mp: 0,
    maxMp: 0,
  }
  const opponent = { ...player, id: 'recruit:guardian', teamId: 'opponent', initiative: 1 }
  const battle = startBattle(
    createPendingBattle({
      battleId: id,
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 100,
      combatants: [player, opponent],
    }),
  ).state
  const capture = (
    await db.query<{ capture: Record<string, unknown> }>(
      `select public.get_character_committed_build_snapshot_v2($1,$1) ||
      jsonb_build_object('sourceHash',app_private.player_source_hash_v1($1)) capture`,
      [actor],
    )
  ).rows[0]!.capture
  const snapshot = {
    tactical: { battle },
    arenaNpc: { id: guardian, revision: 2, name: 'Aurevane', portraitRef: null },
    buildAuthority: { combatants: [{ ...capture, characterId: actor, combatantId: player.id }] },
  }
  const participants = [
    { combatant_id: player.id, participant_role: 'player', character_id: actor },
    { combatant_id: opponent.id, participant_role: 'opponent', character_id: null },
  ]
  const terminal = winAtStartup ? engineDefeat(battle, false) : null
  const finalSnapshot = terminal ? { ...snapshot, tactical: { battle: terminal.state } } : snapshot
  const result = boss
    ? await db.query<{ battle_session_id: string }>(
        `select * from public.start_world_personal_realm_battle_v1($1,$1,$2,$3,$4,$5,$6,$7,1,1,$8,$9,$10,$11,$12)`,
        [
          actor,
          version,
          commandId,
          runId,
          'fixture:world-challenge',
          'fixture:battle:' + id,
          id,
          finalSnapshot,
          participants,
          terminal ? snapshot : null,
          terminal?.events ?? null,
          terminal
            ? {
                schemaVersion: 1,
                commandVisibility: { kind: 'public' },
                eventVisibilityOverrides: [],
              }
            : null,
        ],
      )
    : await db.query<{ battle_session_id: string }>(
        'select * from public.create_battle_session_v1($1::text,$2,$3,$1::uuid,$4,1,1,$5,$6)',
        [actor, commandId, 'fixture:battle:' + id, id, snapshot, participants],
      )
  return { session: result.rows[0]!.battle_session_id, snapshot }
}

function engineDefeat(battle: BattleState, player: boolean) {
  const target = battle.combatants[player ? 0 : 1]!.id
  if (battle.currentTurn?.combatantId !== target)
    battle = endTurn(selectFinalFacing(battle, 'north').state).state
  return defeatCurrentCombatant(battle, target)
}

async function defeat(
  fight: Awaited<ReturnType<typeof start>>,
  player: boolean,
  ownerDown = false,
) {
  const battle = fight.snapshot.tactical.battle
  const result = engineDefeat(battle, player)
  // The shared command engine can resolve a victory with only a summon on
  // the winning team; the battle receipt still points to the player's team.
  const terminal = ownerDown
    ? {
        ...result.state,
        combatants: [
          ...result.state.combatants.map((unit) => ({ ...unit, hp: 0 })),
          {
            ...result.state.combatants[0]!,
            id: 'summon:guardian-fixture',
            kind: 'summon' as const,
          },
        ],
      }
    : result.state
  const snapshot = { ...fight.snapshot, tactical: { battle: terminal } }
  const commandId = (await db.query<{ id: string }>('select gen_random_uuid() id')).rows[0]!.id
  const commit = () =>
    db.query('select * from public.commit_battle_intent_v2($1::text,$2,$3,$1::uuid,$4,1,$5,$6)', [
      actor,
      commandId,
      'fixture:result:' + fight.session,
      fight.session,
      snapshot,
      result.events,
    ])
  await commit()
  await commit()
}

it('requires separate access, travel and boss admission, keeps access on loss and grants only the linked victory', async () => {
  await grant(0, 'fixture:seeds', [{ itemId: seed.id, quantity: 14 }])
  expect(await read()).toEqual([
    expect.objectContaining({
      speaker: 'Maren Vale',
      lore: journey.realm.lore,
      progress: 'available',
      action: 'accept',
    }),
  ])
  await rejected(() => action(1, 'travel-realm'), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await rejected(
    () => start(1, 'early', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  await action(1, 'accept')
  expect(await read()).toEqual([expect.objectContaining({ inputOwned: 14, action: 'hand-over' })])
  await action(2, 'hand-over')
  expect(await access()).toBe(true)
  expect(await state()).toEqual(expect.objectContaining({ version: 3, position }))
  expect(await owned()).toEqual([
    { item_id: seed.id, quantity: 7 },
    { item_id: key.id, quantity: 1 },
  ])
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'active', action: 'travel-realm' }),
  ])
  expect(await read(other)).toEqual([expect.objectContaining({ progress: 'available' })])
  await rejected(
    () => start(3, 'not-in-realm', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'WORLD_QUEST_OUT_OF_RANGE',
  )

  const unrelated = await start(3, 'unrelated-arena', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false)
  await defeat(unrelated, false)
  expect(await read()).toEqual([expect.objectContaining({ progress: 'active', awardedXp: 0 })])
  await action(4, 'travel-realm', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  await action(4, 'travel-realm', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  const inside = await state()
  expect(inside).toMatchObject({
    version: 5,
    position: { sectorId: expect.stringMatching(/^sealed-realm:/), x: 6, y: 4 },
  })
  expect(await read()).toEqual([
    expect.objectContaining({
      progress: 'active',
      action: 'challenge-realm',
      alternativeAction: 'leave-realm',
    }),
  ])
  const first = await start(5, 'first-guardian-attempt', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  expect(
    (await start(5, 'first-guardian-attempt', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')).session,
  ).toBe(first.session)
  await rejected(
    () => start(5, 'racing-guardian-attempt', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
    'WORLD_STALE_VERSION',
  )
  await defeat(first, true)
  expect(await access()).toBe(true)
  expect(await read()).toEqual([
    expect.objectContaining({ body: journey.realm.retry, action: 'challenge-realm', awardedXp: 0 }),
  ])
  await db.exec('delete from realtime.messages')
  await action(6, 'leave-realm')
  expect((await state()).position).toEqual(position)
  expect((await db.query('select topic from realtime.messages order by topic')).rows).toEqual([
    { topic: `world-scene:${inside.position.sectorId}` },
    { topic: `world-scene:${position.sectorId}` },
  ])
  await action(7, 'travel-realm')
  expect((await state()).position).toEqual(inside.position)

  const second = await start(8, 'second-guardian-attempt', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
  await defeat(second, false, true)
  expect(await read()).toEqual([
    expect.objectContaining({ progress: 'completed', action: 'leave-realm', awardedXp: 25 }),
  ])
  expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
    { xp: 25 },
  ])
  await rejected(
    () => start(9, 'after-victory', 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'WORLD_QUEST_ACTION_UNAVAILABLE',
  )
  expect(await owned()).toEqual([
    { item_id: seed.id, quantity: 7 },
    { item_id: key.id, quantity: 1 },
  ])
})

it('keeps earned access after expiry and giver retirement without exposing the guardian to other characters', async () => {
  await grant(0, 'fixture:seeds', [{ itemId: seed.id, quantity: 7 }])
  await read()
  await read(other)
  await action(1, 'accept')
  await action(2, 'hand-over')
  await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'retire-world',null)", [
    actor,
    joe,
  ])
  await db.query(
    "update app_private.event_runs set scheduled_end_at=clock_timestamp()-interval '1 millisecond' where id=$1",
    [runId],
  )
  expect(await read()).toEqual([
    expect.objectContaining({
      speaker: 'Sealed realm gate',
      action: 'travel-realm',
      accessGranted: true,
      lore: null,
    }),
  ])
  expect(await read(other)).toEqual([])
  await rejected(
    () =>
      db.query('select public.commit_world_personal_quest_v1($1,$2,3,gen_random_uuid(),$3,$4,$5)', [
        other,
        actor,
        runId,
        'travel-realm',
        'fixture:foreign-character',
      ]),
    'WORLD_NOT_OWNED',
  )
  await action(3, 'travel-realm')
  const guardianRead = (id: string, version: number) =>
    db.query('select public.read_world_personal_realm_battle_v1($1,$1,$2,$3) guardian', [
      id,
      runId,
      version,
    ])
  expect((await guardianRead(actor, 4)).rows).toEqual([
    { guardian: expect.objectContaining({ id: guardian, name: 'Aurevane' }) },
  ])
  await rejected(() => guardianRead(other, 1), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await action(4, 'leave-realm')
  expect((await state()).position).toEqual(position)
  await rejected(() => guardianRead(actor, 5), 'WORLD_QUEST_OUT_OF_RANGE')
  expect(await access()).toBe(true)
})

it('requires a real published giver placement, a different Story guardian and a reward', async () => {
  const assert = (value: unknown) =>
    db.query('select app_private.assert_event_personal_journey_v1($1::jsonb)', [
      JSON.stringify(value),
    ])
  await rejected(
    () => assert({ ...definition, personalJourney: { ...journey, giverId: guardian } }),
    'EVENT_PERSONAL_REALM_NPCS_UNAVAILABLE',
  )
  await rejected(
    () =>
      assert({
        ...definition,
        personalJourney: { ...journey, realm: { ...journey.realm, guardianNpcId: joe } },
      }),
    'EVENT_PERSONAL_REALM_NPCS_UNAVAILABLE',
  )
  await rejected(
    () => assert({ ...definition, rewardPackageRefs: [] }),
    'EVENT_PERSONAL_JOURNEY_INVALID',
  )
})

it('settles an engine victory recorded during canonical battle startup', async () => {
  await grant(0, 'fixture:seeds', [{ itemId: seed.id, quantity: 7 }])
  await read()
  await action(1, 'accept')
  await action(2, 'hand-over')
  await action(3, 'travel-realm')
  const commandId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const first = await start(4, 'startup-victory', commandId, true, true)
  expect((await start(4, 'startup-victory', commandId, true, true)).session).toBe(first.session)
  expect(await read()).toEqual([expect.objectContaining({ progress: 'completed', awardedXp: 25 })])
  expect((await db.query('select xp from public.characters where id=$1', [actor])).rows).toEqual([
    { xp: 25 },
  ])
})

it('blocks new challenges during staff pause or emergency stop but settles a previously admitted battle', async () => {
  await grant(0, 'fixture:seeds', [{ itemId: seed.id, quantity: 7 }])
  await read()
  await action(1, 'accept')
  await action(2, 'hand-over')
  await action(3, 'travel-realm')
  const operate = (version: number, operation: string) =>
    db.query(
      'select * from public.operate_event_run_v2($1,null::uuid,$2,$3,gen_random_uuid(),$4,null,true)',
      [actor, runId, version, operation],
    )
  const commandId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  await operate(2, 'pause')
  expect(await read()).toEqual([
    expect.objectContaining({ action: 'leave-realm', accessGranted: true }),
  ])
  await rejected(() => start(4, 'paused', commandId), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  await operate(3, 'resume')
  const fight = await start(4, 'before-emergency-stop', commandId)
  await operate(4, 'emergency-stop')
  await defeat(fight, false)
  expect(await read()).toEqual([expect.objectContaining({ progress: 'completed', awardedXp: 25 })])
})

it('replays only the exact settled hand-in after the giver retires', async () => {
  await grant(0, 'fixture:seeds', [{ itemId: seed.id, quantity: 14 }])
  await read()
  await read(other)
  await action(1, 'accept')
  await action(1, 'accept', null, other)
  await db.query('select public.grant_character_items_v1($1,$1,0,$2,$3::jsonb)', [
    other,
    'fixture:other-seeds',
    JSON.stringify([{ itemId: seed.id, quantity: 7 }]),
  ])
  const commandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const receipt = await action(2, 'hand-over', commandId)
  await db.query("select public.write_master_npc_design_v1($1,null,$2,3,'retire-world',null)", [
    actor,
    joe,
  ])
  expect((await action(2, 'hand-over', commandId)).rows).toEqual(receipt.rows)
  const retry = (userId: string, run: string, fingerprint: string) =>
    db.query('select public.commit_world_personal_quest_v1($1,$2,2,$3,$4,$5,$6)', [
      userId,
      actor,
      commandId,
      run,
      'hand-over',
      fingerprint,
    ])
  await rejected(() => retry(actor, runId, 'fixture:different'), 'WORLD_COMMAND_CONFLICT')
  await rejected(() => retry(actor, other, 'fixture:hand-over'), 'WORLD_COMMAND_CONFLICT')
  await rejected(() => retry(other, runId, 'fixture:hand-over'), 'ITEM_OWNERSHIP')
  await rejected(() => action(3, 'hand-over', commandId), 'WORLD_COMMAND_CONFLICT')
  await rejected(() => action(2, 'claim-exchange', commandId), 'WORLD_COMMAND_CONFLICT')
  await rejected(() => action(2, 'hand-over', null, other), 'WORLD_QUEST_ACTION_UNAVAILABLE')
  expect(await access(other)).toBe(false)
  expect(await owned()).toEqual([
    { item_id: seed.id, quantity: 7 },
    { item_id: key.id, quantity: 1 },
  ])
})
