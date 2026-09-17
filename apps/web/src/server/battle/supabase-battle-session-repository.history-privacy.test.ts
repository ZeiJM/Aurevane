import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}))

import { createSupabaseBattleSessionRepository } from './supabase-battle-session-repository'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const PLAYER = 'character:player'
const ENEMY = 'character:enemy'

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

function snapshot() {
  const combatants = [
    { id: PLAYER, teamId: 'team:a', initiative: 20 },
    { id: ENEMY, teamId: 'team:b', initiative: 10 },
  ].map((combatant) => ({
    ...combatant,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
  }))
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:csr3-history-authority',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 1234,
      combatants,
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [0, 1].map((x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [PLAYER, ENEMY].map((combatantId, x) => ({
      combatantId,
      position: { x, y: 0 },
      facing: x === 0 ? ('east' as const) : ('west' as const),
      movementProfileId: 'ground',
    })),
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    [PLAYER, ENEMY].map(profile),
  )
}

describe('CSR-3 history privacy repository', () => {
  it('derives the existing participant entitlement from private persisted authority', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          viewer_kind: 'participant',
          controlled_combatant_ids: [PLAYER],
          snapshot: snapshot(),
          journals: [
            {
              schemaVersion: 1,
              battleVersion: 9,
              actorCombatantId: ENEMY,
              actorTeamId: 'team:b',
              eventCount: 2,
              commandVisibility: { kind: 'team-only', teamId: 'team:b' },
              eventVisibilityOverrides: [
                { eventIndex: 1, visibility: { kind: 'public' } },
              ],
            },
          ],
        },
      ],
      error: null,
    })

    const repository = createSupabaseBattleSessionRepository()
    const result = await repository.findBattleHistoryPrivacy(USER_ID, SESSION_ID, [9, 8, 9])

    expect(rpc).toHaveBeenCalledWith('get_battle_history_privacy_v1', {
      p_user_id: USER_ID,
      p_battle_session_id: SESSION_ID,
      p_battle_versions: [9, 8],
    })
    expect(result.viewer.kind).toBe('participant')
    expect([...result.viewer.controlledCombatantIds]).toEqual([PLAYER])
    expect([...result.viewer.friendlyTeamIds]).toEqual(['team:a'])
    expect(result.journals).toHaveLength(1)
    expect(result.journals[0]?.battleVersion).toBe(9)
  })

  it('fails closed when persisted journal metadata is malformed', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          viewer_kind: 'participant',
          controlled_combatant_ids: [PLAYER],
          snapshot: snapshot(),
          journals: [
            {
              schemaVersion: 1,
              battleVersion: 9,
              actorCombatantId: ENEMY,
              actorTeamId: 'team:b',
              eventCount: 1,
              commandVisibility: { kind: 'team-only', teamId: 'team:b' },
              eventVisibilityOverrides: [
                { eventIndex: 1, visibility: { kind: 'public' } },
              ],
            },
          ],
        },
      ],
      error: null,
    })

    const repository = createSupabaseBattleSessionRepository()
    await expect(repository.findBattleHistoryPrivacy(USER_ID, SESSION_ID, [9])).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })
})
