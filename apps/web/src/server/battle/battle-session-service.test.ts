import type {
  BattleSessionCommitRecord,
  BattleSessionRepository,
  BattleSessionRecord,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import {
  P2_3_COMBAT_CONTENT,
  createCombatEncounterState,
  endCombatTurn,
} from '@aurevane/game-core/combat/actions'
import { moveCurrentCombatant, selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444'
const CREATED_AT = '2026-08-17T01:00:00.000Z'

function characterRecord(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
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
    ...overrides,
  }
}

function withFinalFacing(
  state: StatDrivenCombatEncounterState,
  facing: 'north' | 'east' | 'south' | 'west' = 'east',
): StatDrivenCombatEncounterState {
  return {
    ...state,
    tactical: selectCurrentFinalFacing(state.tactical, facing).state,
  }
}

function createCharacterRepository(character = characterRecord()) {
  const findByOwnerSlot = vi.fn(async () => character)
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
  const findBattleIntentReplay = vi.fn(
    async (): Promise<BattleSessionCommitRecord | null> => null,
  )
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
    findBattleIntentReplay,
    commitBattleIntent,
  }

  return {
    repository,
    createBattleSession,
    findBattleSession,
    findBattleIntentReplay,
    commitBattleIntent,
  }
}

async function createPersistedFixture(character = characterRecord()) {
  const characters = createCharacterRepository(character)
  const battles = createBattleRepository()
  const service = createBattleSessionService({
    characters: characters.repository,
    battles: battles.repository,
  })
  const created = await service.createSession({
    userId: USER_ID,
    characterId: character.id,
    idempotencyKey: IDEMPOTENCY_KEY,
  })
  const createInput = battles.createBattleSession.mock.calls[0]?.[0]
  if (!createInput) throw new Error('Expected battle create input.')

  const persistedSnapshot = createInput.initialSnapshot as StatDrivenCombatEncounterState
  const battle = persistedSnapshot.tactical.battle
  const record: BattleSessionRecord = {
    battleSessionId: SESSION_ID,
    battleId: battle.battleId,
    battleVersion: 1,
    rulesVersion: battle.rulesVersion,
    contentVersion: battle.contentVersion,
    lifecycle: battle.lifecycle,
    snapshot: persistedSnapshot,
    controlledCombatantIds: [`character:${character.id}`],
    updatedAt: CREATED_AT,
  }
  return { characters, battles, service, created, persistedSnapshot, record }
}

