import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { attachCombatBuildBridge, type CombatBuildSnapshot } from './build-snapshot'
import {
  createPv1fTemporaryResources,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  PV1F_ACTION_ECONOMY_TURN_KEY,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  chooseBuildAwareRecruitAiDecision,
  executeBuildAwareRecruitAiAction,
} from './recruit-ai-build'
import { RECRUIT_STANDARD_PROFILE } from './recruit-ai'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

const actorId = 'recruit:csr1-ai'
const targetId = 'wayfarer:csr1-ai'

function snapshot(): CombatBuildSnapshot {
  return {
    schemaVersion: 1,
    sourceBuildSchemaVersion: 2,
    sourceBuildVersion: 1,
    fingerprint: `sha256:${'a'.repeat(64)}`,
    primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
    secondary: null,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'vanguard.forceful-strike',
        contentVersion: 2,
        sourceDisciplineId: 'vanguard',
      },
    ],
    extensions: {
      resonance: null,
      essence: null,
      equipmentSkills: [],
      supernatural: null,
      prestige: null,
    },
  }
}

function resources(current: number) {
  return createPv1fTemporaryResources(16).map((resource) => {
    if (resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY) return { ...resource, current }
    if (resource.key === PV1F_ACTION_ECONOMY_TURN_KEY) return { ...resource, current: 1 }
    return resource
  })
}

function encounter(currentAp = 100) {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:csr1-ai-revealed',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 9917,
      combatants: [
        {
          id: actorId,
          teamId: 'opponents',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 40,
          maxMp: 40,
          temporaryResources: resources(currentAp),
        },
        {
          id: targetId,
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 50,
          mp: 30,
          maxMp: 30,
          temporaryResources: createPv1fTemporaryResources(16),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
    ],
    movementProfiles: [
      { id: 'actor-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'target-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: actorId,
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'actor-ground',
      },
      {
        combatantId: targetId,
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'target-ground',
      },
    ],
  })
  const profiles: StatDrivenCombatProfile[] = [actorId, targetId].map((combatantId) => ({
    combatantId,
    provenance: { kind: 'scenario', sourceId: `scenario:${combatantId}`, sourceRulesVersion: 2 },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }))
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical, [
      {
        combatantId: actorId,
        statuses: [
          {
            statusId: 'revealed',
            statusVersion: 1,
            stacks: 1,
            remainingOwnerTurnStarts: 2,
            sourceCombatantId: targetId,
          },
        ],
      },
      { combatantId: targetId, statuses: [] },
    ]),
    profiles,
  )
  return attachCombatBuildBridge(state, [
    {
      combatantId: actorId,
      characterId: '00000000-0000-4000-8000-000000009917',
      snapshot: snapshot(),
    },
  ])
}

describe('CSR-1 Recruit AI Revealed AP parity', () => {
  it('spends the same doubled mature-Skill AP cost as player execution', () => {
    const result = executeBuildAwareRecruitAiAction(encounter(), 'vanguard.forceful-strike', {
      kind: 'unit',
      combatantId: targetId,
    })

    expect(readPv1fActionEconomy(result.state, actorId)?.current).toBe(20)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: actorId,
        amount: 80,
        remaining: 20,
      }),
    )
  })

  it('does not select a Revealed Skill when the doubled AP cost is unaffordable', () => {
    const decision = chooseBuildAwareRecruitAiDecision({
      state: encounter(60),
      profile: RECRUIT_STANDARD_PROFILE,
      tieBreakSeed: 9917,
    })

    expect(decision.intent).not.toEqual(
      expect.objectContaining({ actionId: 'vanguard.forceful-strike' }),
    )
  })
})
