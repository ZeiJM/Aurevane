import {
  createCombatEncounterState,
  synchronizeCombatInitiative,
} from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import {
  createTacticalBattleState,
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
} from '@aurevane/game-core/combat/board'
import {
  createPv1fTemporaryResources,
  preparePv1fTurnEconomy,
  finishPv1fTurn,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  validateStatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const repository = vi.hoisted(() => ({ findBattleSession: vi.fn(), commitBattleIntent: vi.fn() }))
vi.mock('./supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => repository,
}))
import { surrenderAiBattle } from './ai-battle-surrender-service'

beforeEach(() => vi.clearAllMocks())
it.each(
  [0, 1, 2].flatMap((allyCount) => [
    { allyCount, policy: 'historical', initiative: 'descending', seed: 1234 },
    ...['descending', 'ascending', 'tied', 'recruits-first'].flatMap((initiative) =>
      [1, 9, 1234].map((seed) => ({ allyCount, policy: 'current', initiative, seed })),
    ),
  ]),
)(
  'concedes $allyCount allies under $policy policies with $initiative Initiative and seed $seed',
  async ({ allyCount, policy, initiative, seed }) => {
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
        rngSeed: seed,
        combatants: ids.map((id, index) => ({
          id,
          teamId: index <= allyCount ? 'players' : 'opponents',
          initiative:
            initiative === 'recruits-first'
              ? index
                ? 21
                : 19
              : initiative === 'tied'
                ? 20
                : initiative === 'ascending'
                  ? 20 + index
                  : 20 - index,
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
    let state = preparePv1fTurnEconomy(
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
    if (policy === 'current') {
      state = synchronizeCombatInitiative({
        ...state,
        elementalDamagePolicyVersion: 1,
        dynamicInitiativePolicyVersion: 1,
      })
      // The native browser waits for the local turn after earlier Recruit turns complete.
      while (state.tactical.battle.currentTurn?.combatantId !== 'character:player') {
        state = finishPv1fTurn(state, 'east').state
      }
    }
    expect(validateStatDrivenCombatEncounterState(state)).toEqual([])
    const originalBattle = state.tactical.battle
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
    expect(result.snapshot.tactical.battle.currentTurn).toBeNull()
    expect(result.snapshot.tactical.battle.round).toBeLessThanOrEqual(originalBattle.round + 1)
    expect(result.snapshot.tactical.battle.turnNumber).toBeLessThanOrEqual(
      originalBattle.turnNumber + 1 + allyCount,
    )
    expect(
      result.snapshot.tactical.battle.combatants
        .filter((c) => c.teamId === 'opponents')
        .map((c) => c.mp),
    ).toEqual(originalBattle.combatants.filter((c) => c.teamId === 'opponents').map((c) => c.mp))
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
    expect(input.nextSnapshot.statBridge).toEqual(state.statBridge)
    expect(input.nextSnapshot.elementalDamagePolicyVersion).toBe(state.elementalDamagePolicyVersion)
    expect(input.nextSnapshot.dynamicInitiativePolicyVersion).toBe(
      state.dynamicInitiativePolicyVersion,
    )
    expect(input.nextSnapshot.tactical.battle.initiativeTieOrder).toEqual(
      originalBattle.initiativeTieOrder,
    )
    expect(input.nextSnapshot.tactical.battle.rng).toEqual(originalBattle.rng)
    const started = input.events.filter(
      (event: { event: string }) => event.event === 'turn_started',
    )
    const ended = input.events.filter((event: { event: string }) => event.event === 'turn_ended')
    expect(started).toHaveLength(ended.length)
    expect(started.length).toBeLessThanOrEqual(1 + allyCount)
    expect(new Set(started.map((event: { combatantId: string }) => event.combatantId)).size).toBe(
      started.length,
    )
    expect(
      ended.every((event: { combatantId: string }) =>
        ids.slice(0, 1 + allyCount).includes(event.combatantId),
      ),
    ).toBe(true)
    expect(input.nextSnapshot.tactical.battle.turnNumber).toBe(
      originalBattle.turnNumber + started.length,
    )
    expect(input.nextSnapshot.tactical.battle.round).toBe(
      originalBattle.round +
        input.events.filter((event: { event: string }) => event.event === 'round_started').length,
    )
    expect(input.expectedBattleVersion).toBe(7)
    expect(validateStatDrivenCombatEncounterState(input.nextSnapshot)).toEqual([])
    expect(
      input.events.filter((event: { event: string }) => event.event === 'ai_combatant_surrendered'),
    ).toHaveLength(1 + allyCount)
    expect(
      input.events.filter((event: { event: string }) => event.event === 'battle_completed'),
    ).toEqual([{ event: 'battle_completed', winningTeamId: 'opponents' }])
    repository.findBattleSession.mockResolvedValue({
      battleSessionId: 'session',
      battleVersion: 8,
      snapshot: input.nextSnapshot,
      controlledCombatantIds: ['character:player'],
    })
    await expect(surrenderAiBattle('user', 'session', 8, 'repeat')).rejects.toThrow(
      'Only an active AI battle can be surrendered.',
    )
    expect(repository.commitBattleIntent).toHaveBeenCalledTimes(1)
  },
)
