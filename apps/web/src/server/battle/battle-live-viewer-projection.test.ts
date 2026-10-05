import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
} from '@aurevane/game-core/combat/combat-kernel-types'
import type { BattleSessionCommitRecord } from '@aurevane/db/battle-session'
import type { TransactionalCommandResult } from '@aurevane/db/transactional-command'
import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatStatusInstance,
} from '@aurevane/game-core/combat/actions'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  omitPendingBattlePayloads,
  projectBattleEffectStateForViewer,
  projectBattleStatusStateForViewer,
} from './battle-live-viewer-projection'
import { projectCommittedBattleSession } from './battle-session-service'
import {
  deriveParticipantBattleViewerEntitlement,
  createSpectatorBattleViewerEntitlement,
} from './battle-viewer-entitlement'

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
  const state = createStatDrivenCombatEncounterState(
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
          { ...status('revealed', PLAYER), statusVersion: 999 },
          status('future-positive', ENEMY),
        ],
      },
      { combatantId: PLAIN_ENEMY, statuses: [status('guarded', PLAIN_ENEMY)] },
    ]),
    [PLAYER, ALLY, ENEMY, PLAIN_ENEMY].map(profile),
  )
  state.effectState = {
    ongoingRecovery: [],
    poison: [],
    bleed: [],
    burn: [],
    damageHistory: [],
    damageHistory: [],
    barriers: [
      {
        targetCombatantId: PLAIN_ENEMY,
        sourceCombatantId: PLAYER,
        sourceActionId: 'barrier',
        amount: 5,
      },
    ],
  }
  const viewer = createSpectatorBattleViewerEntitlement()
  const rows = projectBattleStatusStateForViewer(state, viewer)
  expect(rows.find((row) => row.combatantId === PLAIN_ENEMY)?.statuses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        statusId: 'poison',
        timingState: 'active',
        remainingOwnerTurnEnds: 3,
      }),
      expect.objectContaining({
        statusId: 'mp-recovery',
        timingState: 'active',
        remainingOwnerTurnEnds: 2,
      }),
      expect.objectContaining({ statusId: 'barrier', durationScope: 'until-spent' }),
    ]),
  )
  state.effectState!.poison = []
  state.effectState!.ongoingRecovery = []
  state.effectState!.barriers = []
  expect(
    projectBattleStatusStateForViewer(state, viewer)
      .find((row) => row.combatantId === PLAIN_ENEMY)
      ?.statuses.map((row) => row.statusId),
  ).toEqual(['guarded'])
})

it('omits enemy cast identities from persistent live effects independently of history visibility', () => {
  const state = encounter()
  state.effectState = {
    ongoingRecovery: [],
    poison: [
      {
        targetCombatantId: PLAIN_ENEMY,
        sourceCombatantId: PLAYER,
        sourceActionId: 'secret.pinned.skill',
        profileVersion: 1,
        movementRemainder: 0,
      },
    ],
    bleed: [],
    burn: [],
    damageHistory: [],
  }
  const before = structuredClone(state.effectState)
  const projected = projectBattleEffectStateForViewer(
    state,
    createSpectatorBattleViewerEntitlement(),
  )
  expect(projected?.poison[0]?.sourceActionId).toBe('combat.effect')
  expect(JSON.stringify(projected)).not.toContain('secret.pinned.skill')
  expect(state.effectState).toEqual(before)
})

it('scrubs concealed enemy provenance even when its debuff holder is self or ally', () => {
  const state = encounter()
  const provenance = createCombatEffectInstanceProvenance({
    action: createCombatActionProvenance({
      rulesetVersion: 4,
      sourceKind: 'discipline-skill',
      actionDefinitionId: 'secret.enemy.cast',
      actionVersion: 1,
      sourceCombatantId: ENEMY,
      controllerCombatantId: ENEMY,
      triggerChainId: 'hidden.cast',
    }),
    targetCombatantId: PLAYER,
    effectOrdinal: 0,
    createdRound: 1,
    createdTurn: 1,
  })
  state.statusState = state.statusState.map((row) =>
    [PLAYER, ALLY].includes(row.combatantId)
      ? { ...row, statuses: [{ ...status('hexed', ENEMY), provenance }] }
      : row,
  )
  const before = structuredClone(state.statusState)
  const viewer = deriveParticipantBattleViewerEntitlement(state.tactical.battle.combatants, [
    PLAYER,
  ])
  const rows = projectBattleStatusStateForViewer(state, viewer)
  for (const id of [PLAYER, ALLY])
    expect(rows.find((row) => row.combatantId === id)?.statuses[0]).not.toHaveProperty('provenance')
  expect(state.statusState).toEqual(before)
})
