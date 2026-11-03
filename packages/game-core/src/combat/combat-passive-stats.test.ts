import { expect, it } from 'vitest'
import { source } from './combat-behavior.test-utils'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { activateCombatAbilitySources } from './combat-ability-command'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { getStatDrivenCombatProfile } from './stat-driven-combat'
import { finishPv1fTurn, PV1F_COMBAT_CONTENT, preparePv1fTurnEconomy } from './pv1f-action-economy'
import { validateCombatEncounterState } from './actions'
import type { CombatTagPayload } from './combat-tag-registry'

function passive(stat: string, amount: number) {
  return source({
    activation: 'ongoing',
    mode: 'modifier',
    classification: 'utility',
    attackFamily: undefined,
    targeting: null,
    costs: [],
    effects: [
      {
        id: 'bonus',
        payload: { type: 'stat-bonus', recipient: 'actor', stat, amount } as CombatTagPayload,
      },
    ],
  })
}
it.each([1, 2])(
  'captures Movement +%i at startup and each own turn without changing the base',
  (amount) => {
    const base = preparePv1fTurnEconomy(percentageDotEncounter())
    let state = activateCombatAbilitySources(
      base,
      [passive('movement', amount)],
      PV1F_COMBAT_CONTENT,
      true,
    ).state
    expect(state.tactical.battle.currentTurn).toMatchObject({
      movementBonusAtTurnStart: amount,
      movementMaximum: 4 + amount,
      movementRemaining: 4 + amount,
    })
    expect(state.tactical.battle.combatants[0]!.baseMovementBudget).toBe(4)
    expect(validateCombatEncounterState(state)).toEqual([])
    state = reconcileCombatAbilitySources(JSON.parse(JSON.stringify(state)), [
      passive('movement', amount),
    ])
    expect(state.tactical.battle.currentTurn?.movementMaximum).toBe(4 + amount)
    do {
      state = finishPv1fTurn(state as never, 'east').state
    } while (state.tactical.battle.currentTurn?.combatantId !== 'actor')
    expect(state.tactical.battle.currentTurn).toMatchObject({
      movementMaximum: 4 + amount,
      movementBonusAtTurnStart: amount,
    })
    state = reconcileCombatAbilitySources(state, [])
    expect(state.tactical.battle.currentTurn?.movementMaximum).toBe(4 + amount)
    do {
      state = finishPv1fTurn(state as never, 'east').state
    } while (state.tactical.battle.currentTurn?.combatantId !== 'actor')
    expect(state.tactical.battle.currentTurn?.movementMaximum).toBe(4)
  },
)
it.each([
  ['physical-power', 'physicalPower', 20],
  ['mystic-power', 'mysticPower', 20],
  ['physical-defense', 'armor', 0],
  ['mystic-defense', 'ward', 0],
  ['evasion', 'evasion', 0],
  ['jump', 'jump', 0],
] as const)('reads effective %s without mutating persisted base', (stat, field, base) => {
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [passive(stat, 2)])
  expect(getStatDrivenCombatProfile(state as never, 'actor')[field]).toBe(base + 2)
  expect(
    (
      state.statBridge!.combatants.find(
        (row) => row.combatantId === 'actor',
      )! as import('./stat-driven-combat').StatDrivenCombatProfile
    )[field],
  ).toBe(base)
  expect(validateCombatEncounterState(state)).toEqual([])
})

