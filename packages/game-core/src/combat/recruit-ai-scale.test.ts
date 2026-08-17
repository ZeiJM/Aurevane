import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  chooseRecruitAiDecision,
  createRecruitAiKnowledge,
  RECRUIT_WEAK_PROFILE,
} from './recruit-ai'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'
import { getTacticalHallArena } from './tactical-hall-arenas'

function profile(
  combatantId: string,
  kind: 'character-derived' | 'scenario',
): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind,
      sourceId: kind === 'scenario' ? 'scenario:p2-7-recruit:duel-yard' : 'character:scale-test',
      sourceRulesVersion: 1,
    },
    accuracy: combatantId === 'recruit' ? 6_500 : 7_400,
    evasion: combatantId === 'recruit' ? 700 : 1_100,
    armor: 20,
    ward: 20,
    jump: 1,
  }
}

function duelYardEncounter() {
  const arena = getTacticalHallArena('duel-yard')
  const recruitProfile = profile('recruit', 'scenario')
  const playerProfile = profile('player', 'character-derived')
  const active = startBattle(
    createPendingBattle({
      battleId: 'battle:recruit-ai-duel-yard',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 987_654_321,
      combatants: [
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 80,
          maxHp: 80,
          mp: 25,
          maxMp: 25,
        },
        {
          id: 'player',
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  const tactical = createTacticalBattleState({
    battle: active,
    width: arena.width,
    height: arena.height,
    terrains: [
      { id: 'open-ground', traversalCost: 1 },
      { id: 'rough-ground', traversalCost: 2 },
    ],
    tiles: arena.tiles,
    movementProfiles: [
      { id: 'recruit-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'recruit',
        position: arena.recruitSpawn,
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
      {
        combatantId: 'player',
        position: arena.playerSpawn,
        facing: 'east',
        movementProfileId: 'player-ground',
      },
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    recruitProfile,
    playerProfile,
  ])
}

describe('P2.7 Recruit AI battlefield scale', () => {
  it('reads the full 9x7 committed Duel Yard without exposing private state', () => {
    const knowledge = createRecruitAiKnowledge(duelYardEncounter())
    const serialized = JSON.stringify(knowledge)

    expect(knowledge.tiles).toHaveLength(63)
    expect(knowledge.placements).toHaveLength(2)
    expect(knowledge.activeCombatantId).toBe('recruit')
    expect(serialized).not.toContain('rng')
    expect(serialized).not.toContain('statBridge')
  })

  it('keeps Recruit decisions deterministic and inside the bounded candidate budget', () => {
    const state = duelYardEncounter()
    const first = chooseRecruitAiDecision({ state, tieBreakSeed: 27 })
    const second = chooseRecruitAiDecision({ state, tieBreakSeed: 27 })

    expect(second).toEqual(first)
    expect(first.candidateCount).toBeGreaterThan(0)
    expect(first.candidateCount).toBeLessThanOrEqual(RECRUIT_WEAK_PROFILE.maxCandidates)
    expect(['close-distance', 'guard-survival', 'face-threat']).toContain(first.reason)
  })
})
