import type {
  BattleSessionRepository,
  BattleSessionRecord,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import {
  P2_3_COMBAT_CONTENT,
  endCombatTurn,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444'
const CREATED_AT = '2026-08-17T01:00:00.000Z'

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

function withFinalFacing(
  state: CombatEncounterState,
  facing: 'north' | 'east' | 'south' | 'west' = 'east',
): CombatEncounterState {
  return {
    ...state,
    tactical: selectCurrentFinalFacing(state.tactical, facing).state,
  }
}

function createCharacterRepository() {
  const findByOwnerSlot = vi.fn(async () => characterRecord())
  const repository: CharacterRepository = {
    findByOwnerSlot,
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by P2.4 battle service tests.')
    }),
  }

  return { repository, findByOwnerSlot }
}

function createBattleRepository() {
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => ({
    replayed: false,
    result: {
      battleSessionId: SESSION_ID,
      battleVersion: 1,
      snapshot: input.initialSnapshot,
      createdAt: CREATED_AT,
    },
  }))
  const findBattleSession = vi.fn(async (): Promise<BattleSessionRecord | null> => null)
  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => ({
    replayed: false,
    result: {
      battleSessionId: input.battleSessionId,
      battleVersion: input.expectedBattleVersion + 1,
      snapshot: input.nextSnapshot,
      committedAt: CREATED_AT,
    },
  }))
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession,
    commitBattleIntent,
  }

  return { repository, createBattleSession, findBattleSession, commitBattleIntent }
}

async function createPersistedFixture() {
  const characters = createCharacterRepository()
  const battles = createBattleRepository()
  const service = createBattleSessionService({
    characters: characters.repository,
    battles: battles.repository,
  })
  const created = await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
  })
  const createInput = battles.createBattleSession.mock.calls[0]?.[0]
  if (!createInput) throw new Error('Expected battle create input.')

  const persistedSnapshot = createInput.initialSnapshot as CombatEncounterState
  const battle = persistedSnapshot.tactical.battle
  const record: BattleSessionRecord = {
    battleSessionId: SESSION_ID,
    battleId: battle.battleId,
    battleVersion: 1,
    rulesVersion: battle.rulesVersion,
    contentVersion: battle.contentVersion,
    lifecycle: battle.lifecycle,
    snapshot: persistedSnapshot,
    controlledCombatantIds: [`character:${CHARACTER_ID}`],
    updatedAt: CREATED_AT,
  }
  return { characters, battles, service, created, persistedSnapshot, record }
}

