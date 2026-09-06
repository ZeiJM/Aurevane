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
  it('preserves buildAuthority and buildBridge when ending the player turn', async () => {
    const initial = await initialEncounter()
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
    expect(result.battleVersion).toBe(2)
    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).not.toBe(
      `character:${CHARACTER_ID}`,
    )
  })
})