it('uses effective power and defense in direct canonical packets', async () => {
  const { commitCombatAbilityCommand } = await import('./combat-ability-command')
  const { combatAbilityCommandContext } = await import('./combat-behavior-runtime')
  const attack = source(
    {
      costs: [],
      effects: [
        {
          id: 'hit',
          payload: {
            type: 'damage',
            recipient: 'primary-unit',
            amount: 10,
            scaling: { source: 'physical-power', coefficientBasisPoints: 10000 },
            defenseKind: 'armor',
          },
        },
      ],
    },
    'attack',
  )
  const defense = {
    ...passive('physical-defense', 100),
    sourceInstanceId: 'defense',
    ownerCombatantId: 'enemy',
  }
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [
    passive('physical-power', 10),
    defense,
    attack,
  ])
  const out = commitCombatAbilityCommand({
    state,
    actorId: 'actor',
    root: { kind: 'canonical', source: attack },
    selection: { kind: 'unit', combatantId: 'enemy' },
    content: PV1F_COMBAT_CONTENT,
    context: combatAbilityCommandContext(state, attack),
  })
  expect(out.events.find((event) => event.event === 'damage_applied')).toMatchObject({ amount: 20 })
})
it('uses Evasion basis points in actual packet accuracy', async () => {
  const { forecastCombatSkillAccuracyForTarget } = await import('./combat-skill-accuracy')
  const { materializeCombatAbilityAction } = await import('./combat-behavior-runtime')
  const attack = source({ accuracy: { kind: 'standard' } })
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [
    { ...passive('evasion', 100), ownerCombatantId: 'enemy' },
  ])
  const action = materializeCombatAbilityAction(attack, attack.definition.behaviors[0]!)
  expect(
    forecastCombatSkillAccuracyForTarget(state, action, 'actor', 'enemy', PV1F_COMBAT_CONTENT)
      ?.hitChanceBasisPoints,
  ).toBe(9900)
})
it('uses passive power in normalized summon potential', async () => {
  const { combatantDamagePotential } = await import('./combat-summon-potential')
  const base = percentageDotEncounter()
  const state = reconcileCombatAbilitySources(base, [passive('physical-power', 20)])
  expect(combatantDamagePotential(state as never, 'actor')).toBeGreaterThan(
    combatantDamagePotential(base, 'actor'),
  )
})
it('composes Initiative bonus before Drenched without reordering current or acted units', async () => {
  const { synchronizeCombatInitiative } = await import('./actions')
  const base = {
    ...percentageDotEncounter(),
    dynamicInitiativePolicyVersion: 1 as const,
    elementalDamagePolicyVersion: 2 as const,
  }
  const state = reconcileCombatAbilitySources(
    {
      ...base,
      statusState: base.statusState.map((row) =>
        row.combatantId === 'ally'
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'wet',
                  sourceCombatantId: 'enemy',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  initiativeReductionBasisPoints: 5000,
                },
              ],
            }
          : row,
      ),
    },
    [{ ...passive('initiative', 100), ownerCombatantId: 'ally' }],
  )
  const out = synchronizeCombatInitiative(state)
  expect(out.tactical.battle.currentTurn?.combatantId).toBe('actor')
  expect(out.tactical.battle.initiativeOrder).toEqual(['actor', 'ally', 'enemy', 'other'])
  expect(out.tactical.battle.activeInitiativeModifiers).toContainEqual({
    combatantId: 'ally',
    amount: 45,
  })
})
it('applies passive Jump to ordinary movement without rewriting movement profiles', async () => {
  const { evaluatePv1fMovement } = await import('./pv1f-action-economy')
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const elevated = {
    ...base,
    tactical: {
      ...base.tactical,
      tiles: base.tactical.tiles.map((tile) =>
        tile.position.x === 0 && tile.position.y === 1 ? { ...tile, elevation: 1 } : tile,
      ),
    },
  }
  const path = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  expect(evaluatePv1fMovement(elevated, path).movement.legal).toBe(false)
  const active = reconcileCombatAbilitySources(elevated, [passive('jump', 1)])
  expect(evaluatePv1fMovement(active as never, path).movement.issues).toEqual([])
  expect(active.tactical.movementProfiles).toEqual(base.tactical.movementProfiles)
})
it('preserves spent Movement/AP/terrain costs and defers conditional changes until next own turn', async () => {
  const { executePv1fMovement, evaluatePv1fMovement, readPv1fActionEconomy } =
    await import('./pv1f-action-economy')
  const gear = passive('movement', 1)
  const conditional = {
    ...gear,
    definition: {
      ...gear.definition,
      behaviors: gear.definition.behaviors.map((behavior) => ({
        ...behavior,
        requirements: {
          kind: 'resource-state' as const,
          subject: 'owner' as const,
          resource: 'hp' as const,
          comparison: 'at-least' as const,
          amount: 900,
        },
      })),
    },
  }
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  let state = activateCombatAbilitySources(base, [conditional], PV1F_COMBAT_CONTENT, true).state
  const path = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  const cost = evaluatePv1fMovement(state as never, path).economyCost
  expect(cost).toBeGreaterThan(0)
  state = executePv1fMovement(state as never, path).state
  expect(readPv1fActionEconomy(state as never)?.current).toBe(100 - cost)
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementSpent: 1,
    movementRemaining: 4,
    movementMaximum: 5,
  })
  state = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        combatants: state.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 500 } : unit,
        ),
      },
    },
  }
  state = reconcileCombatAbilitySources(JSON.parse(JSON.stringify(state)), [conditional])
  state = preparePv1fTurnEconomy(state as never)
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementSpent: 1,
    movementRemaining: 4,
    movementMaximum: 5,
  })
  expect(readPv1fActionEconomy(state as never)?.current).toBe(100 - cost)
  do {
    state = finishPv1fTurn(state as never, 'east').state
  } while (state.tactical.battle.currentTurn?.combatantId !== 'actor')
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementBonusAtTurnStart: 0,
    movementMaximum: 4,
    movementRemaining: 4,
  })
  expect(validateCombatEncounterState(state)).toEqual([])
  const forged = {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...state.tactical.battle,
        currentTurn: {
          ...state.tactical.battle.currentTurn!,
          movementMaximum: 5,
          movementRemaining: 5,
        },
      },
    },
  }
  expect(validateCombatEncounterState(forged)).toContainEqual(
    expect.objectContaining({ field: 'tactical.battle.currentTurn.movementMaximum' }),
  )
})
it('rejects unsupported passive stats, wrong activation, noninteger amounts and extra fields', async () => {
  const { validateCombatTagPayload } = await import('./combat-tag-registry')
  const good = { type: 'stat-bonus', recipient: 'actor', stat: 'movement', amount: 1 }
  for (const invalid of [
    { ...good, stat: 'speed' },
    { ...good, amount: -1 },
    { ...good, amount: 0.5 },
    { ...good, target: 'enemy' },
    { ...good, recipient: 'primary-unit' },
  ])
    expect(validateCombatTagPayload(invalid)).not.toEqual([])
  expect(validateCombatTagPayload(good, { activation: 'manual', mode: 'action' })).not.toEqual([])
})
it('captures own-turn Movement conditions after the normal AP refresh', async () => {
  const { executePv1fMovement } = await import('./pv1f-action-economy')
  const gear = passive('movement', 1)
  const conditional = {
    ...gear,
    definition: {
      ...gear.definition,
      behaviors: gear.definition.behaviors.map((behavior) => ({
        ...behavior,
        requirements: {
          kind: 'resource-state' as const,
          subject: 'owner' as const,
          resource: 'ap' as const,
          comparison: 'at-least' as const,
          amount: 100,
        },
      })),
    },
  }
  let state = activateCombatAbilitySources(
    preparePv1fTurnEconomy(percentageDotEncounter()),
    [conditional],
    PV1F_COMBAT_CONTENT,
    true,
  ).state
  state = executePv1fMovement(state as never, [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]).state
  do {
    state = finishPv1fTurn(state as never, 'east').state
  } while (state.tactical.battle.currentTurn?.combatantId !== 'actor')
  expect(state.tactical.battle.currentTurn).toMatchObject({
    movementBonusAtTurnStart: 1,
    movementMaximum: 5,
  })
})
