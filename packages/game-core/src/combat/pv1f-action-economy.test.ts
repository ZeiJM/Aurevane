import { describe, expect, it } from 'vitest'

import { resolveMatureSkillVersion, type MatureSkillDefinition } from './mature-skills'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { normalizeCombatEffectState } from './combat-effect-state'
import { createTacticalBattleState } from './board'
import {
  calculatePv1fBasicAttackDamage,
  createPv1fTemporaryResources,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
  executePv1fAction,
  executePv1fMatureSkill,
  finishPv1fTurn,
  readPv1fActionCooldown,
  readPv1fActionEconomy,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_GUARD_COST,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_MP_RECOVER_COST,
  PV1F_RECOVER_ACTION_ID,
  PV1F_RECOVERY_COOLDOWN_OWNER_TURNS,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
  STAT_DRIVEN_COMBAT_RULES_VERSION,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'player' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'player' ? 'character:test-player' : 'scenario:test-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function lethalEncounter(actorId: 'player' | 'recruit'): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const playerActsFirst = actorId === 'player'
  const pending = createPendingBattle({
    battleId: `battle:pv1f-lethal:${actorId}`,
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 123_456_789,
    combatants: [
      {
        id: 'player',
        teamId: 'players',
        initiative: playerActsFirst ? 20 : 10,
        baseMovementBudget: 4,
        hp: playerActsFirst ? 50 : 1,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(50),
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: playerActsFirst ? 10 : 20,
        baseMovementBudget: 4,
        hp: playerActsFirst ? 1 : 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(50),
      },
    ],
  })
  const active = startBattle(pending).state
  const tactical = createTacticalBattleState({
    battle: active,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: playerProfile.jump, terrainCostOverrides: [] },
      { id: 'recruit-ground', maxElevationStep: recruitProfile.jump, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    playerProfile,
    recruitProfile,
  ])
}

function currentPowerEncounter(): StatDrivenCombatEncounterState {
  const state = lethalEncounter('player')
  const recruit = state.tactical.battle.combatants.find(
    (combatant) => combatant.id === 'recruit',
  )
  if (!recruit) throw new Error('Expected recruit combatant.')
  recruit.hp = 100
  recruit.maxHp = 100
  return {
    ...state,
    statBridge: {
      schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_VERSION,
      combatants: state.statBridge.combatants.map((row) => ({
        ...row,
        physicalPower: row.combatantId === 'player' ? 40 : 32,
        mysticPower: row.combatantId === 'player' ? 44 : 32,
      })),
    },
  }
}

function expectLethalResolution(actorId: 'player' | 'recruit', targetId: 'player' | 'recruit') {
  const transition = executePv1fAction(lethalEncounter(actorId), PV1F_BASIC_ATTACK_ID, {
    kind: 'unit',
    combatantId: targetId,
  })
  const battle = transition.state.tactical.battle
  const actor = battle.combatants.find((combatant) => combatant.id === actorId)
  const target = battle.combatants.find((combatant) => combatant.id === targetId)
  const economy = actor?.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )

  expect(target?.hp).toBe(0)
  expect(battle.lifecycle).toBe('completed')
  expect(battle.currentTurn).toBeNull()
  expect(economy?.current).toBe(100 - PV1F_BASIC_ATTACK_COST)
  expect(transition.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'battle_completed' }),
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: actorId,
        amount: PV1F_BASIC_ATTACK_COST,
        remaining: 100 - PV1F_BASIC_ATTACK_COST,
      }),
    ]),
  )
}

describe('Level-100 offensive scaling', () => {
  it('derives Basic Attack from Physical Power instead of reading Core Stats directly', () => {
    expect(calculatePv1fBasicAttackDamage({ physicalPower: 34 })).toBe(14)
    expect(calculatePv1fBasicAttackDamage({ physicalPower: 75 })).toBe(24)
  })

  it('scales physical and mystic mature Skills from their matching offensive Power', () => {
    const physical = resolveMatureSkillVersion('vanguard.forceful-strike')
    const mystic = resolveMatureSkillVersion('lifebinder.vital-sever')
    if (!physical || !mystic) throw new Error('Expected current offensive Skill fixtures.')
    const state = currentPowerEncounter()
    const target = { kind: 'unit' as const, combatantId: 'recruit' }

    const physicalAction = evaluatePv1fMatureSkill(state, physical, target).action
    const mysticAction = evaluatePv1fMatureSkill(state, mystic, target).action
    const physicalDamage = physicalAction.effects.find((effect) => effect.type === 'damage')
    const mysticDamage = mysticAction.effects.find((effect) => effect.type === 'damage')

    expect(physicalDamage).toMatchObject({
      scaling: { source: 'physical-power', coefficientBasisPoints: 2_500 },
    })
    expect(mysticDamage).toMatchObject({
      scaling: { source: 'mystic-power', coefficientBasisPoints: 2_500 },
    })
  })

  it('halves both authored damage and Power scaling on a consecutive repeat', () => {
    const definition = resolveMatureSkillVersion('vanguard.forceful-strike')
    if (!definition) throw new Error('Expected current Vanguard Skill fixture.')
    const target = { kind: 'unit' as const, combatantId: 'recruit' }
    const first = executePv1fMatureSkill(currentPowerEncounter(), definition, target)
    const repeated = evaluatePv1fMatureSkill(first.state, definition, target)
    const damage = repeated.action.effects.find((effect) => effect.type === 'damage')

    expect(repeated.repeatPenaltyApplied).toBe(true)
    expect(damage).toMatchObject({
      amount: Math.max(
        1,
        Math.floor(
          (definition.effects.find((effect) => effect.type === 'damage')?.amount ?? 0) / 2,
        ),
      ),
      scaling: { source: 'physical-power', coefficientBasisPoints: 1_250 },
    })
  })
})

