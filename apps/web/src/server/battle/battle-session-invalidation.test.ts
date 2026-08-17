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

import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444'
const CREATED_AT = '2026-08-17T10:45:00.000Z'
const COMMITTED_AT = '2026-08-17T10:46:00.000Z'

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

function createCharacterRepository(): CharacterRepository {
  return {
    findByOwnerSlot: vi.fn(async () => characterRecord()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by battle invalidation tests.')
    }),
  }
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
      committedAt: COMMITTED_AT,
    },
  }))
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession,
    commitBattleIntent,
  }

  return { repository, createBattleSession, findBattleSession, commitBattleIntent }
}

async function createFixture() {
  const battles = createBattleRepository()
  const service = createBattleSessionService({
    characters: createCharacterRepository(),
    battles: battles.repository,
  })
  const created = await service.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
  })
  const createInput = battles.createBattleSession.mock.calls[0]?.[0]
  if (!createInput) throw new Error('Expected battle creation input.')

  const snapshot = createInput.initialSnapshot as StatDrivenCombatEncounterState
  const record: BattleSessionRecord = {
    battleSessionId: SESSION_ID,
    battleId: snapshot.tactical.battle.battleId,
    battleVersion: 1,
    rulesVersion: snapshot.tactical.battle.rulesVersion,
    contentVersion: snapshot.tactical.battle.contentVersion,
    lifecycle: snapshot.tactical.battle.lifecycle,
    snapshot,
    controlledCombatantIds: [`character:${CHARACTER_ID}`],
    updatedAt: CREATED_AT,
  }

  return { battles, service, created, snapshot, record }
}

function expectIdentifierOnlyInvalidation(value: unknown, version: number, reason: string) {
  expect(value).toEqual({
    event: 'authoritative_state_changed',
    topic: `battle-session:${SESSION_ID}`,
    resourceType: 'battle_session',
    resourceId: SESSION_ID,
    version,
    occurredAt: expect.any(String),
    reason,
  })
  expect(value).not.toHaveProperty('snapshot')
  expect(value).not.toHaveProperty('rng')
  expect(value).not.toHaveProperty('events')
  expect(value).not.toHaveProperty('combatants')
}

describe('P2.4 battle-session invalidation contract', () => {
  it('returns an identifier-only invalidation for authoritative session creation', async () => {
    const { created } = await createFixture()

    expect(created.invalidation?.occurredAt).toBe(CREATED_AT)
    expectIdentifierOnlyInvalidation(created.invalidation, 1, 'created')
  })

  it('does not fabricate a change invalidation for a reconnect/read', async () => {
    const { battles, service, record } = await createFixture()
    battles.findBattleSession.mockResolvedValue(record)

    const loaded = await service.getSession(USER_ID, SESSION_ID)

    expect(loaded.battleVersion).toBe(1)
    expect(loaded.invalidation).toBeNull()
  })

  it('returns an identifier-only invalidation for a committed battle intent', async () => {
    const { battles, service, record } = await createFixture()
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

    expect(result.invalidation?.occurredAt).toBe(COMMITTED_AT)
    expectIdentifierOnlyInvalidation(result.invalidation, 2, 'state_changed')
  })

  it('returns the committed authoritative version for an idempotent replay invalidation', async () => {
    const { battles, service, snapshot, record } = await createFixture()
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 2 })
    battles.commitBattleIntent.mockResolvedValue({
      replayed: true,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: 2,
        snapshot,
        committedAt: COMMITTED_AT,
      },
    })

    const result = await service.submitIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      idempotencyKey: '66666666-6666-4666-8666-666666666666',
      intent: { kind: 'end-turn' },
    })

    expect(result.replayed).toBe(true)
    expectIdentifierOnlyInvalidation(result.invalidation, 2, 'state_changed')
  })
})
