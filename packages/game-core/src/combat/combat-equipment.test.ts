import { combatantDamagePotential } from './combat-summon-potential'
import { expect, it } from 'vitest'
import { itemFixture } from '../content/items-test-fixtures'
import { source } from './combat-behavior.test-utils'
import {
  compileEquipmentAbility,
  equipmentActionId,
  parseBattleEquipmentCapture,
  type BattleEquipmentCapture,
} from './combat-equipment'
import { captureEquipmentAbilitySource } from './combat-behavior-capture'
import {
  activateCombatAbilitySources,
  commitCombatAbilityCommand,
  prepareCombatAbilityCommand,
  combatAbilityRemainingUses,
} from './combat-ability-command'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { combatAbilityCommandContext } from './combat-behavior-runtime'
import { PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy } from './pv1f-action-economy'
import { combatStatBonus } from './combat-stat-bonuses'
import { starterItemDefinitions } from '../content/starter-items'
import type { EquipmentPosition } from '../character/item-inventory'

it('admits current main-hand and separate consumable captures while retaining literal six-slot history', () => {
  const definitions = starterItemDefinitions()
  const current: BattleEquipmentCapture = {
    schemaVersion: 2,
    inventoryRevision: 1,
    selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
    equipment: [
      ['main-hand', 'sunsplitter'],
      ['consumable-1', 'mender-salve'],
      ['consumable-2', 'ward-sigil-scroll'],
    ].map(([position, id], index) => ({
      position: position as EquipmentPosition,
      ownedStackId: `unit-${index}`,
      item: definitions.find((item) => item.id === id)!,
    })),
  }
  expect(parseBattleEquipmentCapture(current)).toEqual(current)
  expect(() => parseBattleEquipmentCapture({ ...current, schemaVersion: 1 })).toThrow()
  expect(() =>
    parseBattleEquipmentCapture({
      ...current,
      equipment: [{ ...current.equipment[1]!, position: 'off-hand' }],
    }),
  ).toThrow()
  expect(() =>
    parseBattleEquipmentCapture({
      ...current,
      equipment: [current.equipment[0]!, { ...current.equipment[2]!, position: 'off-hand' }],
    }),
  ).toThrow()
})

const weapon = itemFixture({
  id: 'test.sword',
  itemClass: 'weapon',
  equipment: { slot: 'hand', hands: 1 },
  ability: {
    schemaVersion: 1,
    behaviors: [
      source().definition.behaviors[0]!,
      { ...source().definition.behaviors[0]!, id: 'support' },
      {
        id: 'passive',
        activation: 'ongoing',
        mode: 'modifier',
        classification: 'utility',
        targeting: null,
        costs: [],
        cooldown: null,
        requirements: null,
        effects: [
          {
            id: 'power',
            payload: { type: 'stat-bonus', recipient: 'actor', stat: 'physical-power', amount: 4 },
          },
        ],
      },
    ],
  },
  actions: {
    attack: { behaviorId: 'strike', name: 'Cut' },
    support: { behaviorId: 'support', name: 'Brace' },
  },
})
const capture = (): BattleEquipmentCapture => ({
  schemaVersion: 1,
  inventoryRevision: 3,
  selectedSupport: {
    kind: 'equipment',
    position: 'main-hand',
    itemId: weapon.id,
    behaviorId: 'support',
  },
  equipment: [
    { position: 'main-hand', ownedStackId: 'owned-main', item: weapon },
    { position: 'off-hand', ownedStackId: 'owned-off', item: weapon },
  ],
})

