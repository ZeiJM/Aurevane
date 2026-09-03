import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMatureSkill,
  executePv1fMatureSkill,
  finishPv1fTurn,
} from './pv1f-action-economy'
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
      sourceId: combatantId === 'player' ? 'character:p3.3-player' : 'scenario:p3.3-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function lifecycleEncounter(): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:p3.3-skill-lifecycle',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 424_242,
      combatants: [
        {
          id: 'player',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 25,
          maxHp: 50,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(12),
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
          temporaryResources: createPv1fTemporaryResources(12),
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

function advanceFullRound(state: StatDrivenCombatEncounterState) {
  const recruitTurn = finishPv1fTurn(state, 'east')
  const playerTurn = finishPv1fTurn(recruitTurn.state, 'west')
  return {
    state: playerTurn.state,
    events: [...recruitTurn.events, ...playerTurn.events],
  }
}

describe('P3.3 representative mature Skill lifecycle acceptance', () => {
  it('uses, cools down, survives reconnect, becomes ready, and can be used again', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')

    const used = executePv1fMatureSkill(lifecycleEncounter(), definition, { kind: 'self' })
    expect(used.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        cooldownKey: definition.cooldown.key,
        actionId: definition.id,
        definitionVersion: definition.contentVersion,
      }),
    )

    const reconnected = JSON.parse(JSON.stringify(used.state)) as StatDrivenCombatEncounterState
    expect(
      evaluatePv1fMatureSkill(reconnected, definition, { kind: 'self' }).evaluation,
    ).toMatchObject({
      legal: false,
      issues: expect.arrayContaining([expect.objectContaining({ code: 'cooldown-active' })]),
    })

    const firstFutureOwnerTurn = advanceFullRound(reconnected)
    expect(
      evaluatePv1fMatureSkill(firstFutureOwnerTurn.state, definition, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)
    expect(firstFutureOwnerTurn.events).not.toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_ready' }),
    )

    const secondFutureOwnerTurn = advanceFullRound(firstFutureOwnerTurn.state)
    expect(
      evaluatePv1fMatureSkill(secondFutureOwnerTurn.state, definition, { kind: 'self' }).evaluation
        .legal,
    ).toBe(false)
    expect(secondFutureOwnerTurn.events).not.toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_ready' }),
    )

    const readyTurn = advanceFullRound(secondFutureOwnerTurn.state)
    expect(readyTurn.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_ready',
        combatantId: 'player',
        cooldownKey: definition.cooldown.key,
      }),
    )
    expect(
      evaluatePv1fMatureSkill(readyTurn.state, definition, { kind: 'self' }).evaluation.legal,
    ).toBe(true)

    const reused = executePv1fMatureSkill(readyTurn.state, definition, { kind: 'self' })
    expect(reused.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_cooldown_started',
        cooldownKey: definition.cooldown.key,
      }),
    )
    expect(reused.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(50)
  })
})
