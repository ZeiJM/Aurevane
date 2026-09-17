import type { BattleSessionCommitRecord } from '@aurevane/db/battle-session'
import type { TransactionalCommandResult } from '@aurevane/db/transactional-command'
import {
  createCombatEncounterState,
  type CombatStatusInstance,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { projectCommittedBattleSession } from './battle-session-service'

const PLAYER = 'character:player'
const ALLY = 'character:ally'
const ENEMY = 'character:enemy'
const PLAIN_ENEMY = 'character:plain-enemy'

function status(
  statusId: string,
  sourceCombatantId: string,
  remainingOwnerTurnStarts = 2,
): CombatStatusInstance {
  return {
    statusId,
    statusVersion: 1,
    stacks: 1,
    remainingOwnerTurnStarts,
    sourceCombatantId,
  }
}

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: 'scenario',
      sourceId: `scenario:${combatantId}`,
      sourceRulesVersion: 2,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter(): StatDrivenCombatEncounterState {
  const combatants = [
    { id: PLAYER, teamId: 'team:a', initiative: 40 },
    { id: ALLY, teamId: 'team:a', initiative: 30 },
    { id: ENEMY, teamId: 'team:b', initiative: 20 },
    { id: PLAIN_ENEMY, teamId: 'team:b', initiative: 10 },
  ].map((entry) => ({
    ...entry,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
  }))
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:csr2-live-viewer',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 0x24681357,
      combatants,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 4,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1, 2, 3].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [PLAYER, ALLY, ENEMY, PLAIN_ENEMY].map((combatantId, x) => ({
      combatantId,
      position: { x, y: 0 },
      facing: x < 2 ? ('east' as const) : ('west' as const),
      movementProfileId: 'ground',
    })),
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical, [
      {
        combatantId: PLAYER,
        statuses: [status('covert', PLAYER, 3), status('guarded', PLAYER)],
      },
      {
        combatantId: ALLY,
        statuses: [status('covert', ALLY, 3), status('guarded', ALLY)],
      },
      {
        combatantId: ENEMY,
        statuses: [
          status('covert', ENEMY, 3),
          status('guarded', ENEMY),
          status('exposed', PLAYER),
          status('future-positive', ENEMY),
        ],
      },
      { combatantId: PLAIN_ENEMY, statuses: [status('guarded', PLAIN_ENEMY)] },
    ]),
    [PLAYER, ALLY, ENEMY, PLAIN_ENEMY].map(profile),
  )
}

function rowStatuses(
  state: { statusState: StatDrivenCombatEncounterState['statusState'] },
  id: string,
) {
  return state.statusState.find((row) => row.combatantId === id)?.statuses ?? []
}

function committed(
  snapshot: StatDrivenCombatEncounterState,
): TransactionalCommandResult<BattleSessionCommitRecord> {
  return {
    replayed: false,
    result: {
      battleSessionId: 'session:csr2-live-viewer',
      battleVersion: 7,
      snapshot,
      committedAt: '2026-09-17T12:00:00.000Z',
    },
  }
}

describe('CSR-2 live viewer-relative status projection', () => {
  it('keeps self/allied Covert positives but omits an opposing Covert unit’s positive and unknown status rows', () => {
    const authoritative = encounter()
    const before = structuredClone(authoritative.statusState)
    const projected = projectCommittedBattleSession(committed(authoritative), [PLAYER]).snapshot

    expect(rowStatuses(projected, PLAYER).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
    ])
    expect(rowStatuses(projected, ALLY).map((entry) => entry.statusId)).toEqual([
      'covert',
      'guarded',
    ])
    expect(rowStatuses(projected, ENEMY).map((entry) => entry.statusId)).toEqual(['exposed'])
    expect(rowStatuses(projected, PLAIN_ENEMY).map((entry) => entry.statusId)).toEqual(['guarded'])
    expect(authoritative.statusState).toEqual(before)
    expect(projected.tactical.battle).not.toHaveProperty('rng')
  })
})
