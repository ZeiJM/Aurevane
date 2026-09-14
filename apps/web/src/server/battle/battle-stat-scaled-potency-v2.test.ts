import type {
  BattleSessionCommitRecord,
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

const USER_ID = '11111111-1111-4111-8111-111111119901'
const CHARACTER_ID = '22222222-2222-4222-8222-222222229902'
const SESSION_ID = '33333333-3333-4333-8333-333333339903'
const CREATED_AT = '2026-09-14T11:30:00.000Z'

function character(): CharacterRecord {
  return {
    id: CHARACTER_ID,
    userId: USER_ID,
    slotIndex: 0,
    rulesVersion: 1,
    name: 'Kernel Tester',
    nameKey: 'kernel tester',
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
    findByOwnerSlot: vi.fn(async () => character()),
    createBaseCharacter: vi.fn(async () => {
      throw new Error('Not used by battle stat snapshot tests.')
    }),
  }
}

function battleRepository() {
  const createBattleSession = vi.fn(async (input: CreateBattleSessionInput) => ({
    replayed: false,
    result: {
      battleSessionId: SESSION_ID,
      battleVersion: 1,
      snapshot: input.initialSnapshot,
      createdAt: CREATED_AT,
    },
  }))
  const repository: BattleSessionRepository = {
    createBattleSession,
    findBattleSession: vi.fn(async (): Promise<BattleSessionRecord | null> => null),
    findBattleIntentReplay: vi.fn(async (): Promise<BattleSessionCommitRecord | null> => null),
    commitBattleIntent: vi.fn(async (input: CommitBattleIntentInput) => ({
      replayed: false,
      result: {
        battleSessionId: input.battleSessionId,
        battleVersion: input.expectedBattleVersion + 1,
        snapshot: input.nextSnapshot,
        committedAt: CREATED_AT,
      },
    })),
  }
  return { repository, createBattleSession }
}

describe('P4.K2 live stat-scaled potency snapshots', () => {
  it('persists bridge v2 with authoritative player and canonical recruit offensive ratings', async () => {
    const battles = battleRepository()
    const service = createBattleSessionService({
      characters: characterRepository(),
      battles: battles.repository,
    })

    await service.createSession({
      userId: USER_ID,
      characterId: CHARACTER_ID,
      idempotencyKey: '44444444-4444-4444-8444-444444449904',
    })

    const input = battles.createBattleSession.mock.calls[0]?.[0]
    if (!input) throw new Error('Expected battle create input.')
    const state = input.initialSnapshot as StatDrivenCombatEncounterState

    expect(state.statBridge).toMatchObject({ schemaVersion: 2, rulesVersion: 2 })
    expect(
      state.statBridge.combatants.find(
        (profile) => profile.combatantId === `character:${CHARACTER_ID}`,
      ),
    ).toMatchObject({
      physicalPower: 34,
      mysticPower: 34,
    })
    expect(
      state.statBridge.combatants.find((profile) => profile.combatantId === 'recruit:p2-4-1'),
    ).toMatchObject({
      physicalPower: 30,
      mysticPower: 30,
    })
  })
})
