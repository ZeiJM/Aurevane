import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}))

import { getPvpBattleLog } from './pvp-battle-communication-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const ACTOR = 'character:actor'
const TARGET = 'character:target'

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
    { id: ACTOR, teamId: 'team:a', initiative: 20 },
    { id: TARGET, teamId: 'team:b', initiative: 10 },
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
      battleId: 'battle:csr4-pvp-history',
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
    placements: [ACTOR, TARGET].map((combatantId, x) => ({
      combatantId,
      position: { x, y: 0 },
      facing: x === 0 ? ('east' as const) : ('west' as const),
      movementProfileId: 'ground',
    })),
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    [ACTOR, TARGET].map(profile),
  )
}

function eventRow(eventIndex: number, event: Record<string, unknown>) {
  return {
    battle_version: 9,
    event_index: eventIndex,
    event,
    created_at: '2026-09-17T12:00:00.000Z',
  }
}

describe('PvP battle communication history', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('projects PvP spectator history through CSR-3 privacy before building the Battle Log', async () => {
    mocks.rpc.mockImplementation(async (functionName: string, params: Record<string, unknown>) => {
      if (functionName === 'get_battle_events_v3') {
        expect(params).toMatchObject({
          p_user_id: USER_ID,
          p_battle_session_id: SESSION_ID,
          p_limit: 100,
          p_before_battle_version: null,
          p_before_event_index: null,
        })
        return {
          data: [
            eventRow(0, {
              event: 'combat_action_used',
              actorId: ACTOR,
              actionId: 'secret.sensory',
            }),
            eventRow(1, {
              event: 'damage_applied',
              actionId: 'secret.sensory',
              sourceCombatantId: ACTOR,
              targetCombatantId: TARGET,
              amount: 1,
              hpAfter: 99,
            }),
            eventRow(2, {
              event: 'status_removed',
              actionId: 'secret.sensory',
              sourceCombatantId: ACTOR,
              targetCombatantId: TARGET,
              statusId: 'covert',
            }),
            eventRow(3, {
              event: 'status_applied',
              actionId: 'secret.sensory',
              sourceCombatantId: ACTOR,
              targetCombatantId: TARGET,
              statusId: 'revealed',
              stacks: 1,
              remainingOwnerTurnStarts: 4,
              refreshed: false,
              stacked: false,
            }),
          ],
          error: null,
        }
      }

      if (functionName === 'get_battle_history_privacy_v1') {
        expect(params).toEqual({
          p_user_id: USER_ID,
          p_battle_session_id: SESSION_ID,
          p_battle_versions: [9],
        })
        return {
          data: [
            {
              viewer_kind: 'spectator',
              controlled_combatant_ids: [],
              snapshot: snapshot(),
              journals: [
                {
                  schemaVersion: 1,
                  battleVersion: 9,
                  actorCombatantId: ACTOR,
                  actorTeamId: 'team:a',
                  eventCount: 4,
                  commandVisibility: { kind: 'team-only', teamId: 'team:a' },
                  eventVisibilityOverrides: [
                    { eventIndex: 2, visibility: { kind: 'public' } },
                    { eventIndex: 3, visibility: { kind: 'public' } },
                  ],
                },
              ],
            },
          ],
          error: null,
        }
      }

      throw new Error(`Unexpected RPC: ${functionName}`)
    })

    const result = await getPvpBattleLog(USER_ID, SESSION_ID)

    expect(result.entries.map((entry) => entry.eventType)).toEqual([
      'hidden_combat_action',
      'status_removed',
      'status_applied',
    ])
    expect(result.entries[0]).toMatchObject({
      message: 'Wayfarer performed an action.',
      actionId: null,
      actionLabel: null,
    })
    expect(JSON.stringify(result)).not.toContain('secret.sensory')
    expect(JSON.stringify(result)).not.toContain('damage_applied')
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'list_pvp_battle_events_v2')).toBe(false)
  })
})