describe('P2.4 battle session service', () => {
  it('creates authority state from persisted Phase 1 stats without exposing deterministic RNG', async () => {
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
      rulesVersion: 2,
      contentVersion: 2,
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

    const persistedSnapshot = input.initialSnapshot as StatDrivenCombatEncounterState
    const player = persistedSnapshot.tactical.battle.combatants.find(
      (combatant) => combatant.id === `character:${CHARACTER_ID}`,
    )
    const playerProfile = persistedSnapshot.statBridge.combatants.find(
      (profile) => profile.combatantId === `character:${CHARACTER_ID}`,
    )
    const playerPlacement = persistedSnapshot.tactical.placements.find(
      (placement) => placement.combatantId === `character:${CHARACTER_ID}`,
    )
    const playerMovementProfile = persistedSnapshot.tactical.movementProfiles.find(
      (profile) => profile.id === playerPlacement?.movementProfileId,
    )

    expect(persistedSnapshot.tactical.battle.rng.seed).toBeGreaterThan(0)
    expect(persistedSnapshot.tactical.battle.rng.seed).toBeLessThanOrEqual(0xffff_ffff)
    expect(persistedSnapshot.tactical.battle.lifecycle).toBe('active')
    expect(player).toMatchObject({
      initiative: 28,
      baseMovementBudget: 10,
      hp: 164,
      maxHp: 164,
      mp: 90,
      maxMp: 90,
    })
    expect(playerProfile).toMatchObject({
      provenance: {
        kind: 'character-derived',
        sourceId: `character:${CHARACTER_ID}`,
        sourceRulesVersion: 1,
      },
      accuracy: 7_400,
      evasion: 900,
      armor: 23,
      ward: 23,
      jump: 1,
    })
    expect(playerMovementProfile?.maxElevationStep).toBe(1)
    expect(
      persistedSnapshot.tactical.tiles.find(
        (tile) => tile.position.x === 2 && tile.position.y === 0,
      )?.elevation,
    ).toBe(1)
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
    expect(result.snapshot.statBridge.rulesVersion).toBe(1)
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
  })

  it('changes authoritative combat and reliability values for a different legal character build', async () => {
    const character = characterRecord({ might: 5, finesse: 9, intellect: 5, resolve: 5 })
    const { battles } = await createPersistedFixture(character)
    const input = battles.createBattleSession.mock.calls[0]?.[0]
    if (!input) throw new Error('Expected battle create input.')

    const state = input.initialSnapshot as StatDrivenCombatEncounterState
    const player = state.tactical.battle.combatants.find(
      (combatant) => combatant.id === `character:${CHARACTER_ID}`,
    )
    const profile = state.statBridge.combatants.find(
      (candidate) => candidate.combatantId === `character:${CHARACTER_ID}`,
    )

    expect(player).toMatchObject({
      initiative: 27,
      baseMovementBudget: 10,
      hp: 162,
      maxHp: 162,
      mp: 80,
      maxMp: 80,
    })
    expect(profile).toMatchObject({
      accuracy: 7_750,
      evasion: 880,
      armor: 22,
      ward: 20,
      jump: 1,
    })
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
    expect((commit.nextSnapshot as StatDrivenCombatEncounterState).tactical.battle).toHaveProperty(
      'rng',
    )
    expect(result.battleVersion).toBe(2)
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
    expect(
      result.snapshot.tactical.placements.find(
        (placement) => placement.combatantId === `character:${CHARACTER_ID}`,
      )?.position,
    ).toEqual({ x: 1, y: 1 })
  })

  it('uses authoritative stat reliability and RNG when resolving a basic attack', async () => {
    const { battles, service, record, persistedSnapshot } = await createPersistedFixture()
    const positioned = moveCurrentCombatant(persistedSnapshot.tactical, [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    const adjacentSnapshot = reattachStatDrivenCombatBridge(
      createCombatEncounterState(positioned.state, persistedSnapshot.statusState),
      persistedSnapshot.statBridge,
    )
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: adjacentSnapshot })

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '52525252-5252-4525-8525-525252525252',
      intent: {
        kind: 'action',
        actionId: 'basic.attack.unarmed.basic',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })

    const actionCommit = battles.commitBattleIntent.mock.calls[0]?.[0]
    if (!actionCommit) throw new Error('Expected action commit input.')
    const nextState = actionCommit.nextSnapshot as StatDrivenCombatEncounterState

    expect(nextState.tactical.battle.rng.draws).toBe(1)
    expect(actionCommit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'stat_driven_attack_resolved',
          actorId: `character:${CHARACTER_ID}`,
          targetId: 'recruit:p2-4-1',
          hitChanceBasisPoints: 6_600,
          defenseKind: 'armor',
          defenseRating: 20,
          rulesVersion: 1,
        }),
      ]),
    )
    expect(result.battleVersion).toBe(2)
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
  })

  it('uses persisted control mapping instead of team membership for turn ownership', async () => {
    const { battles, service, persistedSnapshot, record } = await createPersistedFixture()
    const opponentTurn = reattachStatDrivenCombatBridge(
      endCombatTurn(withFinalFacing(persistedSnapshot), P2_3_COMBAT_CONTENT).state,
      persistedSnapshot.statBridge,
    )
    const teamSpoofedOpponentTurn: StatDrivenCombatEncounterState = {
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

  it('fails closed when the persisted stat bridge loses a combatant profile', async () => {
    const { battles, service, record, persistedSnapshot } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue({
      ...record,
      snapshot: {
        ...persistedSnapshot,
        statBridge: {
          ...persistedSnapshot.statBridge,
          combatants: persistedSnapshot.statBridge.combatants.filter(
            (profile) => profile.combatantId !== 'recruit:p2-4-1',
          ),
        },
      },
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
    const opponentTurn = reattachStatDrivenCombatBridge(
      endCombatTurn(withFinalFacing(persistedSnapshot), P2_3_COMBAT_CONTENT).state,
      persistedSnapshot.statBridge,
    )
    battles.findBattleSession.mockResolvedValue({
      ...record,
      battleVersion: 2,
      snapshot: opponentTurn,
    })
    battles.findBattleIntentReplay.mockResolvedValue({
      battleSessionId: SESSION_ID,
      battleVersion: 2,
      snapshot: persistedSnapshot,
      committedAt: CREATED_AT,
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
    expect(battles.findBattleIntentReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        actorKey: USER_ID,
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        idempotencyKey: '77777777-7777-4777-8777-777777777777',
      }),
    )
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('surfaces the authoritative version for an unused stale request without mutating persistence', async () => {
    const { battles, service, record } = await createPersistedFixture()
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 3 })

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
    expect(battles.findBattleIntentReplay).toHaveBeenCalledTimes(1)
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('uses Aurevane errors for rejected authority requests', () => {
    expect(new StaleBattleVersionError(2)).toBeInstanceOf(AurevaneError)
  })
})