it('compiles one passive per equipped unit and only the selected attack and Support capabilities', () => {
  const equipped = capture()
  expect(
    compileEquipmentAbility(equipped, equipped.equipment[0]!).behaviors.map((x) => x.id),
  ).toEqual(['strike', 'support', 'passive'])
  expect(
    compileEquipmentAbility(equipped, equipped.equipment[1]!).behaviors.map((x) => x.id),
  ).toEqual(['passive'])
  expect(equipped.equipment[1]!.item.ability!.behaviors).toHaveLength(3)
})
it('uses safe position and role identities, independently of private unit identity', () => {
  expect(equipmentActionId(capture().equipment[0]!, 'attack')).toBe(
    'item.test.sword.main-hand.attack',
  )
  expect(equipmentActionId(capture().equipment[1]!, 'attack')).toBe(
    'item.test.sword.off-hand.attack',
  )
})
it('executes the authored weapon as Basic Attack and activates each unit passive once', () => {
  const equipment = capture()
  const sources = equipment.equipment.map((unit) =>
    captureEquipmentAbilitySource(equipment, unit, 'actor')!,
  )
  const state = activateCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    sources,
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  expect(combatStatBonus(state, 'actor', 'physical-power')).toBe(8)
  const quote = prepareCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: sources[0]!, behaviorId: 'strike' },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, sources[0]!),
  })
  expect(quote.action.sourceType).toBe('basic-attack')
  expect(quote.action.nativeBasicAttackCommand).toBe(true)
  expect(quote.action.effects[0]).toMatchObject({ type: 'damage', amount: 10 })
  expect(() =>
    prepareCombatAbilityCommand({
      state,
      actorId: 'actor',
      root: { kind: 'canonical', source: sources[1]!, behaviorId: 'strike' },
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, sources[1]!),
    }),
  ).toThrow('ability-action-behavior-required')
})
it.each([1, 2] as const)(
  'charges schema %i supplies independently through actual payment, retains a narrower cap, and survives reload',
  (schemaVersion) => {
    const behavior = {
      ...source().definition.behaviors[0]!,
      costs: [{ resource: 'ap' as const, amount: 10 }],
      maximumUsesPerBattle: 1,
    }
    const item = itemFixture({
      id: 'test.tonic',
      itemClass: 'battle-item',
      inventoryCategory: 'battle-items',
      equipment: { slot: 'hand', hands: 1 },
      maximumStack: 99,
      battleUses: 3,
      ability: { schemaVersion: 1, behaviors: [behavior] },
      actions: { use: { behaviorId: 'strike', name: 'Throw' } },
    })
    const equipment: BattleEquipmentCapture = {
      schemaVersion,
      inventoryRevision: 1,
      selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
      equipment: (schemaVersion === 1
        ? ['main-hand', 'off-hand']
        : ['consumable-1', 'consumable-2']
      ).map((position) => ({
        position: position as EquipmentPosition,
        ownedStackId: 'same-private-stack',
        item,
      })),
    }
    const sources = equipment.equipment.map((unit) =>
      captureEquipmentAbilitySource(equipment, unit, 'actor')!,
    )
    let state = activateCombatAbilitySources(
      preparePv1fTurnEconomy(percentageDotEncounter()),
      sources,
      PV1F_COMBAT_CONTENT,
      true,
    ).state
    const command = () => ({
      state,
      actorId: 'actor',
      root: { kind: 'canonical' as const, source: sources[0]! },
      selection: { kind: 'unit' as const, combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(state, sources[0]!),
    })
    expect(prepareCombatAbilityCommand(command()).evaluation.legal).toBe(true)
    const before = structuredClone(state)
    prepareCombatAbilityCommand(command())
    expect(state).toEqual(before)
    const committed = commitCombatAbilityCommand(command())
    state = JSON.parse(JSON.stringify(committed.state))
    expect(
      combatAbilityRemainingUses(state, sources[0]!, sources[0]!.definition.behaviors[0]!),
    ).toBe(0)
    expect(
      combatAbilityRemainingUses(state, sources[1]!, sources[1]!.definition.behaviors[0]!),
    ).toBe(1)
    expect(prepareCombatAbilityCommand(command()).evaluation.legal).toBe(false)
    expect(() => commitCombatAbilityCommand(command())).toThrow()
    expect(state).toEqual(committed.state)
  },
)

it('keeps authored weapon accuracy and scaling through the Basic adapter', () => {
  const equipment = capture()
  const authored = equipment.equipment[0]!.item.ability!.behaviors[0]!
  const item = {
    ...equipment.equipment[0]!.item,
    ability: {
      schemaVersion: 1 as const,
      behaviors: [
        {
          ...authored,
          accuracy: { kind: 'fixed' as const, chanceBasisPoints: 7500 },
          effects: [
            {
              id: 'hit',
              payload: {
                type: 'damage' as const,
                recipient: 'primary-unit' as const,
                amount: 13,
                scaling: { source: 'physical-power' as const, coefficientBasisPoints: 6500 },
              },
            },
          ],
        },
        equipment.equipment[0]!.item.ability!.behaviors[1]!,
      ],
    },
  }
  const equipped = { ...equipment, equipment: [{ ...equipment.equipment[0]!, item }] }
  const captured = captureEquipmentAbilitySource(equipped, equipped.equipment[0]!, 'actor')!
  const state = activateCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    [captured],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  const quote = prepareCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: captured, behaviorId: 'strike' },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  expect(quote.evaluation.legal).toBe(true)
  expect(quote.action).toMatchObject({
    sourceType: 'basic-attack',
    accuracyRule: { kind: 'fixed', chanceBasisPoints: 7500 },
    effects: [
      {
        type: 'damage',
        amount: 13,
        scaling: { source: 'physical-power', coefficientBasisPoints: 6500 },
      },
    ],
  })
})