describe('PV-1F lethal Action Economy resolution', () => {
  it('commits a player lethal attack and completes the battle', () => {
    expectLethalResolution('player', 'recruit')
  })

  it('commits a Recruit lethal attack and completes the battle', () => {
    expectLethalResolution('recruit', 'player')
  })
})

describe('PV-1F MP Recovery', () => {
  it('restores 10% max MP and spends the configured AP cost', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.mp = 5

    const transition = executePv1fAction(encounter, PV1F_MP_RECOVER_ACTION_ID, { kind: 'self' })
    const nextPlayer = transition.state.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    const economy = nextPlayer?.temporaryResources.find(
      (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
    )

    expect(nextPlayer?.mp).toBe(7)
    expect(economy?.current).toBe(100 - PV1F_MP_RECOVER_COST)
  })

  it('clamps MP Recovery at maximum MP', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.mp = 19

    const transition = executePv1fAction(encounter, PV1F_MP_RECOVER_ACTION_ID, { kind: 'self' })
    const nextPlayer = transition.state.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )

    expect(nextPlayer?.mp).toBe(20)
  })
})

describe('PV-1F status stacking', () => {
  it('allows Guard to add another Guarded stack and charges AP for each application', () => {
    const firstGuard = executePv1fAction(lethalEncounter('player'), PV1F_GUARD_ACTION_ID, {
      kind: 'self',
    })
    const secondGuard = executePv1fAction(firstGuard.state, PV1F_GUARD_ACTION_ID, {
      kind: 'self',
    })
    const player = secondGuard.state.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    const economy = player?.temporaryResources.find(
      (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
    )
    const guarded = secondGuard.state.statusState
      .find((row) => row.combatantId === 'player')
      ?.statuses.find((status) => status.statusId === 'guarded')

    expect(guarded).toMatchObject({ stacks: 2, remainingOwnerTurnStarts: 2 })
    expect(economy?.current).toBe(100 - PV1F_GUARD_COST * 2)
  })
})

describe('P3.3 recovery cooldown authority', () => {
  function backToPlayer(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
    const recruitTurn = finishPv1fTurn(state, 'east').state
    return finishPv1fTurn(recruitTurn, 'west').state
  }

  it('shares the canonical two-own-turn Recovery cooldown across HP and MP recovery', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.hp = 25
    player.mp = 5

    const used = executePv1fAction(encounter, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    expect(PV1F_RECOVERY_COOLDOWN_OWNER_TURNS).toBe(2)
    expect(readPv1fActionCooldown(used.state, 'player', PV1F_MP_RECOVER_ACTION_ID)).toMatchObject({
      active: true,
      ownerTurns: 2,
      ticksRemaining: 3,
    })
    expect(
      evaluatePv1fAction(used.state, PV1F_MP_RECOVER_ACTION_ID, { kind: 'self' }).evaluation,
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
    })
  })

  it('survives reconnect serialization and unlocks only after two complete future owner turns', () => {
    const encounter = lethalEncounter('player')
    const player = encounter.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'player',
    )
    if (!player) throw new Error('Expected player combatant.')
    player.hp = 25

    const used = executePv1fAction(encounter, PV1F_RECOVER_ACTION_ID, { kind: 'self' })
    const reconnected = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState

    const firstFutureTurn = backToPlayer(reconnected)
    expect(
      evaluatePv1fAction(firstFutureTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)

    const secondFutureTurn = backToPlayer(firstFutureTurn)
    expect(
      evaluatePv1fAction(secondFutureTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)

    const readyTurn = backToPlayer(secondFutureTurn)
    expect(readPv1fActionCooldown(readyTurn, 'player', PV1F_RECOVER_ACTION_ID)?.active).toBe(false)
    expect(
      evaluatePv1fAction(readyTurn, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation.legal,
    ).toBe(true)
  })
})

describe('P3.3 mature Skill Action Economy integration', () => {
  it('spends authored AP and remains available after reconnect with repeat falloff', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')
    const state = lethalEncounter('player')
    const player = state.tactical.battle.combatants.find((combatant) => combatant.id === 'player')
    if (!player) throw new Error('Expected player combatant.')
    player.hp = 25

    const used = executePv1fMatureSkill(state, definition, { kind: 'self' })
    expect(readPv1fActionEconomy(used.state, 'player')?.current).toBe(55)
    expect(used.events).not.toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_started' }),
    )

    const reconnected = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState
    const repeated = evaluatePv1fMatureSkill(reconnected, definition, { kind: 'self' })
    expect(repeated.evaluation.legal).toBe(true)
    expect(repeated.repeatPenaltyApplied).toBe(true)
  })

  it('treats a repeated pure Curse as a legal full-cost no-op clone', () => {
    const base = resolveMatureSkillVersion('chronist.slow')
    if (!base) throw new Error('Expected current Chronist Slow fixture.')
    const definition = {
      ...base,
      apCost: 20,
      effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' }],
    } as unknown as MatureSkillDefinition

    const initial = lethalEncounter('player')
    const effectState = normalizeCombatEffectState(initial.effectState)
    const prepared: StatDrivenCombatEncounterState = {
      ...initial,
      effectState: {
        ...effectState,
        poison: [
          ...effectState.poison,
          {
            targetCombatantId: 'player',
            sourceCombatantId: 'recruit',
            sourceActionId: 'test.repeat.pure-poison',
            profileVersion: 1,
            movementRemainder: 2,
            curseCopyable: true,
          },
        ],
      },
    }
    const target = { kind: 'unit' as const, combatantId: 'recruit' }

    const first = executePv1fMatureSkill(prepared, definition, target)
    const firstPoison = normalizeCombatEffectState(first.state.effectState).poison.find(
      (instance) => instance.targetCombatantId === 'recruit',
    )
    expect(firstPoison).toBeDefined()

    const repeated = evaluatePv1fMatureSkill(first.state, definition, target)
    expect(repeated.repeatPenaltyApplied).toBe(true)
    expect(repeated.evaluation.legal).toBe(true)
    expect(repeated.action.effects).toEqual([])
    expect(repeated.evaluation.projectedEffects).toEqual([])

    const second = executePv1fMatureSkill(first.state, definition, target)
    const secondPoison = normalizeCombatEffectState(second.state.effectState).poison.find(
      (instance) => instance.targetCombatantId === 'recruit',
    )
    expect(secondPoison).toEqual(firstPoison)
    expect(readPv1fActionEconomy(second.state, 'player')?.current).toBe(60)
    expect(second.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_repeat_penalty_applied',
        combatantId: 'player',
        actionId: definition.id,
        effectivenessBasisPoints: 5_000,
      }),
    )
  })

  it('omits discrete Curse cloning on a consecutive use while later damage still halves', () => {
    const base = resolveMatureSkillVersion('chronist.slow')
    if (!base) throw new Error('Expected current Chronist Slow fixture.')
    const definition = {
      ...base,
      apCost: 20,
      effects: [
        { type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' },
        { type: 'damage', recipient: 'primary-unit', amount: 8 },
      ],
    } as unknown as MatureSkillDefinition

    const initial = lethalEncounter('player')
    const recruit = initial.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'recruit',
    )
    if (!recruit) throw new Error('Expected recruit combatant.')
    recruit.hp = 50

    const effectState = normalizeCombatEffectState(initial.effectState)
    const prepared: StatDrivenCombatEncounterState = {
      ...initial,
      effectState: {
        ...effectState,
        poison: [
          ...effectState.poison,
          {
            targetCombatantId: 'player',
            sourceCombatantId: 'recruit',
            sourceActionId: 'test.repeat.poison',
            profileVersion: 1,
            movementRemainder: 3,
            curseCopyable: true,
          },
        ],
      },
    }
    const target = { kind: 'unit' as const, combatantId: 'recruit' }

    const first = executePv1fMatureSkill(prepared, definition, target)
    const firstRecruit = first.state.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'recruit',
    )
    const firstPoison = normalizeCombatEffectState(first.state.effectState).poison.find(
      (instance) => instance.targetCombatantId === 'recruit',
    )
    expect(firstRecruit?.hp).toBe(42)
    expect(firstPoison).toBeDefined()

    const repeated = evaluatePv1fMatureSkill(first.state, definition, target)
    expect(repeated.repeatPenaltyApplied).toBe(true)
    expect(repeated.evaluation.legal).toBe(true)
    expect(repeated.action.effects).toHaveLength(1)
    expect(repeated.action.effects[0]).toMatchObject({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 4,
    })
    expect(repeated.action.effects.some((effect) => effect.type === 'copy-statuses')).toBe(false)

    const second = executePv1fMatureSkill(first.state, definition, target)
    const secondRecruit = second.state.tactical.battle.combatants.find(
      (combatant) => combatant.id === 'recruit',
    )
    const secondPoison = normalizeCombatEffectState(second.state.effectState).poison.find(
      (instance) => instance.targetCombatantId === 'recruit',
    )
    expect(secondRecruit?.hp).toBe(38)
    expect(secondPoison).toEqual(firstPoison)
    expect(readPv1fActionEconomy(second.state, 'player')?.current).toBe(60)
    expect(second.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_repeat_penalty_applied',
        combatantId: 'player',
        actionId: definition.id,
        effectivenessBasisPoints: 5_000,
      }),
    )
  })
})
