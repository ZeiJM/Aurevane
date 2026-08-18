import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'
import { moveCurrentCombatant } from '@aurevane/game-core/combat/board'
import { finishPv1fTurn } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { createBattlePreviewService } from './battle-preview-service'
import { createBattleSessionService } from './battle-session-service'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const CREATED_AT = '2026-08-17T12:00:00.000Z'

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
      throw new Error('Not used by P2.5 preview tests.')
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

async function createFixture() {
  const battles = createBattleRepository()
  const sessionService = createBattleSessionService({
    characters: createCharacterRepository(),
    battles: battles.repository,
  })
  await sessionService.createSession({
    userId: USER_ID,
    characterId: CHARACTER_ID,
    idempotencyKey: '44444444-4444-4444-8444-444444444444',
  })
  const creation = battles.createBattleSession.mock.calls[0]?.[0]
  if (!creation) throw new Error('Expected initial battle creation.')
  const snapshot = creation.initialSnapshot as StatDrivenCombatEncounterState
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
  battles.findBattleSession.mockResolvedValue(record)

  return {
    battles,
    service: createBattlePreviewService(battles.repository),
    snapshot,
    record,
  }
}

function withMovedPlayer(state: StatDrivenCombatEncounterState): StatDrivenCombatEncounterState {
  const transition = moveCurrentCombatant(state.tactical, [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ])
  return reattachStatDrivenCombatBridge(
    createCombatEncounterState(transition.state, state.statusState),
    state.statBridge,
  )
}

describe('P2.5 authoritative battle preview service', () => {
  it('previews legal movement without calling the commit boundary', async () => {
    const { battles, service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'move',
      legal: true,
      cost: 1,
      movementRemainingAfter: 9,
      actionEconomyCost: 10,
      actionEconomyBefore: 100,
      actionEconomyAfter: 90,
      issues: [],
    })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('returns useful movement legality reasons instead of pretending a path can commit', async () => {
    const { service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'move',
        path: [
          { x: 0, y: 1 },
          { x: 4, y: 1 },
        ],
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'move',
      legal: false,
      issues: [expect.objectContaining({ code: 'non-adjacent-step' })],
    })
  })

  it('uses the stat-driven attack forecast without consuming authoritative RNG', async () => {
    const { battles, service, snapshot, record } = await createFixture()
    const adjacent = withMovedPlayer(snapshot)
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: adjacent })
    const rngBefore = adjacent.tactical.battle.rng

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: {
        kind: 'action',
        actionId: 'basic.attack.unarmed.basic',
        target: { kind: 'unit', combatantId: 'recruit:p2-4-1' },
      },
    })

    expect(result.preview).toMatchObject({
      kind: 'action',
      legal: true,
      actionId: 'basic.attack.unarmed.basic',
      primaryCombatantId: 'recruit:p2-4-1',
      hitChanceBasisPoints: expect.any(Number),
      defenseKind: 'armor',
      defenseRating: 20,
      mitigatedBaseDamage: expect.any(Number),
      issues: [],
    })
    expect(adjacent.tactical.battle.rng).toEqual(rngBefore)
    expect(result).not.toHaveProperty('snapshot')
    expect(JSON.stringify(result)).not.toContain('rng')
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('previews the authored final-facing blocker before End Turn', async () => {
    const { service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: { kind: 'end-turn' },
    })

    expect(result.preview).toMatchObject({
      kind: 'end-turn',
      legal: false,
      issues: [
        expect.objectContaining({
          code: 'choose-final-facing',
          message: expect.stringContaining('Choose North, East, South, or West'),
        }),
      ],
    })
  })

  it('previews final facing as the turn-ending command without mutating stored state', async () => {
    const { battles, service } = await createFixture()

    const result = await service.previewIntent({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
      intent: { kind: 'face', facing: 'east' },
    })

    expect(result.preview).toEqual({
      kind: 'face',
      legal: true,
      facing: 'east',
      endsTurn: true,
      issues: [],
    })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('rejects a stale preview with the current authoritative version', async () => {
    const { battles, service, record } = await createFixture()
    battles.findBattleSession.mockResolvedValue({ ...record, battleVersion: 4 })

    await expect(
      service.previewIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        intent: { kind: 'face', facing: 'east' },
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION', currentVersion: 4 })
    expect(battles.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('does not provide planning authority during an opponent-controlled turn', async () => {
    const { battles, service, snapshot, record } = await createFixture()
    const opponentTurn = finishPv1fTurn(snapshot, 'east').state
    expect(opponentTurn.tactical.battle.currentTurn?.combatantId).toBe('recruit:p2-4-1')
    battles.findBattleSession.mockResolvedValue({ ...record, snapshot: opponentTurn })

    await expect(
      service.previewIntent({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
        intent: { kind: 'face', facing: 'west' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
