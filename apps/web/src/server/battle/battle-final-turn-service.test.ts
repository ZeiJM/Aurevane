import { applyCurrentBurnState } from '@aurevane/game-core/combat/combat-dots'
import * as turnEconomy from '@aurevane/game-core/combat/pv1f-action-economy'
import { capturedMatureSkillAbilitySource } from '@aurevane/game-core/combat/combat-action-source'
import { reconcileCombatAbilitySources } from '@aurevane/game-core/combat/combat-behavior-runtime'
import { resolveMatureSkillVersion } from '@aurevane/game-core/combat/mature-skills'
import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleFinalTurnService } from './battle-final-turn-service'
import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-08-17T15:00:00.000Z'

function characterRecord(): CharacterRecord {
  return {
    id: CHARACTER_ID,
    userId: USER_ID,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Wayfarer',
    nameKey: 'wayfarer',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.roadworn',
    foundationDisciplineId: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 1,
    xp: 0,
    progressionCycle: 1,
    createdAt: CREATED_AT,
    cycleStartedAt: CREATED_AT,
    lastActiveAt: CREATED_AT,
  }
}

function characterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by final-turn service tests.')
    }),
  }
}

async function initialEncounter(): Promise<StatDrivenCombatEncounterState> {
  let initialSnapshot: unknown = null
  const repository: BattleSessionRepository = {
    createBattleSession: vi.fn(async (input: CreateBattleSessionInput) => {
      initialSnapshot = input.initialSnapshot
      return {
        replayed: false,
        result: {
          battleSessionId: SESSION_ID,
          battleVersion: 1,
          snapshot: input.initialSnapshot,
          createdAt: CREATED_AT,
        },
      }
    }),
    findBattleSession: vi.fn(async () => null),
    findBattleIntentReplay: vi.fn(async () => null),
    commitBattleIntent: vi.fn(async () => {
      throw new Error('Not used while creating final-turn fixture.')
    }),
  }
  const service = createBattleSessionService({
    characters: characterRepository(),
    battles: repository,
  })
  await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
  })
  if (!initialSnapshot) throw new Error('Expected an initial battle snapshot.')
  return initialSnapshot as StatDrivenCombatEncounterState
}

