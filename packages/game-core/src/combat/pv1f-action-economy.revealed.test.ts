import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, type CombatStatusInstance } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { resolveMatureSkillVersion } from './mature-skills'
import {
  createPv1fTemporaryResources,
  evaluatePv1fAction,
  evaluatePv1fMatureSkill,
  evaluatePv1fMovement,
  executePv1fMatureSkill,
  readPv1fActionEconomy,
  PV1F_BASIC_ATTACK_ID,
  PV1F_GUARD_ACTION_ID,
  PV1F_MP_RECOVER_ACTION_ID,
  PV1F_RECOVER_ACTION_ID,
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
      sourceId: combatantId === 'player' ? 'character:csr1-player' : 'scenario:csr1-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(revealed = false): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const active = startBattle(
    createPendingBattle({
      battleId: `battle:csr1-revealed:${revealed ? 'on' : 'off'}`,
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x76543210,
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
    battle: active,
    width: 3,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [0, 1, 2].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open-ground',
    })),
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
        position: { x: 2, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })
  const revealedStatus: CombatStatusInstance[] = revealed
    ? [
        {
          statusId: 'revealed',
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 2,
          sourceCombatantId: 'recruit',
        },
      ]
    : []
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical, [
      { combatantId: 'player', statuses: revealedStatus },
      { combatantId: 'recruit', statuses: [] },
    ]),
    [playerProfile, recruitProfile],
  )
}

describe('CSR-1 Revealed Action Economy', () => {
  it('doubles the final mature-Skill AP cost while leaving MP unchanged', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')

    const plain = evaluatePv1fMatureSkill(encounter(false), definition, { kind: 'self' })
    const taxed = evaluatePv1fMatureSkill(encounter(true), definition, { kind: 'self' })

    expect(plain.cost).toBe(45)
    expect(taxed.cost).toBe(90)
    expect(taxed.action.cost.mp).toBe(plain.action.cost.mp)
    expect(taxed.evaluation.legal).toBe(plain.evaluation.legal)
  })

  it('uses the same doubled cost for commit spending', () => {
    const definition = resolveMatureSkillVersion('lifebinder.mending-light', 1)
    if (!definition) throw new Error('Expected representative Lifebinder Skill.')

    const transition = executePv1fMatureSkill(encounter(true), definition, { kind: 'self' })

    expect(readPv1fActionEconomy(transition.state, 'player')?.current).toBe(10)
    expect(transition.events).toContainEqual(
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: 'player',
        amount: 90,
        remaining: 10,
      }),
    )
  })

  it('does not alter Basic Attack, Guard, Recover, MP Recover or movement AP', () => {
    const plain = encounter(false)
    const taxed = encounter(true)

    for (const actionId of [
      PV1F_BASIC_ATTACK_ID,
      PV1F_GUARD_ACTION_ID,
      PV1F_RECOVER_ACTION_ID,
      PV1F_MP_RECOVER_ACTION_ID,
    ]) {
      const target =
        actionId === PV1F_BASIC_ATTACK_ID
          ? ({ kind: 'unit', combatantId: 'recruit' } as const)
          : ({ kind: 'self' } as const)
      expect(evaluatePv1fAction(taxed, actionId, target).cost).toBe(
        evaluatePv1fAction(plain, actionId, target).cost,
      )
    }

    const path = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    expect(evaluatePv1fMovement(taxed, path).economyCost).toBe(
      evaluatePv1fMovement(plain, path).economyCost,
    )
  })
})
