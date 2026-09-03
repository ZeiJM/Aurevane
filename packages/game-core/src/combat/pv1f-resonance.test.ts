import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createPv1fTemporaryResources,
  finishPv1fTurn,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import { executePv1fMatureSkillWithResonance } from './pv1f-resonance'
import { createResonanceCombatState, resolveResonanceForPair } from './resonance'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'player' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'player' ? 'character:p35-player' : 'scenario:p35-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.5-pv1f-resonance',
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
          temporaryResources: createPv1fTemporaryResources(16),
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
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
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
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    playerProfile,
    recruitProfile,
  ])
}

function nextPlayerTurn(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  const recruitTurn = finishPv1fTurn(state, 'east').state
  return finishPv1fTurn(recruitTurn, 'west').state
}

describe('P3.5 Resonance on the authoritative PV-1F Skill path', () => {
  it('spends authored AP, starts cooldowns, and applies the bounded payoff', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    const strike = resolveMatureSkillVersion('vanguard.forceful-strike', 2)
    if (!resonance || !heal || !strike) throw new Error('Expected representative P3.5 content.')

    const setup = executePv1fMatureSkillWithResonance({
      state: encounter(),
      resonance,
      resonanceState: createResonanceCombatState(resonance),
      skill: heal,
      combatContext: 'pve',
      selection: { kind: 'self' },
    })

    expect(readPv1fActionEconomy(setup.state, 'player')?.current).toBe(55)
    expect(setup.resonanceState.armedByActionId).toBe(heal.id)
    expect(setup.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: 'player',
          amount: 45,
          remaining: 55,
        }),
        expect.objectContaining({
          event: 'skill_cooldown_started',
          actionId: heal.id,
          definitionVersion: heal.contentVersion,
        }),
        expect.objectContaining({ event: 'resonance_armed', resonanceId: resonance.id }),
      ]),
    )

    const payoff = executePv1fMatureSkillWithResonance({
      state: nextPlayerTurn(setup.state),
      resonance,
      resonanceState: setup.resonanceState,
      skill: strike,
      combatContext: 'pve',
      selection: { kind: 'unit', combatantId: 'recruit' },
    })

    expect(readPv1fActionEconomy(payoff.state, 'player')?.current).toBe(60)
    expect(payoff.state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp).toBe(32)
    expect(payoff.resonanceState.armedByActionId).toBeNull()
    expect(payoff.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'action_economy_spent',
          combatantId: 'player',
          amount: 40,
          remaining: 60,
        }),
        expect.objectContaining({
          event: 'skill_cooldown_started',
          actionId: strike.id,
          definitionVersion: strike.contentVersion,
        }),
        expect.objectContaining({
          event: 'resonance_activated',
          resonanceId: resonance.id,
          setupActionId: heal.id,
          payoffActionId: strike.id,
        }),
      ]),
    )
  })

  it('does not mutate Resonance state when the authoritative AP check rejects the Skill', () => {
    const resonance = resolveResonanceForPair('vanguard', 'lifebinder')
    const heal = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!resonance || !heal) throw new Error('Expected representative P3.5 content.')

    const state = encounter()
    const player = state.tactical.battle.combatants.find((row) => row.id === 'player')
    if (!player) throw new Error('Expected player combatant.')
    player.temporaryResources = player.temporaryResources.map((resource) =>
      resource.key === 'pv1f.action-economy' ? { ...resource, current: 40 } : resource,
    )
    const resonanceState = createResonanceCombatState(resonance)

    expect(() =>
      executePv1fMatureSkillWithResonance({
        state,
        resonance,
        resonanceState,
        skill: heal,
        combatContext: 'pve',
        selection: { kind: 'self' },
      }),
    ).toThrow('Not enough Action Economy remains for that mature Skill.')
    expect(resonanceState.armedByActionId).toBeNull()
  })
})