describe('battle final-turn frozen build authority', () => {
  it('actual final-turn CAS journals a Covert Automatic child under a public facing command', async () => {
    const initial = await initialEncounter(),
      actorId = `character:${CHARACTER_ID}`
    const definition = {
      ...resolveMatureSkillVersion('vanguard.forceful-strike')!,
      ability: {
        schemaVersion: 1 as const,
        behaviors: [
          {
            id: 'end-heal',
            activation: 'automatic' as const,
            mode: 'action' as const,
            classification: 'recovery' as const,
            costs: [{ resource: 'mp' as const, amount: 1 }],
            cooldown: null,
            requirements: {
              kind: 'event' as const,
              eventType: 'turn_ended' as const,
              phase: 'after' as const,
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
    const source = capturedMatureSkillAbilitySource(initial, definition)!
    const state = reconcileCombatAbilitySources(
      {
        ...initial,
        statusState: initial.statusState.map((row) =>
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
      [source],
    ) as StatDrivenCombatEncounterState
    const repository: BattleSessionRepository = {
      createBattleSession: vi.fn(),
      findBattleIntentReplay: vi.fn(),
      findBattleSession: vi.fn(async () => ({
        battleSessionId: SESSION_ID,
        battleId: state.tactical.battle.battleId,
        battleVersion: 1,
        rulesVersion: state.tactical.battle.rulesVersion,
        contentVersion: state.tactical.battle.contentVersion,
        lifecycle: state.tactical.battle.lifecycle,
        snapshot: JSON.parse(JSON.stringify(state)),
        controlledCombatantIds: [actorId],
        updatedAt: CREATED_AT,
      })),
      commitBattleIntent: vi.fn(async (input) => ({
        replayed: false,
        result: {
          battleSessionId: SESSION_ID,
          battleVersion: 2,
          snapshot: input.nextSnapshot,
          committedAt: CREATED_AT,
        },
      })),
    }
    await createBattleFinalTurnService(repository).commitFinalTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      facing: 'east',
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    })
    const commit = vi.mocked(repository.commitBattleIntent).mock.calls[0]![0]
    const hidden = commit.events.flatMap((event, eventIndex) =>
      (event as { sourceCommandVisibility?: unknown }).sourceCommandVisibility ? [eventIndex] : [],
    )
    expect(hidden.length).toBeGreaterThan(0)
    expect(commit.privacyJournal).toMatchObject({ commandVisibility: { kind: 'public' } })
    for (const eventIndex of hidden)
      expect(commit.privacyJournal!.eventVisibilityOverrides).toContainEqual({
        eventIndex,
        visibility: {
          kind: 'team-only',
          teamId: state.tactical.battle.combatants.find((unit) => unit.id === actorId)!.teamId,
        },
      })
  })
  it('actual facing preview checks legality without executing a turn or its Automatic/RNG boundaries', async () => {
    const state = await initialEncounter()
    const before = JSON.stringify(state)
    const repository: BattleSessionRepository = {
      createBattleSession: vi.fn(),
      findBattleIntentReplay: vi.fn(),
      commitBattleIntent: vi.fn(),
      findBattleSession: vi.fn(async () => ({
        battleSessionId: SESSION_ID,
        battleId: state.tactical.battle.battleId,
        battleVersion: 1,
        rulesVersion: state.tactical.battle.rulesVersion,
        contentVersion: state.tactical.battle.contentVersion,
        lifecycle: state.tactical.battle.lifecycle,
        snapshot: state,
        controlledCombatantIds: [`character:${CHARACTER_ID}`],
        updatedAt: CREATED_AT,
      })),
    }
    const boundary = vi.spyOn(turnEconomy, 'finishPv1fTurn')
    try {
      const preview = await createBattleFinalTurnService(repository).previewFinalTurn({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        facing: 'east',
      })
      expect(preview.legal).toBe(true)
      expect(boundary).not.toHaveBeenCalled()
      expect(repository.commitBattleIntent).not.toHaveBeenCalled()
      expect(JSON.stringify(state)).toBe(before)
    } finally {
      boundary.mockRestore()
    }
  })
  it('preserves buildAuthority and buildBridge when ending the player turn', async () => {
    const unburned = await initialEncounter()
    const actor = `character:${CHARACTER_ID}`
    const enemy = unburned.tactical.battle.combatants.find(
      (unit) =>
        unit.teamId !== unburned.tactical.battle.combatants.find((row) => row.id === actor)!.teamId,
    )!.id
    const initial = applyCurrentBurnState(unburned, enemy, actor, 'test.burn', true, undefined, 3, {
      capturedDamage: 23,
      profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
    }) as StatDrivenCombatEncounterState
    const buildAuthority = { schemaVersion: 1, marker: 'frozen-authority' }
    const buildBridge = { schemaVersion: 1, marker: 'frozen-bridge' }
    const state = {
      ...initial,
      buildAuthority,
      buildBridge,
    }
    let version = 1
    let storedSnapshot: unknown = state
    const commits: CommitBattleIntentInput[] = []

    const repository: BattleSessionRepository = {
      createBattleSession: vi.fn(async () => {
        throw new Error('Not used by final-turn commit test.')
      }),
      findBattleSession: vi.fn(async (): Promise<BattleSessionRecord> => ({
        battleSessionId: SESSION_ID,
        battleId: state.tactical.battle.battleId,
        battleVersion: version,
        rulesVersion: state.tactical.battle.rulesVersion,
        contentVersion: state.tactical.battle.contentVersion,
        lifecycle: state.tactical.battle.lifecycle,
        snapshot: storedSnapshot,
        controlledCombatantIds: [`character:${CHARACTER_ID}`],
        updatedAt: CREATED_AT,
      })),
      findBattleIntentReplay: vi.fn(async () => null),
      commitBattleIntent: vi.fn(async (input: CommitBattleIntentInput) => {
        commits.push(input)
        version += 1
        storedSnapshot = input.nextSnapshot
        return {
          replayed: false,
          result: {
            battleSessionId: SESSION_ID,
            battleVersion: version,
            snapshot: input.nextSnapshot,
            committedAt: '2026-08-17T15:00:01.000Z',
          },
        }
      }),
    }

    const result = await createBattleFinalTurnService(repository).commitFinalTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      facing: 'east',
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    })

    expect(commits).toHaveLength(1)
    expect(commits[0]?.nextSnapshot).toMatchObject({ buildAuthority, buildBridge })
    expect(result.snapshot).toMatchObject({ buildAuthority, buildBridge })
    expect(result.snapshot.statusState.find((row) => row.combatantId === actor)!.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: 'burn', remainingOwnerTurnEnds: 2 }),
      ]),
    )
    expect(result.battleVersion).toBe(2)
    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).not.toBe(
      `character:${CHARACTER_ID}`,
    )
  })
})