describe('P2.4 battle session service', () => {
  it('creates authority state server-side without exposing deterministic RNG internals', async () => {
    const characters = createCharacterRepository()
    const battles = createBattleRepository()
    const service = createBattleSessionService({
      characters: characters.repository,
      battles: battles.repository,
    })

    const result = await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
    })

    expect(characters.findByOwnerSlot).toHaveBeenCalledWith(USER_ID, 0)
    expect(battles.createBattleSession).toHaveBeenCalledTimes(1)

    const input = battles.createBattleSession.mock.calls[0]?.[0]
    if (!input) throw new Error('Expected battle create input.')

    expect(input).toMatchObject({
      actorKey: USER_ID,
      userId: USER_ID,
      rulesVersion: 1,
      contentVersion: 1,
      participants: [
        {
          combatantId: `character:${CHARACTER_ID}`,
          participantRole: 'player',
          characterId: CHARACTER_ID,
        },
        {
          combatantId: 'recruit:p2-4-1',
          participantRole: 'opponent',
          characterId: null,
        },
      ],
    })
    expect(input.battleId).toMatch(/^battle:/)
    expect(input.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)

    const persistedSnapshot = input.initialSnapshot as CombatEncounterState
    expect(persistedSnapshot.tactical.battle.rng.seed).toBeGreaterThan(0)
    expect(persistedSnapshot.tactical.battle.rng.seed).toBeLessThanOrEqual(0xffff_ffff)
    expect(persistedSnapshot.tactical.battle.lifecycle).toBe('active')
    expect(persistedSnapshot.tactical.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          combatantId: `character:${CHARACTER_ID}`,
          position: { x: 0, y: 1 },
        }),
        expect.objectContaining({
          combatantId: 'recruit:p2-4-1',
          position: { x: 4, y: 1 },
        }),
      ]),
    )
    expect(result).toMatchObject({
      battleSessionId: SESSION_ID,
      battleVersion: 1,
      replayed: false,
    })
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
  })

  it('resolves a legal move on the server before persisting the next snapshot', async () => {
    const { battles, service, record } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue(record)

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    })

    expect(battles.commitBattleIntent).toHaveBeenCalledTimes(1)
    const commit = battles.commitBattleIntent.mock.calls[0]?.[0]
    if (!commit) throw new Error('Expected battle commit input.')

    expect(commit.expectedBattleVersion).toBe(1)
    expect(commit.events.length).toBeGreaterThan(0)
    expect(commit.nextSnapshot).not.toBe(record.snapshot)
    expect((commit.nextSnapshot as CombatEncounterState).tactical.battle).toHaveProperty('rng')
    expect(result.battleVersion).toBe(2)
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
    expect(
      result.snapshot.tactical.placements.find(
        (placement) => placement.combatantId === `character:${CHARACTER_ID}`,
      )?.position,
    ).toEqual({ x: 1, y: 1 })
  })

  it('uses persisted control mapping instead of team membership for turn ownership', async () => {
    const { battles, service, persistedSnapshot, record } = await createPersistedFixture()
    const opponentTurn = endCombatTurn(
      withFinalFacing(persistedSnapshot),
      P2_3_COMBAT_CONTENT,
    ).state
    const teamSpoofedOpponentTurn: CombatEncounterState = {
      ...opponentTurn,
      tactical: {
        ...opponentTurn.tactical,
        battle: {
          ...opponentTurn.tactical.battle,
          combatants: opponentTurn.tactical.battle.combatants.map((combatant) =>
            combatant.id === 'recruit:p2-4-1' ? { ...combatant, teamId: 'players' } : combatant,
          ),
        },
      },
    }
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: teamSpoofedOpponentTurn })

    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '56565656-5656-4565-8565-565656565656',
        intent: { kind: 'end-turn' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('fails closed when the persisted control projection references an unknown combatant', async () => {
    const { battles, service, record } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue({
      ...record,
      controlledCombatantIds: ['combatant:missing'],
    })

    await expect(service.getSession(USER_ID, SESSION_ID)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('rejects an illegal client-proposed move before persistence', async () => {
    const { battles, service, record } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue(record)

    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '66666666-6666-4666-8666-666666666666',
        intent: {
          kind: 'move',
          path: [
            { x: 0, y: 1 },
            { x: 4, y: 1 },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('replays an old player-intent retry even after the battle advances to an opponent turn', async () => {
    const { battles, service, record, persistedSnapshot } = await createPersistedFixture()
    const opponentTurn = endCombatTurn(
      withFinalFacing(persistedSnapshot),
      P2_3_COMBAT_CONTENT,
    ).state
    battles.findBattleSession.mockResolvedValue({
      ...record,
      battleVersion: 2,
      snapshot: opponentTurn,
    })
    battles.commitBattleIntent.mockResolvedValue({
      replayed: true,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: 2,
        snapshot: persistedSnapshot,
        committedAt: CREATED_AT,
      },
    })

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '77777777-7777-4777-8777-777777777777',
      intent: { kind: 'end-turn' },
    })

    expect(result).toMatchObject({ battleVersion: 2, replayed: true })
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
    expect(battles.commitBattleIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedBattleVersion: 1,
        nextSnapshot: opponentTurn,
        events: [],
      }),
    )
  })

  it('surfaces the authoritative version for an unused stale request', async () => {
    const { battles, service, record } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 3 })
    battles.commitBattleIntent.mockRejectedValue(new StaleBattleVersionError(3))

    await expect(
      service.submitIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        idempotencyKey: '88888888-8888-4888-8888-888888888888',
        intent: { kind: 'end-turn' },
      }),
    ).rejects.toMatchObject({
      code: 'STALE_VERSION',
      currentVersion: 3,
    })
  })

  it('uses Aurevane errors for rejected authority requests', () => {
    expect(new StaleBattleVersionError(2)).toBeInstanceOf(AurevaneError)
  })
})
