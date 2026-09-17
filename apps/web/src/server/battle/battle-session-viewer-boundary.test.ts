import type {
  BattleSessionCommitRecord,
  BattleSessionRecord,
  BattleSessionRepository,
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
const CREATED_AT = '2026-09-17T00:00:00.000Z'

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

describe('battle session viewer-entitlement projection boundary', () => {
  it('fails closed when persisted control spans opposing authoritative teams', async () => {
    const character = characterRecord()
    const characters: CharacterRepository = {
      findByOwnerSlot: vi.fn(async () => character),
      createBaseCharacter: vi.fn(async () => {
        throw new Error('Not used by viewer-boundary tests.')
      }),
    }

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
    const battles: BattleSessionRepository = {
      createBattleSession,
      findBattleSession,
      findBattleIntentReplay: vi.fn(async (): Promise<BattleSessionCommitRecord | null> => null),
      commitBattleIntent: vi.fn(async () => {
        throw new Error('Not used by viewer-boundary tests.')
      }),
    }

    const service = createBattleSessionService({ characters, battles })
    await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    })

    const createInput = createBattleSession.mock.calls[0]?.[0]
    if (!createInput) throw new Error('Expected battle creation input.')
    const snapshot = createInput.initialSnapshot as StatDrivenCombatEncounterState
    const battle = snapshot.tactical.battle
    findBattleSession.mockResolvedValue({
      battleSessionId: SESSION_ID,
      battleId: battle.battleId,
      battleVersion: 1,
      rulesVersion: battle.rulesVersion,
      contentVersion: battle.contentVersion,
      lifecycle: battle.lifecycle,
      snapshot,
      controlledCombatantIds: [`character:${CHARACTER_ID}`, 'recruit:p2-4-1'],
      updatedAt: CREATED_AT,
    })

    await expect(service.getSession(USER_ID, SESSION_ID)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })
})