it('omits unadmitted off-hand and Support damage and replaces unarmed summon potential', () => {
  const equipment = capture()
  const selected = {
    ...equipment,
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
  }
  const sources = selected.equipment.map((unit) =>
    captureEquipmentAbilitySource(selected, unit, 'actor')!,
  )
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = activateCombatAbilitySources(base, sources, PV1F_COMBAT_CONTENT, true).state
  const single = activateCombatAbilitySources(base, [sources[0]!], PV1F_COMBAT_CONTENT, true).state
  expect(combatantDamagePotential({ ...state, statBridge: base.statBridge }, 'actor')).toBe(
    combatantDamagePotential({ ...single, statBridge: base.statBridge }, 'actor'),
  )
  expect(combatantDamagePotential({ ...state, statBridge: base.statBridge }, 'actor')).toBe(90)
})

it('keeps weapon Basic Attack exempt from Frozen Ground while its Support pays the ordinary surcharge', () => {
  const equipment = capture()
  const captured = captureEquipmentAbilitySource(equipment, equipment.equipment[0]!, 'actor')!
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = activateCombatAbilitySources(
    {
      ...base,
      frozenGroundPolicyVersion: 1,
      terrainOverlays: [
        {
          kind: 'frozen',
          frozenGroundPolicyVersion: 1,
          position: { x: 1, y: 1 },
          remainingRoundBoundaries: 2,
          sourceCombatantId: 'enemy',
          skillApSurcharge: 27,
        },
      ],
    },
    [captured],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  const command = (behaviorId: string) => ({
    state,
    actorId: 'actor',
    root: { kind: 'canonical' as const, source: captured, behaviorId },
    selection: { kind: 'unit' as const, combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, captured),
  })
  const attack = commitCombatAbilityCommand(command('strike')).state
  const support = commitCombatAbilityCommand(command('support')).state
  const ap = (value: typeof state) =>
    value.tactical.battle.combatants
      .find((x) => x.id === 'actor')!
      .temporaryResources.find((x) => x.key === 'pv1f.action-economy')!.current
  expect(ap(attack)).toBe(89)
  expect(ap(support)).toBe(62)
})

it('captures initial Movement after equipped passives without rewriting the raw budget', () => {
  const original = capture()
  const item = {
    ...weapon,
    ability: {
      schemaVersion: 1 as const,
      behaviors: [
        {
          ...weapon.ability!.behaviors[2]!,
          effects: [
            {
              id: 'move',
              payload: {
                type: 'stat-bonus' as const,
                recipient: 'actor' as const,
                stat: 'movement' as const,
                amount: 2,
              },
            },
          ],
        },
      ],
    },
    actions: undefined,
  }
  const equipment = {
    ...original,
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
    equipment: [{ ...original.equipment[0]!, item: { ...item, itemClass: 'hand-armor' as const } }],
  }
  const source = captureEquipmentAbilitySource(equipment, equipment.equipment[0]!, 'actor')!
  const state = activateCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    [source],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  expect(state.tactical.battle.combatants.find((x) => x.id === 'actor')!.baseMovementBudget).toBe(4)
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementBonusAtTurnStart: 2,
    movementMaximum: 6,
    movementRemaining: 6,
  })
})

it('uses the off-hand weapon only when the main hand has no weapon', () => {
  const equipment = capture()
  const off = equipment.equipment[1]!
  expect(compileEquipmentAbility(equipment, off).behaviors.map((x) => x.id)).not.toContain('strike')
  const fallback = {
    ...equipment,
    selectedSupport: { kind: 'basic' as const, actionId: 'basic.recover' as const },
    equipment: [off],
  }
  expect(compileEquipmentAbility(fallback, off).behaviors.map((x) => x.id)).toEqual([
    'strike',
    'passive',
  ])
})
