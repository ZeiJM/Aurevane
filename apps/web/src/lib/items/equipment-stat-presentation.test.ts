import { expect, it } from 'vitest'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import type { ItemInventorySnapshot } from '@aurevane/game-core/character/item-inventory'
import { captureEquipmentAbilitySource } from '@aurevane/game-core/combat/combat-behavior-capture'
import type { BattleEquipmentCapture } from '@aurevane/game-core/combat/combat-equipment'
import {
  activateCombatAbilitySources,
  commitCombatAbilityCommand,
} from '@aurevane/game-core/combat/combat-ability-command'
import { combatAbilityCommandContext } from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  combatStatBonus,
  effectiveCombatStatProfile,
} from '@aurevane/game-core/combat/combat-stat-bonuses'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { percentageDotEncounter } from '../../../../../packages/game-core/src/combat/combat-percentage-dots.test-utils'
import { source } from '../../../../../packages/game-core/src/combat/combat-behavior.test-utils'
import { equipmentStatBonuses, equippedStatValue } from './equipment-stat-presentation'

const catalogue = Object.fromEntries(starterItemDefinitions().map((item) => [item.id, item]))
const snapshot: ItemInventorySnapshot = {
  characterId: 'hero',
  revision: 1,
  stacks: ['ember-stitched-cowl', 'galewalker-boots', 'iron-shortsword'].map((id, index) => ({
    id,
    itemId: id,
    characterId: 'hero',
    inventoryCategory: 'gear',
    slotIndex: index,
    quantity: 1,
    acquiredAt: '',
    acquiredContentVersion: 1,
    provenance: 'private-receipt',
  })),
  equipment: { head: 'ember-stitched-cowl', boots: 'galewalker-boots' },
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  previousBasicSupport: 'basic.recover',
  grants: [],
}
it('projects only equipped ongoing bonuses by source and adds boots after base Movement caps', () => {
  const before = JSON.stringify(snapshot)
  const bonuses = equipmentStatBonuses(snapshot, catalogue)
  expect(bonuses).toContainEqual(
    expect.objectContaining({
      itemName: 'Ember-Stitched Cowl',
      stat: 'mystic-power',
      amount: 12,
      conditional: false,
    }),
  )
  expect(bonuses.some((bonus) => bonus.itemId === 'iron-shortsword')).toBe(false)
  const base = calculateDerivedStats({
    attributes: { might: 60, finesse: 60, vitality: 60, agility: 60, intellect: 60, resolve: 60 },
    level: 100,
  })
  expect(equippedStatValue(base.stats.movement, bonuses).stat.value).toBe(
    base.stats.movement.value + 2,
  )
  expect(equippedStatValue(base.stats.mysticPower, bonuses).delta).toBe(12)
  expect(JSON.stringify(snapshot)).toBe(before)
  expect(JSON.stringify(bonuses)).not.toContain('private-receipt')
})
it('keeps conditional amounts out of current totals and applies the same Evasion cap as battle', () => {
  const base = calculateDerivedStats({
    attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
    level: 1,
  }).stats.evasion
  const source = {
    itemId: 'gear',
    itemName: 'Gear',
    position: 'boots' as const,
    stat: 'evasion' as const,
    amount: 10000,
    conditional: false,
  }
  expect(equippedStatValue(base, [source]).stat.value).toBe(10000)
  expect(equippedStatValue(base, [{ ...source, conditional: true }]).delta).toBe(0)
  expect(equippedStatValue(base, [{ ...source, amount: -100 }]).delta).toBe(-100)
  expect(equipmentStatBonuses({ ...snapshot, equipment: {} }, catalogue)).toEqual([])
})

