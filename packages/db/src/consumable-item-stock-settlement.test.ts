import type { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest'
import { createCombatContentTestDatabase } from './test-support/combat-content-test-database'
import { itemFixture } from '../../game-core/src/content/items-test-fixtures'
import { source } from '../../game-core/src/combat/combat-behavior.test-utils'
import { percentageDotEncounter } from '../../game-core/src/combat/combat-percentage-dots.test-utils'
import { captureEquipmentAbilitySource } from '../../game-core/src/combat/combat-behavior-capture'
import {
  reconcileCombatAbilitySources,
  combatAbilityCommandContext,
} from '../../game-core/src/combat/combat-behavior-runtime'
import {
  activateCombatAbilitySources,
  commitCombatAbilityCommand,
} from '../../game-core/src/combat/combat-ability-command'
import { captureCombatAbilitySource } from '../../game-core/src/combat/combat-behavior-capture'
import {
  bindCombatTagPresentations,
  captureCombatTagPresentation,
} from '../../game-core/src/combat/combat-tag-registry'
import { PV1F_COMBAT_CONTENT } from '../../game-core/src/combat/pv1f-combat-content'
import type { BattleEquipmentCapture } from '../../game-core/src/combat/combat-equipment'
import type {
  CombatEncounterState,
  CombatResolutionTransition,
} from '../../game-core/src/combat/actions'
import { endCombatTurn } from '../../game-core/src/combat/actions'
import { selectCurrentFinalFacing } from '../../game-core/src/combat/board'
import {
  primeCombatControlledAbility,
  cancelCombatControlledAbility,
} from '../../game-core/src/combat/combat-behavior-runtime'
import type { AbilityBehavior } from '../../game-core/src/combat/combat-definition'

const owner = '00000000-0000-4000-8000-000000008901',
  character = '00000000-0000-4000-8000-000000008911'
const definition = source({ costs: [], maximumUsesPerBattle: 3 }).definition
const potion = itemFixture({
  id: 'stock.potion',
  itemClass: 'battle-item',
  inventoryCategory: 'battle-items',
  equipment: { slot: 'hand', hands: 1 },
  maximumStack: 99,
  ability: definition,
  actions: { use: { behaviorId: 'strike', name: 'Use' } },
  battleUses: 3,
})
let db: PGlite
beforeAll(async () => {
  db = await createCombatContentTestDatabase()
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'stock@example.test',now())",
    [owner],
  )
  await db.query(
    `insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at) values($1,$2,0,1,'Stock Tester','stock tester','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now())`,
    [character, owner],
  )
}, 60000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec('begin')
  await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
    JSON.stringify([potion]),
  ])
})
afterEach(async () => {
  await db.exec('rollback')
})
async function scenario(
  quantity = 2,
  current = true,
  options: { terminal?: boolean; spare?: boolean; behavior?: Partial<AbilityBehavior> } = {},
) {
  const item = options.behavior
    ? {
        ...potion,
        contentVersion: 2,
        ability: source({ costs: [], maximumUsesPerBattle: 3, ...options.behavior }).definition,
      }
    : potion
  if (options.behavior)
    await db.query('select public.seed_runtime_item_sources_v1($1::jsonb)', [
      JSON.stringify([item]),
    ])
  await db.query("select public.grant_character_items_v1($1,$2,0,'initial-stock',$3::jsonb)", [
    owner,
    character,
    JSON.stringify([{ itemId: item.id, quantity }]),
  ])
  const stack = (
    await db.query<{ id: string }>(
      'select id from app_private.character_item_stacks where character_id=$1',
      [character],
    )
  ).rows[0]!.id
  const spare = crypto.randomUUID()
  if (options.spare)
    await db.query(
      "insert into app_private.character_item_stacks(id,character_id,item_id,inventory_category,slot_index,quantity,acquired_content_version,provenance) values($1,$2,$3,'battle-items',1,7,$4,'spare-fixture')",
      [spare, character, item.id, item.contentVersion],
    )
  await db.query(
    'select public.set_character_item_equipment_v1($1,$2,1,$3::jsonb,$4::jsonb,$5::text[])',
    [
      owner,
      character,
      JSON.stringify({ 'consumable-1': stack }),
      JSON.stringify({ kind: 'basic', actionId: 'basic.pilfer' }),
      ['consumable-1'],
    ],
  )
  const capture = (
    await db.query<{ value: BattleEquipmentCapture }>(
      'select public.read_character_battle_equipment_v1($1,$2) value',
      [owner, character],
    )
  ).rows[0]!.value
  if (!current) {
    delete (capture as { consumptionPolicyVersion?: number }).consumptionPolicyVersion
    for (const unit of capture.equipment) delete (unit as { ownedQuantity?: number }).ownedQuantity
  }
  const captured = captureEquipmentAbilitySource(capture, capture.equipment[0]!, 'actor')!
  const base = percentageDotEncounter()
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      effectTimingPolicy: { version: 1, modes: {} },
      ...(options.terminal
        ? {
            tactical: {
              ...base.tactical,
              battle: {
                ...base.tactical.battle,
                combatants: base.tactical.battle.combatants.map((unit) => ({
                  ...unit,
                  hp: unit.id === 'enemy' ? 10 : unit.id === 'other' ? 0 : unit.hp,
                })),
              },
            },
          }
        : {}),
    },
    [captured],
  )
  const session = crypto.randomUUID()
  await db.exec('set local session_replication_role=replica')
  await db.query(
    "insert into app_private.battle_sessions(id,owner_user_id,battle_id,rules_version,content_version,lifecycle,current_snapshot,current_version) values($1,$2,'percentage-dots',1,1,'active',$3::jsonb,1)",
    [session, owner, JSON.stringify(state)],
  )
  await db.query(
    "insert into app_private.battle_participants(battle_session_id,combatant_id,participant_role,user_id,character_id) values($1,'actor','player',$2,$3)",
    [session, owner, character],
  )
  await db.query(
    'insert into app_private.battle_snapshots(battle_session_id,battle_version,snapshot) values($1,1,$2::jsonb)',
    [session, JSON.stringify(state)],
  )
  await db.exec('set local session_replication_role=origin')
  const use = (next: CombatEncounterState) =>
    commitCombatAbilityCommand({
      state: next,
      actorId: 'actor',
      root: { kind: 'canonical', source: captured },
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(next, captured),
    })
  const commit = (
    out: Pick<CombatResolutionTransition, 'state' | 'events'>,
    version = 1,
    key = crypto.randomUUID(),
  ) =>
    db.query<{ replayed: boolean }>(
      'select * from public.commit_battle_intent_v3($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,null)',
      [
        owner,
        key,
        key,
        owner,
        session,
        version,
        JSON.stringify(out.state),
        JSON.stringify(out.events),
      ],
    )
  return { capture, captured, state, session, stack, spare, use, commit }
}
async function inventory() {
  return (
    await db.query<{ revision: number; equipment: Record<string, string> }>(
      'select revision,equipment from app_private.character_item_inventory where character_id=$1',
      [character],
    )
  ).rows[0]!
}
it('round-trips actual automatic startup through PvE creation with newly activated consumable captures and no stock charge', async () => {
  const f = await scenario()
  await db.query('delete from app_private.battle_sessions where id=$1', [f.session])
  const build = (
    await db.query<{ value: { extensions: Record<string, unknown> } }>(
      'select public.get_character_committed_build_snapshot_v2($1,$2) value',
      [owner, character],
    )
  ).rows[0]!.value
  const tags = [
    captureCombatTagPresentation({
      id: 'tag.damage',
      contentVersion: 1,
      tagId: 'damage',
      name: 'Damage',
      description: 'Damage.',
      explanation: 'Damage.',
    }),
  ]
  const initial = {
    ...f.state,
    buildAuthority: {
      tagPresentations: tags,
      combatants: [
        {
          ...build,
          combatantId: 'actor',
          characterId: character,
          extensions: { ...build.extensions, equipmentSkills: [f.capture] },
        },
      ],
    },
  }
  delete initial.capturedAbilitySources
  delete initial.abilityRuntime
  const automatic = captureCombatAbilitySource(
    source(
      {
        activation: 'automatic',
        costs: [{ resource: 'mp', amount: 1 }],
        requirements: { kind: 'event', eventType: 'battle_started', phase: 'after' },
        targeting: {
          kind: 'self',
          teamPolicy: 'self',
          friendlyFire: 'allies-only',
          shape: { kind: 'single' },
          minimumRange: 0,
          maximumRange: 0,
          maximumSelections: 1,
          requiresLineOfSight: false,
          maximumElevationDifference: null,
        },
        effects: [
          {
            id: 'aura',
            payload: {
              type: 'apply-status',
              recipient: 'actor',
              statusId: 'inspired',
              stacks: 1,
              durationTurns: 2,
            },
          },
        ],
      },
      'startup-aura',
    ),
  )
  const equipped = captureEquipmentAbilitySource(
    f.capture,
    bindCombatTagPresentations(f.capture.equipment[0]!, tags),
    'actor',
  )!
  expect(equipped.equipment!.unit).not.toEqual(f.capture.equipment[0])
  const started = activateCombatAbilitySources(
    initial,
    [equipped, automatic],
    PV1F_COMBAT_CONTENT,
    true,
  )
  expect(started.events.some((event) => event.event === 'combat_action_used')).toBe(true)
  expect(started.state.itemConsumptionState).toBeUndefined()
  const before = await inventory()
  const create = (final = started.state) =>
    db.query<{ snapshot: CombatEncounterState }>(
      'select * from public.create_battle_session_v2($1,$2,$3,$4,$5,1,1,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)',
      [
        owner,
        crypto.randomUUID(),
        'stock-startup',
        owner,
        'percentage-dots',
        JSON.stringify(final),
        JSON.stringify(
          initial.tactical.battle.combatants.map((unit) => ({
            combatant_id: unit.id,
            participant_role: unit.id === 'actor' ? 'player' : 'opponent',
            character_id: unit.id === 'actor' ? character : null,
          })),
        ),
        JSON.stringify(initial),
        JSON.stringify(started.events),
        JSON.stringify({
          schemaVersion: 1,
          commandVisibility: { kind: 'public' },
          eventVisibilityOverrides: [],
        }),
      ],
    )
  for (const change of ['payload', 'quantity', 'source', 'receipt']) {
    const forged = JSON.parse(JSON.stringify(started.state))
    const itemSource = forged.capturedAbilitySources.find((row: typeof equipped) => row.equipment)
    if (change === 'payload') itemSource.definition.behaviors[0].effects[0].payload.amount = 99999
    else if (change === 'quantity') itemSource.equipment.unit.ownedQuantity = 99
    else if (change === 'source')
      itemSource.sourceInstanceId = JSON.stringify([
        'equipment',
        'actor',
        'consumable-1',
        'injected-stack',
        'stock.potion',
        1,
      ])
    else
      forged.itemConsumptionState = {
        version: 1,
        consumed: [{ sourceInstanceId: equipped.sourceInstanceId, count: 1 }],
      }
    await db.exec('savepoint startup_reject')
    await expect(create(forged)).rejects.toThrow('ITEM_STOCK_RECEIPT_INVALID')
    await db.exec('rollback to savepoint startup_reject')
    expect(await inventory()).toEqual(before)
  }
  const result = await create()
  expect(result.rows[0]!.snapshot).toEqual(started.state)
  expect(await inventory()).toEqual(before)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 2 }])
})
it('captures stock in new admissions and atomically consumes one owned unit without replacing its stack', async () => {
  const f = await scenario()
  expect(f.capture.consumptionPolicyVersion).toBe(1)
  expect(f.capture.equipment[0]!.ownedQuantity).toBe(2)
  const initial = await inventory()
  const once = f.use(f.state),
    key = crypto.randomUUID()
  await f.commit(once, 1, key)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
  expect(await inventory()).toMatchObject({
    revision: Number(initial.revision) + 1,
    equipment: { 'consumable-1': f.stack },
  })
  expect((await f.commit(once, 1, key)).rows[0]!.replayed).toBe(true)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
  const twice = f.use(JSON.parse(JSON.stringify(once.state)))
  await f.commit(twice, 2)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([])
  expect(await inventory()).toMatchObject({ revision: Number(initial.revision) + 2, equipment: {} })
  expect(
    (await db.query('select count(*)::int n from app_private.battle_item_consumptions')).rows[0],
  ).toEqual({ n: 2 })
})
it('settles a terminal accepted hit, clears exhausted readiness and never substitutes another owned stack', async () => {
  const f = await scenario(1, true, { terminal: true, spare: true })
  const out = f.use(f.state)
  expect(out.state.tactical.battle.lifecycle).toBe('completed')
  await f.commit(out)
  expect(await inventory()).toMatchObject({ equipment: {} })
  expect(
    (
      await db.query(
        'select id,quantity from app_private.character_item_stacks where character_id=$1',
        [character],
      )
    ).rows,
  ).toEqual([{ id: f.spare, quantity: 7 }])
  const next = (
    await db.query<{ value: BattleEquipmentCapture }>(
      'select public.read_character_battle_equipment_v1($1,$2) value',
      [owner, character],
    )
  ).rows[0]!.value
  expect(next.equipment).toEqual([])
})
it('keeps stock through timeout and delayed ticks, charging only the initial accepted activation', async () => {
  const f = await scenario(2, true, {
    behavior: {
      effects: [
        {
          id: 'hit',
          timing: 'next-round',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    },
  })
  const out = f.use(f.state)
  expect(out.state.pendingEffects).toHaveLength(1)
  await f.commit(out)
  let state = out.state
  for (let i = 0; i < 4; i++) {
    const tick = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      PV1F_COMBAT_CONTENT,
    )
    await f.commit(tick, i + 2)
    state = tick.state
  }
  expect(state.pendingEffects ?? []).toHaveLength(0)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
  expect(
    (await db.query('select count(*)::int n from app_private.battle_item_consumptions')).rows[0],
  ).toEqual({ n: 1 })
})
it('commits Controlled prime and cancel without consumption and accepted release with one unit', async () => {
  const f = await scenario(2, true, {
    behavior: {
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    },
  })
  const input = {
    state: f.state,
    actorId: 'actor',
    sourceInstanceId: f.captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  }
  const prime = primeCombatControlledAbility(input)
  await f.commit(prime)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 2 }])
  await f.commit(f.use(prime.state), 2)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
})
it('commits Controlled cancellation and no-input turns without charging stock', async () => {
  const f = await scenario(2, true, {
    behavior: {
      effects: [
        {
          id: 'hit',
          timing: 'controlled',
          payload: { type: 'damage', recipient: 'primary-unit', amount: 10 },
        },
      ],
    },
  })
  const input = {
    state: f.state,
    actorId: 'actor',
    sourceInstanceId: f.captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  }
  const prime = primeCombatControlledAbility(input),
    cancel = cancelCombatControlledAbility({ ...input, state: prime.state })
  await f.commit(prime)
  await f.commit(cancel, 2)
  const idle = endCombatTurn(
    { ...cancel.state, tactical: selectCurrentFinalFacing(cancel.state.tactical, 'west').state },
    PV1F_COMBAT_CONTENT,
  )
  await f.commit(idle, 3)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 2 }])
  expect(
    (await db.query('select count(*)::int n from app_private.battle_item_consumptions')).rows[0],
  ).toEqual({ n: 0 })
})
it('consumes once when a Reversal Item activation actually arms its effect, including zero AP cost', async () => {
  const f = await scenario(2, true, {
    behavior: {
      classification: 'utility',
      attackFamily: undefined,
      targeting: {
        kind: 'self',
        teamPolicy: 'self',
        friendlyFire: 'allies-only',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        maximumSelections: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
      },
      effects: [
        {
          id: 'reversal',
          timing: 'controlled',
          payload: {
            type: 'reversal',
            recipient: 'actor',
            version: 1,
            family: 'physical',
            reflectionBasisPoints: 10000,
            attackerMaxHpCapBasisPoints: 2000,
            defenderMaxHpCapBasisPoints: 2500,
          },
        },
      ],
    },
  })
  const prime = primeCombatControlledAbility({
    state: f.state,
    actorId: 'actor',
    sourceInstanceId: f.captured.sourceInstanceId,
    behaviorId: 'strike',
    content: PV1F_COMBAT_CONTENT,
  })
  expect(prime.state.itemConsumptionState?.consumed[0]?.count).toBe(1)
  await f.commit(prime)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
  const advanced = endCombatTurn(
    { ...prime.state, tactical: selectCurrentFinalFacing(prime.state.tactical, 'east').state },
    PV1F_COMBAT_CONTENT,
  )
  const incoming = captureCombatAbilitySource({
    ...source({ costs: [], accuracy: { kind: 'fixed', chanceBasisPoints: 10000 } }, 'incoming'),
    ownerCombatantId: 'enemy',
  })
  const ready = reconcileCombatAbilitySources(advanced.state, [f.captured, incoming])
  await f.commit({ state: ready, events: advanced.events }, 2)
  const intercepted = commitCombatAbilityCommand({
    state: ready,
    actorId: 'enemy',
    root: { kind: 'canonical', source: incoming },
    selection: { kind: 'unit', combatantId: 'actor' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(ready, incoming),
  })
  expect(intercepted.events.some((event) => event.event === 'reversal_triggered')).toBe(true)
  await f.commit(intercepted, 3)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
  expect(
    (await db.query('select count(*)::int n from app_private.battle_item_consumptions')).rows[0],
  ).toEqual({ n: 1 })
})
it('leaves historical captures and non-use snapshot commits without inventory consumption', async () => {
  const f = await scenario(2, false),
    before = await inventory()
  await f.commit(f.use(f.state))
  expect(await inventory()).toEqual(before)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 2 }])
})
it('rolls back battle, inventory, events and receipt when the new stock count disagrees with activation usage', async () => {
  const f = await scenario(),
    out = f.use(f.state),
    before = await inventory()
  const bad = {
    ...out,
    state: {
      ...out.state,
      itemConsumptionState: {
        version: 1 as const,
        consumed: [{ sourceInstanceId: f.captured.sourceInstanceId, count: 2 }],
      },
    },
  }
  await db.exec('savepoint reject')
  await expect(f.commit(bad)).rejects.toThrow('ITEM_STOCK_RECEIPT_INVALID')
  await db.exec('rollback to savepoint reject')
  expect(await inventory()).toEqual(before)
  expect(
    (
      await db.query('select current_version from app_private.battle_sessions where id=$1', [
        f.session,
      ])
    ).rows[0],
  ).toEqual({ current_version: 1 })
  expect(
    (
      await db.query(
        'select count(*)::int n from app_private.battle_events where battle_session_id=$1',
        [f.session],
      )
    ).rows[0],
  ).toEqual({ n: 0 })
})
it('rolls inventory settlement back when later privacy-journal validation rejects the battle transaction', async () => {
  const f = await scenario(),
    out = f.use(f.state),
    before = await inventory(),
    key = crypto.randomUUID()
  await db.exec('savepoint invalid_journal')
  await expect(
    db.query(
      'select * from public.commit_battle_intent_v3($1,$2,$3,$4,$5,1,$6::jsonb,$7::jsonb,$8::jsonb)',
      [
        owner,
        key,
        key,
        owner,
        f.session,
        JSON.stringify(out.state),
        JSON.stringify(out.events),
        JSON.stringify({ bad: true }),
      ],
    ),
  ).rejects.toThrow('BATTLE_PRIVACY_JOURNAL_INVALID')
  await db.exec('rollback to savepoint invalid_journal')
  expect(await inventory()).toEqual(before)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 2 }])
  expect(
    (await db.query('select count(*)::int n from app_private.battle_item_consumptions')).rows[0],
  ).toEqual({ n: 0 })
  await f.commit(out, 1, key)
  expect(
    (
      await db.query('select quantity from app_private.character_item_stacks where id=$1', [
        f.stack,
      ])
    ).rows,
  ).toEqual([{ quantity: 1 }])
})
it('rejects stale commits, missing stock, removed receipts and public in-battle inventory changes atomically', async () => {
  const f = await scenario(),
    out = f.use(f.state)
  await db.exec('savepoint stale')
  await expect(f.commit(out, 2)).rejects.toThrow('BATTLE_VERSION_STALE')
  await db.exec('rollback to savepoint stale')
  await expect(
    db.query("select public.grant_character_items_v1($1,$2,2,'during-battle',$3::jsonb)", [
      owner,
      character,
      JSON.stringify([{ itemId: potion.id, quantity: 1 }]),
    ]),
  ).rejects.toThrow('ITEM_BATTLE_ACTIVE')
  await db.exec('rollback to savepoint stale')
  await f.commit(out)
  const twice = f.use(out.state)
  await db.exec('savepoint removed')
  await expect(
    f.commit({ ...twice, state: { ...twice.state, itemConsumptionState: undefined } }, 2),
  ).rejects.toThrow('ITEM_STOCK_RECEIPT_INVALID')
  await db.exec('rollback to savepoint removed')
  await db.query('delete from app_private.character_item_stacks where id=$1', [f.stack])
  await db.exec('savepoint missing')
  await expect(f.commit(twice, 2)).rejects.toThrow('ITEM_STOCK_STALE')
  await db.exec('rollback to savepoint missing')
  expect(
    (
      await db.query('select current_version from app_private.battle_sessions where id=$1', [
        f.session,
      ])
    ).rows[0],
  ).toEqual({ current_version: 2 })
})
it('keeps settlement helpers and receipts private and immutable', async () => {
  const f = await scenario()
  await f.commit(f.use(f.state))
  await db.exec('savepoint immutable')
  await expect(
    db.query('update app_private.battle_item_consumptions set quantity=2'),
  ).rejects.toThrow('ITEM_STOCK_RECEIPT_IMMUTABLE')
  await db.exec('rollback to savepoint immutable')
  for (const role of ['anon', 'authenticated', 'service_role']) {
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'app_private.settle_battle_item_stock_v1()','EXECUTE') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1,'app_private.battle_item_consumptions','SELECT') allowed",
          [role],
        )
      ).rows[0]!.allowed,
    ).toBe(false)
  }
})
