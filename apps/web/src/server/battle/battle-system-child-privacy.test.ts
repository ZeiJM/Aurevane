import type { BattleSessionRecord, CommitBattleIntentInput } from '@aurevane/db/battle-session'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { capturedMatureSkillAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import { createPv1fTemporaryResources } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  createAiQualityResources,
  createPvpQualityResources,
} from '@aurevane/game-core/combat/pvp-quality'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const adapters = vi.hoisted(() => ({
  rpc: vi.fn(),
  findBattleSession: vi.fn(),
  commitBattleIntent: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: adapters.rpc }),
}))
vi.mock('@/server/character/supabase-character-repository', () => ({
  createSupabaseCharacterRepository: () => ({}),
}))
vi.mock('./supabase-battle-session-repository', () => ({
  createSupabaseBattleSessionRepository: () => adapters,
}))
import { tickAiTurnClock } from './ai-battle-quality-service'
import { tickPvpTurnClock } from './pvp-battle-quality-service'

const actorId = 'character:00000000-0000-4000-8000-000000000001'
function encounter(kind: 'ai' | 'pvp'): StatDrivenCombatEncounterState {
  const ids = [actorId, 'enemy']
  const quality = kind === 'ai' ? createAiQualityResources : createPvpQualityResources
  const battle = startBattle(
    createPendingBattle({
      battleId: 'system-private-child',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: index ? 'enemies' : 'players',
        initiative: 20 - index,
        baseMovementBudget: 4,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 20,
        temporaryResources: [...createPv1fTemporaryResources(10), ...quality()].sort((a, b) =>
          a.key.localeCompare(b.key),
        ),
      })),
    }),
  ).state
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 2,
        height: 1,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: [0, 1].map((x) => ({ position: { x, y: 0 }, terrainId: 'open', elevation: 0 })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, x) => ({
          combatantId,
          position: { x, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: 'system-private-child', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 1,
    })),
  )
  const definition = {
    ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
    ability: {
      schemaVersion: 1 as const,
      behaviors: [
        {
          id: 'lowered-witness',
          activation: 'automatic' as const,
          mode: 'action' as const,
          classification: 'recovery' as const,
          costs: [{ resource: 'mp' as const, amount: 1 }],
          cooldown: null,
          requirements: {
            kind: 'all' as const,
            children: [
              {
                kind: 'event' as const,
                eventType: 'status_applied' as const,
                phase: 'after' as const,
              },
              {
                kind: 'status-presence' as const,
                subject: 'owner' as const,
                statusId: 'lowered-guard',
                present: true,
              },
            ],
          },
          targeting: {
            kind: 'self' as const,
            teamPolicy: 'self' as const,
            friendlyFire: 'allies-only' as const,
            shape: { kind: 'single' as const },
            minimumRange: 0,
            maximumRange: 0,
            requiresLineOfSight: false,
            maximumElevationDifference: null,
            maximumSelections: 1,
          },
          effects: [
            {
              id: 'heal',
              payload: { type: 'healing' as const, recipient: 'actor' as const, amount: 1 },
            },
          ],
        },
      ],
    },
  }
  return reconcileCombatAbilitySources(
    {
      ...state,
      effectTimingPolicy: { version: 1, modes: { 'lowered-guard': 'instant' } },
      statusState: state.statusState.map((row) =>
        row.combatantId === actorId
          ? {
              ...row,
              statuses: [
                {
                  statusId: 'covert',
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: actorId,
                },
              ],
            }
          : row,
      ),
    },
    [capturedMatureSkillAbilitySource(state, definition)!],
  ) as StatDrivenCombatEncounterState
}

beforeEach(() => vi.clearAllMocks())
it.each(['ai', 'pvp'] as const)(
  'actual %s timeout CAS retains child visibility and returns a safe live DTO',
  async (kind) => {
    const state = encounter(kind)
    let record: BattleSessionRecord = {
      battleSessionId: 'session',
      battleId: state.tactical.battle.battleId,
      battleVersion: 1,
      rulesVersion: state.tactical.battle.rulesVersion,
      contentVersion: state.tactical.battle.contentVersion,
      lifecycle: state.tactical.battle.lifecycle,
      snapshot: JSON.parse(JSON.stringify(state)),
      controlledCombatantIds: [actorId],
      updatedAt: '2026-10-10T00:00:00Z',
    }
    adapters.findBattleSession.mockImplementation(async () => record)
    adapters.commitBattleIntent.mockImplementation(async (input: CommitBattleIntentInput) => {
      record = { ...record, snapshot: input.nextSnapshot, battleVersion: 2 }
      return {
        replayed: false,
        result: {
          battleSessionId: 'session',
          battleVersion: 2,
          snapshot: input.nextSnapshot,
          committedAt: record.updatedAt,
        },
      }
    })
    let polls = 0
    adapters.rpc.mockImplementation(async (name: string) => ({
      error: null,
      data: name.startsWith('ensure_')
        ? ++polls === 1
          ? {
              active: true,
              turn_number: 1,
              combatant_id: actorId,
              deadline_at: '2026-10-10T00:00:00Z',
              expired: true,
              turn_timer_seconds: 60,
            }
          : { active: false, turn_timer_seconds: 60 }
        : { previous_turn_missed: false },
    }))
    const result = await (kind === 'ai' ? tickAiTurnClock : tickPvpTurnClock)('user', 'session')
    expect(result.timedOut).toBe(true)
    expect(adapters.commitBattleIntent).toHaveBeenCalledTimes(1)
    const input = adapters.commitBattleIntent.mock.calls[0]![0] as CommitBattleIntentInput
    const after = input.nextSnapshot as StatDrivenCombatEncounterState
    expect(after.capturedAbilitySources).toEqual(state.capturedAbilitySources)
    expect(after.tactical.battle.combatants.find((unit) => unit.id === actorId)!.mp).toBe(19)
    const hidden = input.events.flatMap((event, eventIndex) =>
      (event as { sourceCommandVisibility?: unknown }).sourceCommandVisibility ? [eventIndex] : [],
    )
    expect(hidden.length).toBeGreaterThan(0)
    expect(input.privacyJournal).toMatchObject({ commandVisibility: { kind: 'public' } })
    for (const eventIndex of hidden)
      expect(input.privacyJournal!.eventVisibilityOverrides).toContainEqual({
        eventIndex,
        visibility: { kind: 'team-only', teamId: 'players' },
      })
    expect(JSON.stringify(result)).not.toMatch(
      /capturedAbilitySources|abilityRuntime|sourceInstanceId|sourceCommandVisibility|effectOrigin/,
    )
  },
)
