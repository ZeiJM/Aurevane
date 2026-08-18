import type {
  BattleSessionRecord,
  BattleSessionRepository,
  CommitBattleIntentInput,
  CreateBattleSessionInput,
} from '@aurevane/db/battle-session'
import type { CharacterRecord, CharacterRepository } from '@aurevane/db/character'
import { P2_3_COMBAT_CONTENT, endCombatTurn } from '@aurevane/game-core/combat/actions'
import { selectCurrentFinalFacing } from '@aurevane/game-core/combat/board'
import {
  reattachStatDrivenCombatBridge,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  createBattleRecruitAiService,
  deriveRecruitTieBreakSeed,
} from './battle-recruit-ai-service'
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
      throw new Error('Not used by Recruit AI service tests.')
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
    commitBattleIntent: vi.fn(async () => {
      throw new Error('Not used while creating Recruit AI fixture.')
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

function advanceToRecruitTurn(
  state: StatDrivenCombatEncounterState,
): StatDrivenCombatEncounterState {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  const withFacing = reattachStatDrivenCombatBridge(
    { ...state, tactical: faced.state },
    state.statBridge,
  )
  return endCombatTurn(withFacing, P2_3_COMBAT_CONTENT).state as StatDrivenCombatEncounterState
}

function createStatefulRepository(
  initialState: StatDrivenCombatEncounterState,
  initialVersion = 1,
) {
  let version = initialVersion
  let state = initialState
  const commits: CommitBattleIntentInput[] = []

  const findBattleSession = vi.fn(async (): Promise<BattleSessionRecord> => ({
    battleSessionId: SESSION_ID,
    battleId: state.tactical.battle.battleId,
    battleVersion: version,
    rulesVersion: state.tactical.battle.rulesVersion,
    contentVersion: state.tactical.battle.contentVersion,
    lifecycle: state.tactical.battle.lifecycle,
    snapshot: state,
    controlledCombatantIds: [`character:${CHARACTER_ID}`],
    updatedAt: CREATED_AT,
  }))

  const commitBattleIntent = vi.fn(async (input: CommitBattleIntentInput) => {
    if (input.expectedBattleVersion !== version) throw new Error('Unexpected stale fixture commit.')
    commits.push(input)
    version += 1
    state = input.nextSnapshot as StatDrivenCombatEncounterState
    return {
      replayed: false,
      result: {
        battleSessionId: SESSION_ID,
        battleVersion: version,
        snapshot: state,
        committedAt: `2026-08-17T15:00:0${Math.min(version, 9)}.000Z`,
      },
    }
  })

  const repository: BattleSessionRepository = {
    createBattleSession: vi.fn(async () => {
      throw new Error('Not used by Recruit AI runner tests.')
    }),
    findBattleSession,
    commitBattleIntent,
  }

  return { repository, commits, findBattleSession, commitBattleIntent, currentState: () => state }
}

describe('P2.6 authoritative Recruit AI turn service', () => {
  it('derives deterministic tie-break seeds only from committed battle metadata', () => {
    const committedContext = {
      battleId: 'battle:test',
      round: 2,
      turnNumber: 5,
      battleVersion: 7,
      step: 0,
      combatantId: 'recruit:test',
    }

    const seed = deriveRecruitTieBreakSeed(committedContext)

    expect(seed).toBe(-578_671_629)
    expect(deriveRecruitTieBreakSeed({ ...committedContext })).toBe(seed)
    expect(deriveRecruitTieBreakSeed({ ...committedContext, step: 1 })).not.toBe(seed)
    expect(deriveRecruitTieBreakSeed({ ...committedContext, battleVersion: 8 })).not.toBe(seed)
  })

  it('commits a bounded legal Recruit sequence and returns authority to the player', async () => {
    const playerState = await initialEncounter()
    const recruitState = advanceToRecruitTurn(playerState)
    expect(recruitState.tactical.battle.currentTurn?.combatantId).toBe('recruit:p2-4-1')

    const fixture = createStatefulRepository(recruitState)
    const service = createBattleRecruitAiService(fixture.repository)
    const result = await service.runTurn({
      userId: USER_ID,
      battleSessionId: SESSION_ID,
      expectedBattleVersion: 1,
    })

    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.decisions.length).toBeLessThanOrEqual(8)
    expect(result.snapshot.tactical.battle.currentTurn?.combatantId).toBe(
      `character:${CHARACTER_ID}`,
    )
    expect(result.snapshot.tactical.battle).not.toHaveProperty('rng')
    expect(fixture.commits).toHaveLength(result.decisions.length)

    for (const commit of fixture.commits) {
      const decision = commit.events.find(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'recruit_ai_decision',
      )
      expect(decision).toMatchObject({
        event: 'recruit_ai_decision',
        combatantId: 'recruit:p2-4-1',
        profileId: 'recruit-standard-v2',
        profileVersion: 2,
        rulesVersion: 2,
      })
      expect(JSON.stringify(decision)).not.toContain('tieBreakSeed')
      expect(JSON.stringify(decision)).not.toContain('rng')
      expect(commit.requestFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    }
  })

  it('rejects attempts to run Recruit AI during a player-controlled turn', async () => {
    const state = await initialEncounter()
    const fixture = createStatefulRepository(state)
    const service = createBattleRecruitAiService(fixture.repository)

    await expect(
      service.runTurn({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(fixture.commitBattleIntent).not.toHaveBeenCalled()
  })

  it('fails stale requests before choosing or committing an AI decision', async () => {
    const state = advanceToRecruitTurn(await initialEncounter())
    const fixture = createStatefulRepository(state, 4)
    const service = createBattleRecruitAiService(fixture.repository)

    await expect(
      service.runTurn({
        userId: USER_ID,
        battleSessionId: SESSION_ID,
        expectedBattleVersion: 2,
      }),
    ).rejects.toMatchObject({ code: 'STALE_VERSION', currentVersion: 4 })
    expect(fixture.commitBattleIntent).not.toHaveBeenCalled()
  })
})