it('matches captured equipment battle power and movement, including actual mystic damage and reload', () => {
  const capture: BattleEquipmentCapture = {
    schemaVersion: 1,
    inventoryRevision: snapshot.revision,
    selectedSupport: snapshot.selectedSupport,
    equipment: [
      {
        position: 'head',
        ownedStackId: 'ember-stitched-cowl',
        item: catalogue['ember-stitched-cowl']!,
      },
      { position: 'boots', ownedStackId: 'galewalker-boots', item: catalogue['galewalker-boots']! },
    ],
  }
  const gearSources = capture.equipment.map((unit) =>
    captureEquipmentAbilitySource(capture, unit, 'actor')!,
  )
  const attack = source(
    {
      attackFamily: 'mystic',
      costs: [],
      effects: [
        {
          id: 'hit',
          payload: {
            type: 'damage',
            recipient: 'primary-unit',
            amount: 10,
            scaling: { source: 'mystic-power', coefficientBasisPoints: 10000 },
            defenseKind: 'ward',
          },
        },
      ],
    },
    'mystic-attack',
  )
  const base = percentageDotEncounter()
  const before = JSON.stringify(base)
  const ready = (equipped: boolean) =>
    activateCombatAbilitySources(
      base,
      [...(equipped ? gearSources : []), attack],
      PV1F_COMBAT_CONTENT,
      true,
    ).state
  const state = ready(true)
  expect(combatStatBonus(state, 'actor', 'mystic-power')).toBe(12)
  expect(effectiveCombatStatProfile(state, 'actor')!.mysticPower).toBe(32)
  expect(state.statBridge!.combatants.find((row) => row.combatantId === 'actor')).toMatchObject({
    mysticPower: 20,
  })
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementMaximum: 6,
    movementRemaining: 6,
    movementBonusAtTurnStart: 2,
  })
  expect(
    state.tactical.battle.combatants.find((row) => row.id === 'actor')!.baseMovementBudget,
  ).toBe(4)
  const bonuses = equipmentStatBonuses(snapshot, catalogue)
  const profileBase = calculateDerivedStats({
    attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
    level: 1,
  })
  expect(equippedStatValue(profileBase.stats.mysticPower, bonuses).delta).toBe(
    combatStatBonus(state, 'actor', 'mystic-power'),
  )
  expect(equippedStatValue(profileBase.stats.movement, bonuses).delta).toBe(
    combatStatBonus(state, 'actor', 'movement'),
  )
  const damage = (equipped: boolean) => {
    const current = ready(equipped)
    const result = commitCombatAbilityCommand({
      state: current,
      actorId: 'actor',
      root: { kind: 'canonical', source: attack },
      selection: { kind: 'unit', combatantId: 'enemy' },
      content: PV1F_COMBAT_CONTENT,
      context: combatAbilityCommandContext(current, attack),
    })
    return result.events
      .filter((event) => event.event === 'damage_applied')
      .map((event) => event.amount)
  }
  expect(damage(false)).toEqual([30])
  expect(damage(true)).toEqual([42])
  expect(effectiveCombatStatProfile(JSON.parse(JSON.stringify(state)), 'actor')!.mysticPower).toBe(
    32,
  )
  expect(JSON.stringify(base)).toBe(before)
})

it('marks conditional equipment sources without claiming they are active in roaming', () => {
  const item = catalogue['ember-stitched-cowl']!
  const conditionalItem = {
    ...item,
    ability: {
      ...item.ability!,
      behaviors: item.ability!.behaviors.map((behavior) => ({
        ...behavior,
        requirements: {
          kind: 'resource-state' as const,
          subject: 'owner' as const,
          resource: 'hp' as const,
          comparison: 'at-most' as const,
          basisPoints: 5000,
        },
      })),
    },
  }
  const bonuses = equipmentStatBonuses(snapshot, { ...catalogue, [item.id]: conditionalItem })
  expect(bonuses.find((bonus) => bonus.itemId === item.id)).toMatchObject({
    amount: 12,
    conditional: true,
  })
  const base = calculateDerivedStats({
    attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
    level: 1,
  }).stats.mysticPower
  expect(equippedStatValue(base, bonuses)).toMatchObject({
    delta: 0,
    stat: { value: base.value },
    sources: [expect.objectContaining({ itemName: 'Ember-Stitched Cowl', conditional: true })],
  })
})

it('sums multiple equipped sources once and reports only the realized capped delta', () => {
  const base = calculateDerivedStats({
    attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
    level: 1,
  }).stats.evasion
  const sources = [
    {
      itemId: 'hood',
      itemName: 'Hood',
      position: 'head' as const,
      stat: 'evasion' as const,
      amount: 100,
      conditional: false,
    },
    {
      itemId: 'boots',
      itemName: 'Boots',
      position: 'boots' as const,
      stat: 'evasion' as const,
      amount: 200,
      conditional: false,
    },
  ]
  expect(equippedStatValue(base, sources).delta).toBe(300)
  expect(equippedStatValue({ ...base, value: 9900 }, sources)).toMatchObject({
    delta: 100,
    stat: { value: 10000 },
    sources,
  })
})

it('uses the battle Evasion ceiling after stacking gear without mutating the base', () => {
  const passive = source({
    activation: 'ongoing',
    mode: 'modifier',
    classification: 'utility',
    attackFamily: undefined,
    targeting: null,
    costs: [],
    effects: [
      {
        id: 'evasion',
        payload: { type: 'stat-bonus', recipient: 'actor', stat: 'evasion', amount: 10000 },
      },
    ],
  })
  const encounter = percentageDotEncounter()
  const base = {
    ...encounter,
    statBridge: {
      ...encounter.statBridge!,
      combatants: encounter.statBridge!.combatants.map((profile) =>
        profile.combatantId === 'actor' ? { ...profile, evasion: 300 } : profile,
      ),
    },
  }
  const battle = activateCombatAbilitySources(base, [passive], PV1F_COMBAT_CONTENT, true).state
  const profileBase = calculateDerivedStats({
    attributes: { might: 6, finesse: 6, vitality: 6, agility: 6, intellect: 6, resolve: 6 },
    level: 1,
  }).stats.evasion
  const projected = equippedStatValue({ ...profileBase, value: 300 }, [
    {
      itemId: 'hood',
      itemName: 'Hood',
      position: 'head',
      stat: 'evasion',
      amount: 10000,
      conditional: false,
    },
  ])
  expect(projected.stat.value).toBe(effectiveCombatStatProfile(battle, 'actor')!.evasion)
  expect(projected).toMatchObject({ delta: 9700, stat: { value: 10000 } })
  expect(
    base.statBridge.combatants.find((profile) => profile.combatantId === 'actor')!.evasion,
  ).toBe(300)
})
