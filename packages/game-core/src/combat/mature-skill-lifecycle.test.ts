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
  PV1F_REPEAT_SKILL_EFFECTIVENESS_BASIS_POINTS,
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

function advanceFullRound(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  const recruitTurn = finishPv1fTurn(state, 'east')
  return finishPv1fTurn(recruitTurn.state, 'west').state
}

describe('mature Skill repeat-use lifecycle', () => {
  it('keeps a Skill available and applies 50% effectiveness to consecutive uses', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')

    const first = executePv1fMatureSkill(lifecycleEncounter(), definition, { kind: 'self' })
    expect(first.events).not.toContainEqual(
      expect.objectContaining({ event: 'skill_cooldown_started' }),
    )
    expect(first.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(41)

    const preview = evaluatePv1fMatureSkill(first.state, definition, { kind: 'self' })
    expect(preview.evaluation.legal).toBe(true)
    expect(preview.repeatPenaltyApplied).toBe(true)
    expect(preview.evaluation.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'healing', before: 41, after: 49 }),
    )

    const repeated = executePv1fMatureSkill(first.state, definition, { kind: 'self' })
    expect(repeated.events).toContainEqual(
      expect.objectContaining({
        event: 'skill_repeat_penalty_applied',
        actionId: definition.id,
        effectivenessBasisPoints: PV1F_REPEAT_SKILL_EFFECTIVENESS_BASIS_POINTS,
      }),
    )
    expect(repeated.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(
      49,
    )
  })

  it('persists repeat-use state through reconnect and across turn boundaries', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')

    const first = executePv1fMatureSkill(lifecycleEncounter(), definition, { kind: 'self' })
    const reconnected = JSON.parse(JSON.stringify(first.state)) as StatDrivenCombatEncounterState
    const nextOwnerTurn = advanceFullRound(reconnected)
    const preview = evaluatePv1fMatureSkill(nextOwnerTurn, definition, { kind: 'self' })

    expect(preview.evaluation.legal).toBe(true)
    expect(preview.repeatPenaltyApplied).toBe(true)
    expect(preview.evaluation.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'healing', before: 41, after: 49 }),
    )
  })
})
