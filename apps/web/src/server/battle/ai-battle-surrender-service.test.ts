import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
} from '@aurevane/game-core/combat/board'
import {
  createPv1fTemporaryResources,
  preparePv1fTurnEconomy,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { createStatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const repository = vi.hoisted(() => ({ findBattleSession: vi.fn(), commitBattleIntent: vi.fn() }))
vi.mock('./supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => repository,
}))
import { surrenderAiBattle } from './ai-battle-surrender-service'

beforeEach(() => vi.clearAllMocks())
it.each([0, 1, 2])(
  'immediately concedes the entire practice team with %s AI allies',
  async (allyCount) => {
    const ids = [
      'character:player',
      ...Array.from({ length: allyCount }, (_, i) => `recruit:ally-${i + 1}`),
      ...Array.from({ length: 5 - allyCount }, (_, i) => `recruit:enemy-${i + 1}`),
    ]
    const battle = startBattle(
      createPendingBattle({
        battleId: 'surrender-test',
        rulesVersion: 3,
        contentVersion: 2,
        rngSeed: 1234,
        combatants: ids.map((id, index) => ({
          id,
          teamId: index <= allyCount ? 'players' : 'opponents',
          initiative: 20 - index,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 25,
          maxMp: 25,
          temporaryResources: createPv1fTemporaryResources(10),
        })),
      }),
    ).state
    const tactical = createTacticalBattleState({
      battle,
      width: 9,
      height: 7,
      terrains: P2_2_VERTICAL_SLICE_TERRAINS,
      tiles: Array.from({ length: 63 }, (_, i) => ({
        position: { x: i % 9, y: Math.floor(i / 9) },
        terrainId: 'open-ground',
        elevation: 0,
      })),
      movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
      placements: ids.map((combatantId, index) => ({
        combatantId,
        position: { x: index, y: 3 },
        facing: 'east' as const,
        movementProfileId: P2_2_ORDINARY_GROUND_PROFILE.id,
      })),
    })
    const state = preparePv1fTurnEconomy(
      createStatDrivenCombatEncounterState(
        createCombatEncounterState(tactical),
        ids.map((combatantId, index) => ({
          combatantId,
          provenance: {
            kind: index ? ('scenario' as const) : ('character-derived' as const),
            sourceId: index ? 'scenario:recruit' : 'character:player',
            sourceRulesVersion: 2,
          },
          accuracy: 7000,
          evasion: 800,
          armor: 20,
          ward: 20,
          jump: 1,
        })),
      ),
    )
    repository.findBattleSession.mockResolvedValue({
      battleSessionId: 'session',
      battleVersion: 7,
      snapshot: state,
      controlledCombatantIds: ['character:player'],
    })
    repository.commitBattleIntent.mockImplementation(async (input) => ({
      replayed: false,
      result: {
        battleSessionId: 'session',
        battleVersion: 8,
        snapshot: input.nextSnapshot,
        committedAt: '2026-10-02T17:00:00.000Z',
      },
    }))
    const result = await surrenderAiBattle('user', 'session', 7, 'request')
    expect(result.snapshot.tactical.battle.lifecycle).toBe('completed')
    expect(
      result.snapshot.tactical.battle.combatants
        .filter((c) => c.teamId === 'players')
        .every((c) => c.hp === 0),
    ).toBe(true)
    expect(
      result.snapshot.tactical.battle.combatants
        .filter((c) => c.teamId === 'opponents')
        .every((c) => c.hp === 100),
    ).toBe(true)
    expect(repository.commitBattleIntent).toHaveBeenCalledTimes(1)
    const input = repository.commitBattleIntent.mock.calls[0][0]
    expect(input.expectedBattleVersion).toBe(7)
    expect(
      input.events.filter((event: { event: string }) => event.event === 'ai_combatant_surrendered'),
    ).toHaveLength(1 + allyCount)
    expect(input.events).toContainEqual({ event: 'battle_completed', winningTeamId: 'opponents' })
  },
)
