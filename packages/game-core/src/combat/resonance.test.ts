import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, endTurn, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  P35_REPRESENTATIVE_RESONANCES,
  createResonanceCombatState,
  executeMatureSkillWithResonance,
  forecastResonanceForSkill,
  resonanceAiUtilityBonus,
  resonanceSnapshotReference,
  resolveResonanceForPair,
  validateResonanceDefinition,
} from './resonance'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.5-resonance',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 54321,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 30,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open-ground', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      ],
      movementProfiles: [
        { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
        { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
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
    }),
  )
}

function nextPlayerAction(state: ReturnType<typeof encounter>) {
  const recruitEnded = endTurn(endTurn(state.tactical.battle).state).state
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: recruitEnded,
    },
  }
}

describe('P3.5 versioned Resonance framework', () => {
  it('keeps representative definitions valid and resolves one canonical unordered pair', () => {
    for (const definition of P35_REPRESENTATIVE_RESONANCES) {
      expect(validateResonanceDefinition(definition)).toEqual([])
    }

    const forward = resolveResonanceForPair('lifebinder', 'vanguard')
    const reverse = resolveResonanceForPair('vanguard', 'lifebinder')
    expect(forward?.id).toBe('resonance.lifebinder-vanguard.mercys-edge')
    expect(reverse?.id).toBe(forward?.id)
    expect(resolveResonanceForPair('vanguard', null)).toBeNull()
    expect(resolveResonanceForPair('vanguard', 'vanguard')).toBeNull()
    expect(resolveResonanceForPair('vanguard', 'unknown-discipline')).toBeNull()
  })

  it('exposes a stable snapshot identity without embedding executable trigger state', () => {
    const definition = resolveResonanceForPair('vanguard', 'lifebinder')
    if (!definition) throw new Error('Expected representative Resonance.')
    expect(resonanceSnapshotReference(definition)).toEqual({
      resonanceId: definition.id,
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })
  })

  it('arms on a successful Lifebinder heal and gives the next Vanguard melee Skill a bounded payoff', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!resonance || !heal || !strike) throw new Error('Expected representative P3.5 content.')

    const initialResonanceState = createResonanceCombatState(resonance)
    const setup = executeMatureSkillWithResonance({
      state: encounter(),
      resonance,
      resonanceState: initialResonanceState,
      skill: heal,
      combatContext: 'pve',
      selection: { kind: 'self' },
      content: { statuses: [] },
    })

    expect(setup.resonanceState.armedByActionId).toBe(heal.id)
    expect(setup.events).toContainEqual(
      expect.objectContaining({ event: 'resonance_armed', resonanceId: resonance.id }),
    )

    const payoff = executeMatureSkillWithResonance({
      state: nextPlayerAction(setup.state),
      resonance,
      resonanceState: setup.resonanceState,
      skill: strike,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
      content: { statuses: [] },
    })

    const recruit = payoff.state.tactical.battle.combatants.find((row) => row.id === 'recruit')
    expect(recruit?.hp).toBe(32)
    expect(payoff.resonanceState.armedByActionId).toBeNull()
    expect(payoff.events).toContainEqual(
      expect.objectContaining({
        event: 'resonance_activated',
        resonanceId: resonance.id,
        setupActionId: heal.id,
        payoffActionId: strike.id,
      }),
    )
  })

  it('expires an armed setup on an intervening non-payoff Discipline Skill and never loops itself', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!resonance || !heal) throw new Error('Expected representative P3.5 content.')

    const armed = {
      ...createResonanceCombatState(resonance),
      armedByActionId: 'lifebinder.previous-heal',
    }
    const forecast = forecastResonanceForSkill(resonance, armed, heal)
    expect(forecast).toMatchObject({
      willArm: true,
      willActivate: false,
      willExpireArmedSetup: true,
    })
    expect(forecast.bonusEffects).toEqual([])
  })

  it('makes the armed payoff more valuable to AI without changing Skill legality', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!resonance || !heal || !strike) throw new Error('Expected representative P3.5 content.')

    const ready = createResonanceCombatState(resonance)
    expect(resonanceAiUtilityBonus(resonance, ready, heal)).toBe(12)
    expect(resonanceAiUtilityBonus(resonance, ready, strike)).toBe(0)

    const armed = { ...ready, armedByActionId: heal.id }
    expect(resonanceAiUtilityBonus(resonance, armed, strike)).toBe(30)
  })
})
